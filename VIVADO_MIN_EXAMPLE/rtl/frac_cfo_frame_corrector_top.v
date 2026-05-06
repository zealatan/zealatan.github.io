`timescale 1ns/1ps
// Fractional CFO correction + frame extraction.
// Discards cfg_timing_offset samples (phase-tracking), then outputs cfg_frame_len
// phase-corrected samples with tlast on the last one.
// Phase rotation: 256-entry Q1.15 sin/cos LUT initialized via real arithmetic.
// One-entry registered AXI-Stream output buffer; backpressure stalls input only
// during frame capture.  Pre-frame discard samples are accepted freely.
// sample_cnt is 8-bit; (cfg_timing_offset + cfg_frame_len) must not exceed 255.
module frac_cfo_frame_corrector_top #(
    parameter DATA_WIDTH  = 16,
    parameter PHASE_WIDTH = 16
) (
    input  wire                       aclk,
    input  wire                       aresetn,

    input  wire [2*DATA_WIDTH-1:0]    s_axis_tdata,    // {imag[31:16], real[15:0]}
    input  wire                       s_axis_tvalid,
    output wire                       s_axis_tready,

    output reg  [2*DATA_WIDTH-1:0]    m_axis_tdata,
    output reg                        m_axis_tvalid,
    input  wire                       m_axis_tready,
    output reg                        m_axis_tlast,

    input  wire [PHASE_WIDTH-1:0]     cfg_cfo_step,      // phase step/sample (2's complement)
    input  wire [7:0]                 cfg_frame_len,     // samples per frame (1-255)
    input  wire [7:0]                 cfg_timing_offset, // pre-frame discard count

    output reg                        frame_detected,   // 1-cycle pulse on first frame sample
    output reg  [7:0]                 dbg_sample_count
);

localparam LUT_N    = 256;
localparam LUT_BITS = 8;

// 256-point Q1.15 cos/sin LUT — initialized in simulation via real arithmetic
reg signed [DATA_WIDTH-1:0] cos_lut [0:LUT_N-1];
reg signed [DATA_WIDTH-1:0] sin_lut [0:LUT_N-1];

real    _pi;
integer _k;
initial begin
    _pi = 3.14159265358979323846;
    for (_k = 0; _k < LUT_N; _k = _k + 1) begin
        cos_lut[_k] = $rtoi(32767.0 * $cos(2.0 * _pi * _k / LUT_N));
        sin_lut[_k] = $rtoi(32767.0 * $sin(2.0 * _pi * _k / LUT_N));
    end
end

reg [PHASE_WIDTH-1:0] phase_acc;
reg [7:0]             sample_cnt;
reg                   in_frame;
reg [7:0]             frame_cnt;

wire buf_ready      = !m_axis_tvalid || m_axis_tready;
wire is_frame_start = !in_frame && (sample_cnt == cfg_timing_offset);
wire needs_buffer   = is_frame_start || in_frame;

assign s_axis_tready = aresetn && (!needs_buffer || buf_ready);

wire signed [DATA_WIDTH-1:0] in_real = s_axis_tdata[DATA_WIDTH-1:0];
wire signed [DATA_WIDTH-1:0] in_imag = s_axis_tdata[2*DATA_WIDTH-1:DATA_WIDTH];

wire [LUT_BITS-1:0]          lut_idx = phase_acc[PHASE_WIDTH-1:PHASE_WIDTH-LUT_BITS];
wire signed [DATA_WIDTH-1:0] cos_r   = cos_lut[lut_idx];
wire signed [DATA_WIDTH-1:0] sin_r   = sin_lut[lut_idx];

// Q1.15 complex multiply: result scaled by >>15 (bits [30:15] of 33-bit accumulator)
wire signed [2*DATA_WIDTH-1:0] prod_rr = in_real * cos_r;
wire signed [2*DATA_WIDTH-1:0] prod_ii = in_imag * sin_r;
wire signed [2*DATA_WIDTH-1:0] prod_ri = in_real * sin_r;
wire signed [2*DATA_WIDTH-1:0] prod_ir = in_imag * cos_r;

wire signed [2*DATA_WIDTH:0] acc_real = {prod_rr[2*DATA_WIDTH-1], prod_rr} -
                                         {prod_ii[2*DATA_WIDTH-1], prod_ii};
wire signed [2*DATA_WIDTH:0] acc_imag = {prod_ri[2*DATA_WIDTH-1], prod_ri} +
                                         {prod_ir[2*DATA_WIDTH-1], prod_ir};

wire signed [DATA_WIDTH-1:0] rot_real = acc_real[2*DATA_WIDTH-2:DATA_WIDTH-1];
wire signed [DATA_WIDTH-1:0] rot_imag = acc_imag[2*DATA_WIDTH-2:DATA_WIDTH-1];

wire s_handshake = s_axis_tvalid && s_axis_tready;
wire m_handshake = m_axis_tvalid && m_axis_tready;

always @(posedge aclk or negedge aresetn) begin
    if (!aresetn) begin
        phase_acc        <= {PHASE_WIDTH{1'b0}};
        sample_cnt       <= 8'd0;
        in_frame         <= 1'b0;
        frame_cnt        <= 8'd0;
        m_axis_tdata     <= {(2*DATA_WIDTH){1'b0}};
        m_axis_tvalid    <= 1'b0;
        m_axis_tlast     <= 1'b0;
        frame_detected   <= 1'b0;
        dbg_sample_count <= 8'd0;
    end else begin
        frame_detected <= 1'b0;

        if (m_handshake) begin
            m_axis_tvalid <= 1'b0;
            m_axis_tlast  <= 1'b0;
        end

        if (s_handshake) begin
            phase_acc        <= phase_acc + cfg_cfo_step;
            dbg_sample_count <= sample_cnt;

            if (is_frame_start) begin
                frame_detected <= 1'b1;
                m_axis_tdata   <= {rot_imag, rot_real};
                m_axis_tvalid  <= 1'b1;
                sample_cnt     <= sample_cnt + 8'd1;
                if (cfg_frame_len == 8'd1) begin
                    m_axis_tlast <= 1'b1;
                    in_frame     <= 1'b0;
                    frame_cnt    <= 8'd0;
                end else begin
                    m_axis_tlast <= 1'b0;
                    in_frame     <= 1'b1;
                    frame_cnt    <= 8'd1;
                end
            end else if (in_frame) begin
                m_axis_tdata  <= {rot_imag, rot_real};
                m_axis_tvalid <= 1'b1;
                sample_cnt    <= sample_cnt + 8'd1;
                if (frame_cnt >= cfg_frame_len - 8'd1) begin
                    m_axis_tlast <= 1'b1;
                    in_frame     <= 1'b0;
                    frame_cnt    <= 8'd0;
                end else begin
                    m_axis_tlast <= 1'b0;
                    frame_cnt    <= frame_cnt + 8'd1;
                end
            end else begin
                sample_cnt <= sample_cnt + 8'd1;
            end
        end
    end
end

endmodule
