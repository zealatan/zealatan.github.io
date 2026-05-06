`timescale 1ns/1ps

module frac_cfo_frame_corrector_top_tb;

localparam int DW       = 16;
localparam int PW       = 16;
localparam int CLK_HALF = 5;
localparam int LUT_N    = 256;
localparam int TIMEOUT  = 2000;

// DUT ports
logic        aclk, aresetn;
logic [31:0] s_axis_tdata;
logic        s_axis_tvalid;
wire         s_axis_tready;
wire  [31:0] m_axis_tdata;
wire         m_axis_tvalid;
logic        m_axis_tready;
wire         m_axis_tlast;
logic [15:0] cfg_cfo_step;
logic [7:0]  cfg_frame_len;
logic [7:0]  cfg_timing_offset;
wire         frame_detected;
wire  [7:0]  dbg_sample_count;

frac_cfo_frame_corrector_top #(.DATA_WIDTH(DW), .PHASE_WIDTH(PW)) dut (
    .aclk              (aclk),             .aresetn          (aresetn),
    .s_axis_tdata      (s_axis_tdata),     .s_axis_tvalid    (s_axis_tvalid),
    .s_axis_tready     (s_axis_tready),
    .m_axis_tdata      (m_axis_tdata),     .m_axis_tvalid    (m_axis_tvalid),
    .m_axis_tready     (m_axis_tready),    .m_axis_tlast     (m_axis_tlast),
    .cfg_cfo_step      (cfg_cfo_step),     .cfg_frame_len    (cfg_frame_len),
    .cfg_timing_offset (cfg_timing_offset),.frame_detected   (frame_detected),
    .dbg_sample_count  (dbg_sample_count)
);

initial aclk = 0;
always #CLK_HALF aclk = ~aclk;

// TB LUT — mirrors RTL initialization exactly for bit-exact golden model
logic signed [DW-1:0] tb_cos_lut [0:LUT_N-1];
logic signed [DW-1:0] tb_sin_lut [0:LUT_N-1];
real    tb_pi;
integer tb_k;
initial begin
    tb_pi = 3.14159265358979323846;
    for (tb_k = 0; tb_k < LUT_N; tb_k = tb_k + 1) begin
        tb_cos_lut[tb_k] = $rtoi(32767.0 * $cos(2.0 * tb_pi * tb_k / LUT_N));
        tb_sin_lut[tb_k] = $rtoi(32767.0 * $sin(2.0 * tb_pi * tb_k / LUT_N));
    end
end

// Golden phase-rotation model — bit-exact match to RTL Q1.15 arithmetic
function automatic [31:0] golden_rotate(
    input signed [DW-1:0] ir, ii,
    input        [PW-1:0] phase
);
    logic signed [DW-1:0]   cos_g, sin_g;
    logic signed [2*DW-1:0] p_rr, p_ii, p_ri, p_ir;
    logic signed [2*DW:0]   a_r, a_i;
    logic signed [DW-1:0]   o_r, o_i;
    cos_g = tb_cos_lut[phase[PW-1:PW-8]];
    sin_g = tb_sin_lut[phase[PW-1:PW-8]];
    p_rr  = ir * cos_g;  p_ii = ii * sin_g;
    p_ri  = ir * sin_g;  p_ir = ii * cos_g;
    a_r   = {p_rr[2*DW-1], p_rr} - {p_ii[2*DW-1], p_ii};
    a_i   = {p_ri[2*DW-1], p_ri} + {p_ir[2*DW-1], p_ir};
    o_r   = a_r[2*DW-2:DW-1];
    o_i   = a_i[2*DW-2:DW-1];
    return {o_i, o_r};
endfunction

// XorShift32 PRNG (seed must be non-zero)
function automatic [31:0] xorshift32(input [31:0] s);
    logic [31:0] x;
    x = s ^ (s << 13);
    x = x ^ (x >> 17);
    x = x ^ (x << 5);
    return x;
endfunction

// Counters and campaign statistics
int  pass_cnt, fail_cnt;
int  rand_trials;
int  r2_cfo_min, r2_cfo_max;
int  r1_offset_tested;
int  r5_bp_count;

task automatic chk(input string nm, input bit ok);
    if (ok) begin $display("[PASS] %s", nm); pass_cnt++; end
    else    begin $display("[FAIL] %s", nm); fail_cnt++; end
endtask

// ---------------------------------------------------------------
// Core tasks
// ---------------------------------------------------------------

task automatic do_reset();
    @(negedge aclk);
    aresetn = 0;
    s_axis_tvalid = 0; s_axis_tdata = 0;
    m_axis_tready = 0;
    repeat(4) @(posedge aclk);
    @(negedge aclk); aresetn = 1;
    @(posedge aclk);
endtask

// Drive one sample with m_tready=1 held; return data/last/fd seen at handshake posedge
// Pre-frame samples: m_tvalid stays 0 (no output captured).
// Frame samples: m_tvalid=1 at posedge #1 (captured via out_valid flag).
task automatic drive_one(
    input  signed [DW-1:0] r, i,
    output logic [31:0]    out_d,
    output logic           out_l,
    output logic           out_valid,  // 1 if m_tvalid=1 at sample point
    output logic           fd_seen
);
    int t;
    @(negedge aclk);
    s_axis_tdata  = {i[DW-1:0], r[DW-1:0]};
    s_axis_tvalid = 1;
    m_axis_tready = 1;
    t = 0;
    do begin
        @(posedge aclk); #1;
        if (++t > TIMEOUT)
            $fatal(1, "[FATAL] drive_one: s_tready timeout at sample (r=%0d,i=%0d)", r, i);
    end while (!s_axis_tready);
    fd_seen   = frame_detected;
    out_valid = m_axis_tvalid;
    out_d     = m_axis_tdata;
    out_l     = m_axis_tlast;
    @(negedge aclk);
    s_axis_tvalid = 0;
    s_axis_tdata  = 0;
    m_axis_tready = 0;
endtask

// Run a full frame test: send n_pre discard + n_frame frame samples,
// collect frame outputs, count frame_detected pulses.
// Phase at frame sample j = (n_pre + j) * cfg_cfo_step.
task automatic run_frame(
    input  int  n_pre, n_frame,
    input  signed [DW-1:0] sr[], si[],   // n_pre+n_frame samples
    output logic [31:0]    out_d[],
    output logic           out_l[],
    output int             fd_cnt
);
    int            idx, fidx;
    logic [31:0]   d;
    logic          l, ov, fd;

    out_d  = new[n_frame];
    out_l  = new[n_frame];
    fd_cnt = 0;
    fidx   = 0;

    for (idx = 0; idx < n_pre + n_frame; idx++) begin
        drive_one(sr[idx], si[idx], d, l, ov, fd);
        if (fd) fd_cnt++;
        if (ov && fidx < n_frame) begin
            out_d[fidx] = d;
            out_l[fidx] = l;
            fidx++;
        end
    end
    // Consume the last frame output that remains in the DUT's one-entry buffer.
    // With m_tready=1, m_handshake fires and clears m_tvalid.
    @(negedge aclk); m_axis_tready = 1;
    @(posedge aclk); #1;
    @(negedge aclk); m_axis_tready = 0;
endtask

// Receive one sample with m_tready asserted after 'delay' stall cycles.
// While stalling, verify m_tvalid stays high.
task automatic recv_bp(
    input  int    delay,
    output logic [31:0] out_d,
    output logic        out_l,
    output int    stall_ok_cnt   // counts cycles where tvalid=1 during stall
);
    int t, d;
    stall_ok_cnt = 0;
    @(negedge aclk);
    m_axis_tready = 0;
    t = 0;
    do begin
        @(posedge aclk); #1;
        if (++t > TIMEOUT) $fatal(1, "[FATAL] recv_bp: tvalid timeout");
    end while (!m_axis_tvalid);
    for (d = 0; d < delay; d++) begin
        if (m_axis_tvalid) stall_ok_cnt++;
        @(negedge aclk);
        m_axis_tready = 0;
        @(posedge aclk); #1;
    end
    if (m_axis_tvalid) stall_ok_cnt++;   // final stall cycle
    // Read data BEFORE asserting tready; m_tlast is cleared by m_handshake
    // NBA after the consume posedge, so we must capture it here while tready=0.
    out_d = m_axis_tdata;
    out_l = m_axis_tlast;
    @(negedge aclk);
    m_axis_tready = 1;
    @(posedge aclk);  // m_handshake fires here; m_tvalid/m_tlast cleared via NBA
    @(negedge aclk);
    m_axis_tready = 0;
endtask

// ---------------------------------------------------------------
// Main test sequence
// ---------------------------------------------------------------

logic [31:0] out_d[];
logic        out_l[];
logic [31:0] exp_d;
int          fd_cnt;
logic [31:0] prng;

// Per-test sample arrays (max 20 samples)
logic signed [DW-1:0] sr[20], si[20];

// Misc temps
logic [31:0] tmp_d;
logic        tmp_l, tmp_ov, tmp_fd;
int          tmp_stall;
logic [PW-1:0] tmp_ph;

initial begin
    aresetn         = 0;
    s_axis_tdata    = 0; s_axis_tvalid = 0;
    m_axis_tready   = 0;
    cfg_cfo_step    = 0; cfg_frame_len = 4; cfg_timing_offset = 0;
    pass_cnt  = 0; fail_cnt  = 0;
    rand_trials = 0;
    r2_cfo_min = 32767; r2_cfo_max = -32768;
    r1_offset_tested = 0; r5_bp_count = 0;
    prng = 32'hC0FFEE01;

    // ============================================================
    // STEP 20 TESTS — 39 checks
    // ============================================================

    // --- T1: Reset defaults (3 checks) ---
    $display("[TEST] T1 Reset defaults");
    repeat(3) @(negedge aclk);
    chk("T1.1 m_tvalid=0 in reset",    m_axis_tvalid  === 1'b0);
    chk("T1.2 frame_det=0 in reset",   frame_detected === 1'b0);
    chk("T1.3 m_tlast=0 in reset",     m_axis_tlast   === 1'b0);
    @(negedge aclk); aresetn = 1; @(posedge aclk);

    // --- T2: offset=0, cfo=0, frame_len=4 — 4 data + 1 fd + 1 tlast = 6 checks ---
    $display("[TEST] T2 Frame offset=0 cfo=0 len=4");
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 4; cfg_timing_offset = 0;
    foreach (sr[j]) begin sr[j] = signed'(16'((j+1)*300)); si[j] = signed'(16'((j+1)*100)); end
    run_frame(0, 4, sr, si, out_d, out_l, fd_cnt);
    chk("T2.1 frame_detected fired",   fd_cnt == 1);
    for (int j = 0; j < 4; j++) begin
        exp_d = golden_rotate(sr[j], si[j], 16'(j) * cfg_cfo_step);
        chk($sformatf("T2.%0d data[%0d]", j+2, j), out_d[j] === exp_d);
    end
    chk("T2.6 tlast on last",          out_l[3] === 1'b1);

    // --- T3: offset=3, cfo=0, frame_len=3 — 3 data + 1 fd + 1 tlast = 5 checks ---
    $display("[TEST] T3 Frame offset=3 cfo=0 len=3");
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 3; cfg_timing_offset = 3;
    for (int j = 0; j < 6; j++) begin sr[j] = signed'(16'((j+1)*500)); si[j] = signed'(16'((j+1)*200)); end
    run_frame(3, 3, sr, si, out_d, out_l, fd_cnt);
    chk("T3.1 frame_detected fired",   fd_cnt == 1);
    for (int j = 0; j < 3; j++) begin
        // phase at frame sample j = (offset+j)*cfo_step = 0 when cfo=0
        exp_d = golden_rotate(sr[3+j], si[3+j], 16'((3+j)) * cfg_cfo_step);
        chk($sformatf("T3.%0d data[%0d]", j+2, j), out_d[j] === exp_d);
    end
    chk("T3.5 tlast on last",          out_l[2] === 1'b1);

    // --- T4: frame_detected pulse timing — 3 checks ---
    $display("[TEST] T4 frame_detected pulse");
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 3; cfg_timing_offset = 1;
    sr[0] = 100; si[0] = 50; sr[1] = 200; si[1] = 60; sr[2] = 300; si[2] = 70; sr[3] = 400; si[3] = 80;
    // drive pre-frame sample: no fd
    drive_one(sr[0], si[0], tmp_d, tmp_l, tmp_ov, tmp_fd);
    chk("T4.1 no fd before frame",     tmp_fd === 1'b0);
    // drive first frame sample: fd=1
    drive_one(sr[1], si[1], tmp_d, tmp_l, tmp_ov, tmp_fd);
    chk("T4.2 fd=1 on frame start",    tmp_fd === 1'b1);
    // drive second frame sample: fd=0 (pulse only 1 cycle)
    drive_one(sr[2], si[2], tmp_d, tmp_l, tmp_ov, tmp_fd);
    chk("T4.3 fd=0 after start",       tmp_fd === 1'b0);
    // drain last sample
    drive_one(sr[3], si[3], tmp_d, tmp_l, tmp_ov, tmp_fd);

    // --- T5: tlast pattern for 4-sample frame — 4 checks ---
    $display("[TEST] T5 tlast pattern");
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 4; cfg_timing_offset = 0;
    for (int j = 0; j < 4; j++) begin sr[j] = 16'(j*200+100); si[j] = 16'(j*100+50); end
    run_frame(0, 4, sr, si, out_d, out_l, fd_cnt);
    chk("T5.1 tlast[0]=0", out_l[0] === 1'b0);
    chk("T5.2 tlast[1]=0", out_l[1] === 1'b0);
    chk("T5.3 tlast[2]=0", out_l[2] === 1'b0);
    chk("T5.4 tlast[3]=1", out_l[3] === 1'b1);

    // --- T6: Backpressure basic — 3 checks ---
    $display("[TEST] T6 Backpressure basic");
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 3; cfg_timing_offset = 0;
    // Drive first frame sample with m_tready=1 (buffer empty at start)
    sr[0] = 1000; si[0] = 2000;
    drive_one(sr[0], si[0], tmp_d, tmp_l, tmp_ov, tmp_fd);
    // Now hold m_tready=0 and drive the next sample — DUT should stall
    // Verify m_tvalid stable with backpressure of 2 cycles
    sr[1] = 3000; si[1] = 4000;
    // Start sending sample 1 with m_tready=0 — stall expected
    @(negedge aclk);
    s_axis_tdata  = {si[1][DW-1:0], sr[1][DW-1:0]};
    s_axis_tvalid = 1;
    m_axis_tready = 0;
    repeat(2) begin
        @(posedge aclk); #1;
        chk("T6.1 tvalid held during bp", m_axis_tvalid === 1'b1);
    end
    // Release and let both sample 1 and 2 complete
    @(negedge aclk);
    s_axis_tvalid = 0; s_axis_tdata = 0;
    m_axis_tready = 0;
    @(posedge aclk);
    // Now consume the pending output and send remaining samples
    for (int j = 1; j < 3; j++) begin sr[j] = 16'(j*1000); si[j] = 16'(j*500); end
    run_frame(0, 2, sr, si, out_d, out_l, fd_cnt);   // just 2 more samples (frame already started)
    // Verify last sample's tlast (we consumed the first via buf so 3-sample frame last=out_l[1])
    // Simple check: last output has tlast=1
    chk("T6.2 last output tlast=1",    out_l[1] === 1'b1);

    // --- T7: Frame length 1 — 4 checks ---
    $display("[TEST] T7 Frame length 1");
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 1; cfg_timing_offset = 2;
    sr[0] = 100; si[0] = 200; sr[1] = 300; si[1] = 400; sr[2] = 500; si[2] = 600;
    run_frame(2, 1, sr, si, out_d, out_l, fd_cnt);
    chk("T7.1 fd fired once",          fd_cnt == 1);
    exp_d = golden_rotate(sr[2], si[2], 16'(2) * cfg_cfo_step);
    chk("T7.2 data correct",           out_d[0] === exp_d);
    chk("T7.3 tlast=1",                out_l[0] === 1'b1);
    // Verify no additional output after the single-sample frame
    repeat(3) @(posedge aclk);
    chk("T7.4 no extra output",        m_axis_tvalid === 1'b0);

    // --- T8: Reset mid-stream — 5 checks ---
    $display("[TEST] T8 Reset mid-stream");
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 4; cfg_timing_offset = 0;
    sr[0] = 1234; si[0] = 5678;
    // Send one sample into frame
    drive_one(sr[0], si[0], tmp_d, tmp_l, tmp_ov, tmp_fd);
    chk("T8.1 m_tvalid=1 before reset", m_axis_tvalid === 1'b1);
    // Assert reset mid-frame
    @(negedge aclk); aresetn = 0;
    repeat(2) @(posedge aclk);
    @(negedge aclk);
    chk("T8.2 m_tvalid=0 after reset",  m_axis_tvalid === 1'b0);
    chk("T8.3 m_tlast=0 after reset",   m_axis_tlast  === 1'b0);
    // Release reset and run a fresh frame
    @(negedge aclk); aresetn = 1; @(posedge aclk);
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 2; cfg_timing_offset = 0;
    sr[0] = 999; si[0] = 888; sr[1] = 777; si[1] = 666;
    run_frame(0, 2, sr, si, out_d, out_l, fd_cnt);
    chk("T8.4 recovery: fd fired",      fd_cnt == 1);
    chk("T8.5 recovery: tlast on last", out_l[1] === 1'b1);

    // --- T9: Post-frame no extra output — 6 checks ---
    $display("[TEST] T9 Post-frame canary");
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 2; cfg_timing_offset = 1;
    sr[0]=100; si[0]=200; sr[1]=300; si[1]=400; sr[2]=500; si[2]=600;
    run_frame(1, 2, sr, si, out_d, out_l, fd_cnt);
    // Consume any pending output
    @(negedge aclk); m_axis_tready = 1;
    repeat(3) @(posedge aclk);
    @(negedge aclk); m_axis_tready = 0;
    // No more output expected
    chk("T9.1 m_tvalid=0 post-frame",   m_axis_tvalid === 1'b0);
    // s_tready=1 (no stall) for 4 cycles after frame
    repeat(4) begin
        @(posedge aclk); #1;
        chk("T9.2 s_tready=1 post-frame", s_axis_tready === 1'b1);
    end
    // Drive 2 extra samples after frame — no output
    @(negedge aclk); s_axis_tdata = 32'hDEAD_BEEF; s_axis_tvalid = 1;
    @(posedge aclk); #1;
    chk("T9.3 no output on extra sample", m_axis_tvalid === 1'b0);
    @(negedge aclk); s_axis_tvalid = 0;

    $display("[STEP20] Total so far: PASS=%0d FAIL=%0d (target 39)", pass_cnt, fail_cnt);

    // ============================================================
    // STEP 21 RANDOMIZED CAMPAIGN
    // ============================================================

    // --- R1: Timing offset sweep, offsets 0..15 (16 x 2 = 32 checks) ---
    $display("[TEST] R1 Timing offset sweep (offsets 0..15)");
    r1_offset_tested = 0;
    for (int off = 0; off <= 15; off++) begin
        do_reset();
        cfg_cfo_step = 0; cfg_frame_len = 4; cfg_timing_offset = 8'(off);
        for (int j = 0; j < off + 4; j++) begin
            sr[j] = signed'(16'((j+1)*111 + off*13));
            si[j] = signed'(16'((j+1)*77  + off*7));
        end
        run_frame(off, 4, sr, si, out_d, out_l, fd_cnt);
        chk($sformatf("R1.off%0d fd", off),   fd_cnt == 1);
        chk($sformatf("R1.off%0d tlast", off), out_l[3] === 1'b1);
        r1_offset_tested++;
        rand_trials++;
    end

    // --- R2: Fractional CFO sweep (4 values x 4 checks each = 16 checks) ---
    // CFO steps: 0 (0°/sample), 64 (90°/sample), 128 (180°/sample), 192 (270°/sample)
    // Phase unit: 2^16 = full circle; 256*64=16384=65536/4 => 90° per sample LUT index
    $display("[TEST] R2 Fractional CFO sweep");
    begin
        logic [15:0] cfo_vals[4];
        cfo_vals[0] = 16'h0000;  // 0 deg/sample
        cfo_vals[1] = 16'h4000;  // 90 deg/sample (LUT idx +64 per sample)
        cfo_vals[2] = 16'h8000;  // 180 deg/sample
        cfo_vals[3] = 16'hC000;  // 270 deg/sample
        for (int ci = 0; ci < 4; ci++) begin
            do_reset();
            cfg_cfo_step = cfo_vals[ci];
            cfg_frame_len = 4; cfg_timing_offset = 2;
            if ($signed(cfo_vals[ci]) < r2_cfo_min) r2_cfo_min = $signed(cfo_vals[ci]);
            if ($signed(cfo_vals[ci]) > r2_cfo_max) r2_cfo_max = $signed(cfo_vals[ci]);
            for (int j = 0; j < 6; j++) begin
                sr[j] = signed'(16'('h1000 + j * 'h200));
                si[j] = signed'(16'('h0800 + j * 'h100));
            end
            run_frame(2, 4, sr, si, out_d, out_l, fd_cnt);
            for (int j = 0; j < 4; j++) begin
                tmp_ph = 16'(2 + j) * cfo_vals[ci];
                exp_d  = golden_rotate(sr[2+j], si[2+j], tmp_ph);
                chk($sformatf("R2.cfo%0d samp%0d", ci, j), out_d[j] === exp_d);
            end
            rand_trials++;
        end
    end

    // --- R3: Randomized frame placement (20 trials x 2 = 40 checks) ---
    $display("[TEST] R3 Randomized frame placement (20 trials)");
    for (int trial = 0; trial < 20; trial++) begin
        int off, flen, total;
        prng = xorshift32(prng);
        off   = (prng[3:0]);         // offset 0..15
        prng  = xorshift32(prng);
        flen  = (prng[2:0]) + 1;     // frame_len 1..8
        total = off + flen;
        do_reset();
        cfg_cfo_step = 0; cfg_frame_len = 8'(flen); cfg_timing_offset = 8'(off);
        for (int j = 0; j < total; j++) begin
            prng  = xorshift32(prng);
            sr[j] = signed'(prng[15:0]);
            prng  = xorshift32(prng);
            si[j] = signed'(prng[15:0]);
        end
        run_frame(off, flen, sr, si, out_d, out_l, fd_cnt);
        chk($sformatf("R3.t%0d fd=1", trial),      fd_cnt == 1);
        chk($sformatf("R3.t%0d tlast", trial),      out_l[flen-1] === 1'b1);
        rand_trials++;
    end

    // --- R4: Randomized amplitude scaling, cfo_step=0 (10 trials x 1 = 10 checks) ---
    // With cfo_step=0, phase_acc stays 0 every sample; golden_rotate(r,i,0) should
    // equal (r * cos_lut[0] - i * sin_lut[0]) >> 15 = (r * 32767 - i * 0) >> 15 ≈ r
    // (cos_lut[0]=32767, sin_lut[0]=0 for phase=0)
    $display("[TEST] R4 Randomized amplitude scaling (10 trials)");
    for (int trial = 0; trial < 10; trial++) begin
        do_reset();
        cfg_cfo_step = 0; cfg_frame_len = 1; cfg_timing_offset = 0;
        prng = xorshift32(prng);
        sr[0] = signed'(prng[15:0]);
        prng  = xorshift32(prng);
        si[0] = signed'(prng[15:0]);
        run_frame(0, 1, sr, si, out_d, out_l, fd_cnt);
        exp_d = golden_rotate(sr[0], si[0], 16'h0000);
        chk($sformatf("R4.t%0d data", trial), out_d[0] === exp_d);
        rand_trials++;
    end

    // --- R5: AXI-Stream backpressure patterns (4 delay values x 3 = 12 checks) ---
    $display("[TEST] R5 Backpressure patterns (delays 0,1,2,3)");
    for (int bp_delay = 0; bp_delay <= 3; bp_delay++) begin
        int stall_ok;
        do_reset();
        cfg_cfo_step = 16'h1000; cfg_frame_len = 2; cfg_timing_offset = 1;
        sr[0] = 16'h1234; si[0] = 16'h5678;
        sr[1] = 16'h2345; si[1] = 16'h6789;
        sr[2] = 16'h3456; si[2] = 16'h789A;
        // Send pre-frame sample first (freely accepted)
        drive_one(sr[0], si[0], tmp_d, tmp_l, tmp_ov, tmp_fd);
        // Send first frame sample; DUT produces output
        drive_one(sr[1], si[1], tmp_d, tmp_l, tmp_ov, tmp_fd);
        // Now receive frame[0] with backpressure
        recv_bp(bp_delay, tmp_d, tmp_l, stall_ok);
        chk($sformatf("R5.bp%0d stall valid", bp_delay), stall_ok >= bp_delay);
        // Send frame[1] and receive it
        drive_one(sr[2], si[2], tmp_d, tmp_l, tmp_ov, tmp_fd);
        recv_bp(0, tmp_d, tmp_l, stall_ok);
        exp_d = golden_rotate(sr[2], si[2], 16'(2) * cfg_cfo_step);
        chk($sformatf("R5.bp%0d data",  bp_delay), tmp_d === exp_d);
        chk($sformatf("R5.bp%0d tlast", bp_delay), tmp_l === 1'b1);
        r5_bp_count++;
        rand_trials++;
    end

    // --- R6: Reset robustness — 3 scenarios x 3 checks = 9 checks ---
    $display("[TEST] R6 Reset robustness");

    // R6a: Reset during pre-frame discard phase
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 3; cfg_timing_offset = 5;
    sr[0] = 100; si[0] = 200;
    drive_one(sr[0], si[0], tmp_d, tmp_l, tmp_ov, tmp_fd); // pre-frame
    @(negedge aclk); aresetn = 0;
    repeat(2) @(posedge aclk);
    @(negedge aclk);
    chk("R6a.1 tvalid=0 after reset",   m_axis_tvalid === 1'b0);
    @(negedge aclk); aresetn = 1; @(posedge aclk);
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 2; cfg_timing_offset = 0;
    sr[0] = 500; si[0] = 600; sr[1] = 700; si[1] = 800;
    run_frame(0, 2, sr, si, out_d, out_l, fd_cnt);
    chk("R6a.2 recovery fd",            fd_cnt == 1);
    chk("R6a.3 recovery tlast",         out_l[1] === 1'b1);

    // R6b: Reset while frame output buffer is non-empty
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 3; cfg_timing_offset = 0;
    sr[0] = 111; si[0] = 222;
    drive_one(sr[0], si[0], tmp_d, tmp_l, tmp_ov, tmp_fd); // first frame sample
    // Buffer now holds rotated sample 0; reset before consuming
    @(negedge aclk); aresetn = 0;
    repeat(2) @(posedge aclk);
    @(negedge aclk);
    chk("R6b.1 tvalid=0 after reset",   m_axis_tvalid === 1'b0);
    @(negedge aclk); aresetn = 1; @(posedge aclk);
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 1; cfg_timing_offset = 0;
    sr[0] = 999; si[0] = 888;
    run_frame(0, 1, sr, si, out_d, out_l, fd_cnt);
    chk("R6b.2 recovery fd",            fd_cnt == 1);
    chk("R6b.3 recovery data",          out_d[0] === golden_rotate(sr[0], si[0], 16'h0000));

    // R6c: Reset after complete frame (clean idle state)
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 2; cfg_timing_offset = 0;
    sr[0] = 333; si[0] = 444; sr[1] = 555; si[1] = 666;
    run_frame(0, 2, sr, si, out_d, out_l, fd_cnt);
    @(negedge aclk); m_axis_tready = 1; repeat(3) @(posedge aclk); @(negedge aclk); m_axis_tready = 0;
    @(negedge aclk); aresetn = 0; repeat(2) @(posedge aclk); @(negedge aclk);
    chk("R6c.1 tvalid=0 after reset",   m_axis_tvalid === 1'b0);
    @(negedge aclk); aresetn = 1; @(posedge aclk);
    do_reset();
    cfg_cfo_step = 0; cfg_frame_len = 1; cfg_timing_offset = 0;
    sr[0] = 12; si[0] = 34;
    run_frame(0, 1, sr, si, out_d, out_l, fd_cnt);
    chk("R6c.2 recovery fd",            fd_cnt == 1);
    chk("R6c.3 recovery correct data",  out_d[0] === golden_rotate(sr[0], si[0], 16'h0000));

    // --- R7: No-frame / false-trigger rejection (3 tests x 2 = 6 checks) ---
    $display("[TEST] R7 No-frame false-trigger rejection");
    for (int rt = 0; rt < 3; rt++) begin
        int nsend, off;
        prng  = xorshift32(prng);
        off   = (prng[3:0]) + 4;   // offset 4..19
        nsend = off - 1;            // send strictly fewer samples than offset
        do_reset();
        cfg_cfo_step = 0; cfg_frame_len = 4; cfg_timing_offset = 8'(off);
        // Drive nsend pre-frame samples (no m_tready needed — freely accepted)
        for (int j = 0; j < nsend; j++) begin
            prng = xorshift32(prng);
            drive_one(signed'(prng[15:0]), signed'(prng[31:16]),
                      tmp_d, tmp_l, tmp_ov, tmp_fd);
        end
        // Wait a few cycles and verify no frame output appeared
        repeat(5) @(posedge aclk);
        chk($sformatf("R7.t%0d tvalid=0", rt), m_axis_tvalid === 1'b0);
        chk($sformatf("R7.t%0d fd=0",    rt),  frame_detected === 1'b0);
        rand_trials++;
    end

    // --- R8: Buffer boundary stress (4 edge cases x 3 = 12 checks) ---
    $display("[TEST] R8 Buffer boundary stress");

    // R8a: frame_len=1, offset=0 (minimum)
    do_reset();
    cfg_cfo_step = 16'h2000; cfg_frame_len = 1; cfg_timing_offset = 0;
    sr[0] = 16'h0100; si[0] = 16'h0200;
    run_frame(0, 1, sr, si, out_d, out_l, fd_cnt);
    chk("R8a.1 fd",    fd_cnt == 1);
    chk("R8a.2 tlast", out_l[0] === 1'b1);
    exp_d = golden_rotate(sr[0], si[0], 16'h0000);
    chk("R8a.3 data",  out_d[0] === exp_d);

    // R8b: frame_len=10, offset=0
    do_reset();
    cfg_cfo_step = 16'h0800; cfg_frame_len = 10; cfg_timing_offset = 0;
    for (int j = 0; j < 10; j++) begin sr[j] = 16'(j*300+100); si[j] = 16'(j*150+50); end
    run_frame(0, 10, sr, si, out_d, out_l, fd_cnt);
    chk("R8b.1 fd",    fd_cnt == 1);
    chk("R8b.2 tlast", out_l[9] === 1'b1);
    exp_d = golden_rotate(sr[0], si[0], 16'h0000);
    chk("R8b.3 data0", out_d[0] === exp_d);

    // R8c: frame_len=4, offset=15 (max offset tested)
    do_reset();
    cfg_cfo_step = 16'h0400; cfg_frame_len = 4; cfg_timing_offset = 15;
    for (int j = 0; j < 19; j++) begin
        sr[j] = signed'(16'(j*200 + 50));
        si[j] = signed'(16'(j*100 + 25));
    end
    run_frame(15, 4, sr, si, out_d, out_l, fd_cnt);
    chk("R8c.1 fd",    fd_cnt == 1);
    chk("R8c.2 tlast", out_l[3] === 1'b1);
    exp_d = golden_rotate(sr[15], si[15], 16'(15) * cfg_cfo_step);
    chk("R8c.3 data0", out_d[0] === exp_d);

    // R8d: frame_len=8, offset=8 — mid-range
    do_reset();
    cfg_cfo_step = 16'hF000; cfg_frame_len = 8; cfg_timing_offset = 8;
    for (int j = 0; j < 16; j++) begin sr[j] = 16'(j*400+200); si[j] = 16'(j*300+100); end
    run_frame(8, 8, sr, si, out_d, out_l, fd_cnt);
    chk("R8d.1 fd",    fd_cnt == 1);
    chk("R8d.2 tlast", out_l[7] === 1'b1);
    exp_d = golden_rotate(sr[8], si[8], 16'(8) * cfg_cfo_step);
    chk("R8d.3 data0", out_d[0] === exp_d);

    // ============================================================
    // FINAL SUMMARY
    // ============================================================
    $display("");
    $display("--- SIMULATION SUMMARY ---");
    $display("PASS: %0d", pass_cnt);
    $display("FAIL: %0d", fail_cnt);
    $display("Randomized trials (sweeps+random): %0d", rand_trials);
    $display("CFO range tested (step values): 0x0000 to 0xC000 and 0xF000");
    $display("Timing offset range: 0..15 (sweep) + random 0..15");
    $display("Backpressure patterns tested: %0d (delays 0..3)", r5_bp_count);
    $display("--------------------------");

    if (fail_cnt == 0)
        $display("[CI GATE] PASSED");
    else
        $display("[CI GATE] FAILED");

    $finish;
end

endmodule
