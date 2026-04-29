`timescale 1ns/1ps

// Drive AXI master signals on negedge; sample DUT ready/valid on posedge.
// check_resp_note() is a soft check used for RTL-limitation cases: it logs
// [FAIL] and increments fail_count but does NOT call $fatal, so the simulation
// runs to completion and the full picture is visible.
module axi_lite_regfile_tb;

    // ---------------------------------------------------------------
    // Clock / reset
    // ---------------------------------------------------------------
    logic aclk   = 1'b0;
    logic aresetn;
    always #5 aclk = ~aclk;   // 100 MHz

    // ---------------------------------------------------------------
    // AXI-lite wires
    // ---------------------------------------------------------------
    logic [31:0] awaddr;  logic        awvalid; wire         awready;
    logic [31:0] wdata;   logic [ 3:0] wstrb;   logic        wvalid;  wire  wready;
    wire  [ 1:0] bresp;   wire         bvalid;  logic        bready;
    logic [31:0] araddr;  logic        arvalid; wire         arready;
    wire  [31:0] rdata;   wire  [ 1:0] rresp;   wire         rvalid;  logic rready;

    // ---------------------------------------------------------------
    // DUT
    // ---------------------------------------------------------------
    axi_lite_regfile dut (
        .aclk    (aclk),    .aresetn (aresetn),
        .awaddr  (awaddr),  .awvalid (awvalid), .awready (awready),
        .wdata   (wdata),   .wstrb   (wstrb),   .wvalid  (wvalid),  .wready  (wready),
        .bresp   (bresp),   .bvalid  (bvalid),  .bready  (bready),
        .araddr  (araddr),  .arvalid (arvalid), .arready (arready),
        .rdata   (rdata),   .rresp   (rresp),   .rvalid  (rvalid),  .rready  (rready)
    );

    int        pass_count = 0;
    int        fail_count = 0;
    logic [1:0] last_bresp;
    logic [1:0] last_rresp;

    // ---------------------------------------------------------------
    // axi_write — simultaneous AW + W
    // ---------------------------------------------------------------
    task automatic axi_write(
        input logic [31:0] addr,
        input logic [31:0] data,
        input logic [ 3:0] wstrb_in
    );
        int timeout;
        @(negedge aclk);
        awaddr = addr;  awvalid = 1'b1;
        wdata  = data;  wstrb   = wstrb_in; wvalid = 1'b1;
        timeout = 0;
        @(posedge aclk);
        while (!awready || !wready) begin
            if (++timeout > 100) $fatal(1, "[FATAL] axi_write awready/wready addr=0x%08X", addr);
            @(posedge aclk);
        end
        @(negedge aclk);
        awvalid = 1'b0; wvalid = 1'b0; bready = 1'b1;
        timeout = 0;
        @(posedge aclk);
        while (!bvalid) begin
            if (++timeout > 100) $fatal(1, "[FATAL] axi_write bvalid addr=0x%08X", addr);
            @(posedge aclk);
        end
        last_bresp = bresp;
        @(negedge aclk);
        bready = 1'b0;
    endtask

    // ---------------------------------------------------------------
    // axi_write_aw_first — AW channel only, then W channel
    //   Tests W_IDLE -> W_WAIT_W -> W_BRESP path in the RTL FSM.
    // ---------------------------------------------------------------
    task automatic axi_write_aw_first(
        input logic [31:0] addr,
        input logic [31:0] data,
        input logic [ 3:0] wstrb_in
    );
        int timeout;
        // Phase 1: drive AW only
        @(negedge aclk);
        awaddr = addr; awvalid = 1'b1; wvalid = 1'b0;
        timeout = 0;
        @(posedge aclk);
        while (!awready) begin
            if (++timeout > 100) $fatal(1, "[FATAL] aw_first awready addr=0x%08X", addr);
            @(posedge aclk);
        end
        // Phase 2: drive W only — DUT is in W_WAIT_W, wready is still 1
        @(negedge aclk);
        awvalid = 1'b0; wdata = data; wstrb = wstrb_in; wvalid = 1'b1;
        timeout = 0;
        @(posedge aclk);
        while (!wready) begin
            if (++timeout > 100) $fatal(1, "[FATAL] aw_first wready addr=0x%08X", addr);
            @(posedge aclk);
        end
        // Phase 3: collect response
        @(negedge aclk);
        wvalid = 1'b0; bready = 1'b1;
        timeout = 0;
        @(posedge aclk);
        while (!bvalid) begin
            if (++timeout > 100) $fatal(1, "[FATAL] aw_first bvalid addr=0x%08X", addr);
            @(posedge aclk);
        end
        last_bresp = bresp;
        @(negedge aclk);
        bready = 1'b0;
    endtask

    // ---------------------------------------------------------------
    // axi_write_w_first — W channel only, then AW channel
    //   Tests W_IDLE -> W_WAIT_A -> W_BRESP path in the RTL FSM.
    // ---------------------------------------------------------------
    task automatic axi_write_w_first(
        input logic [31:0] addr,
        input logic [31:0] data,
        input logic [ 3:0] wstrb_in
    );
        int timeout;
        // Phase 1: drive W only
        @(negedge aclk);
        wdata = data; wstrb = wstrb_in; wvalid = 1'b1; awvalid = 1'b0;
        timeout = 0;
        @(posedge aclk);
        while (!wready) begin
            if (++timeout > 100) $fatal(1, "[FATAL] w_first wready addr=0x%08X", addr);
            @(posedge aclk);
        end
        // Phase 2: drive AW only — DUT is in W_WAIT_A, awready is still 1
        @(negedge aclk);
        wvalid = 1'b0; awaddr = addr; awvalid = 1'b1;
        timeout = 0;
        @(posedge aclk);
        while (!awready) begin
            if (++timeout > 100) $fatal(1, "[FATAL] w_first awready addr=0x%08X", addr);
            @(posedge aclk);
        end
        // Phase 3: collect response
        @(negedge aclk);
        awvalid = 1'b0; bready = 1'b1;
        timeout = 0;
        @(posedge aclk);
        while (!bvalid) begin
            if (++timeout > 100) $fatal(1, "[FATAL] w_first bvalid addr=0x%08X", addr);
            @(posedge aclk);
        end
        last_bresp = bresp;
        @(negedge aclk);
        bready = 1'b0;
    endtask

    // ---------------------------------------------------------------
    // axi_read
    // ---------------------------------------------------------------
    task automatic axi_read(input logic [31:0] addr, output logic [31:0] rd);
        int timeout;
        @(negedge aclk);
        araddr = addr; arvalid = 1'b1; rready = 1'b0;
        timeout = 0;
        @(posedge aclk);
        while (!arready) begin
            if (++timeout > 100) $fatal(1, "[FATAL] axi_read arready addr=0x%08X", addr);
            @(posedge aclk);
        end
        @(negedge aclk);
        arvalid = 1'b0; rready = 1'b1;
        timeout = 0;
        @(posedge aclk);
        while (!rvalid) begin
            if (++timeout > 100) $fatal(1, "[FATAL] axi_read rvalid addr=0x%08X", addr);
            @(posedge aclk);
        end
        rd = rdata; last_rresp = rresp;
        @(negedge aclk);
        rready = 1'b0;
    endtask

    // ---------------------------------------------------------------
    // check_eq — hard: $fatal on mismatch
    // ---------------------------------------------------------------
    task automatic check_eq(input logic [31:0] got, exp, input string label);
        if (got === exp) begin
            $display("[PASS] %-42s  got=0x%08X", label, got);
            pass_count++;
        end else begin
            $display("[FAIL] %-42s  got=0x%08X  exp=0x%08X", label, got, exp);
            fail_count++;
            $fatal(1, "[FATAL] check_eq failed");
        end
    endtask

    // ---------------------------------------------------------------
    // check_resp — hard: $fatal on mismatch
    // ---------------------------------------------------------------
    task automatic check_resp(input logic [1:0] got, exp, input string label);
        if (got === exp) begin
            $display("[PASS] %-42s  resp=2'b%02b", label, got);
            pass_count++;
        end else begin
            $display("[FAIL] %-42s  got=2'b%02b  exp=2'b%02b", label, got, exp);
            fail_count++;
            $fatal(1, "[FATAL] check_resp failed");
        end
    endtask

    // ---------------------------------------------------------------
    // check_resp_note — soft: increments fail_count but no $fatal.
    // Used only for known RTL limitations so the sim runs to completion.
    // ---------------------------------------------------------------
    task automatic check_resp_note(input logic [1:0] got, exp, input string label);
        if (got === exp) begin
            $display("[PASS] %-42s  resp=2'b%02b", label, got);
            pass_count++;
        end else begin
            $display("[FAIL] %-42s  got=2'b%02b  exp=2'b%02b  [RTL_LIMITATION]",
                     label, got, exp);
            fail_count++;
            // intentionally no $fatal — RTL limitation, simulation continues
        end
    endtask

    // ---------------------------------------------------------------
    // Stimulus
    // ---------------------------------------------------------------
    logic [31:0] rd;

    initial begin
        $dumpfile("../logs/axi_lite_regfile_tb.vcd");
        $dumpvars(0, axi_lite_regfile_tb);

        awvalid = 1'b0; awaddr = '0;
        wvalid  = 1'b0; wdata  = '0; wstrb = '0;
        bready  = 1'b0;
        arvalid = 1'b0; araddr = '0;
        rready  = 1'b0;

        aresetn = 1'b0;
        repeat (8) @(posedge aclk);
        aresetn = 1'b1;
        repeat (2) @(posedge aclk);
        $display("[CHK] t=%0t  phase=reset_release", $time);

        // ============================================================
        // Test 1 – reset defaults + rresp (regression)
        // ============================================================
        $display("[INFO] Test 1: reset defaults");
        for (int i = 0; i < 4; i++) begin
            axi_read(i * 4, rd);
            check_eq  (rd,          32'h0,   $sformatf("reset_default reg[%0d]",    i));
            check_resp(last_rresp,  2'b00,   $sformatf("rresp OKAY reset reg[%0d]", i));
        end

        // ============================================================
        // Test 2 – write all-ones, check bresp + rresp (regression)
        // ============================================================
        $display("[CHK] t=%0t  phase=write_allones", $time);
        $display("[INFO] Test 2: write all-ones + bresp/rresp");
        for (int i = 0; i < 4; i++) begin
            axi_write(i * 4, 32'hFFFF_FFFF, 4'hF);
            check_resp(last_bresp, 2'b00, $sformatf("bresp OKAY allones reg[%0d]", i));
            axi_read (i * 4, rd);
            check_eq  (rd,         32'hFFFF_FFFF, $sformatf("allones reg[%0d]",         i));
            check_resp(last_rresp, 2'b00,          $sformatf("rresp OKAY allones reg[%0d]", i));
        end

        // ============================================================
        // Test 3 – unique values + bresp/rresp (regression)
        // ============================================================
        $display("[CHK] t=%0t  phase=write_unique", $time);
        $display("[INFO] Test 3: unique values");
        for (int i = 0; i < 4; i++) begin
            axi_write(i * 4, 32'hA5A5_0000 | i, 4'hF);
            check_resp(last_bresp, 2'b00, $sformatf("bresp OKAY unique reg[%0d]", i));
        end
        for (int i = 0; i < 4; i++) begin
            axi_read(i * 4, rd);
            check_eq  (rd,         32'hA5A5_0000 | i, $sformatf("unique reg[%0d]",         i));
            check_resp(last_rresp, 2'b00,              $sformatf("rresp OKAY unique reg[%0d]", i));
        end

        // ============================================================
        // Test 4 – write all-zeros + bresp/rresp (regression)
        // ============================================================
        $display("[CHK] t=%0t  phase=write_allzeros", $time);
        $display("[INFO] Test 4: write all-zeros");
        for (int i = 0; i < 4; i++) begin
            axi_write(i * 4, 32'h0, 4'hF);
            check_resp(last_bresp, 2'b00, $sformatf("bresp OKAY allzeros reg[%0d]", i));
            axi_read (i * 4, rd);
            check_eq  (rd,         32'h0, $sformatf("allzeros reg[%0d]",              i));
            check_resp(last_rresp, 2'b00, $sformatf("rresp OKAY allzeros reg[%0d]",   i));
        end

        // ============================================================
        // Test 5 – partial WSTRB byte-lane writes
        // Byte mapping: wstrb[0]→bits[7:0], [1]→[15:8], [2]→[23:16], [3]→[31:24]
        // ============================================================
        $display("[CHK] t=%0t  phase=wstrb", $time);
        $display("[INFO] Test 5: partial WSTRB byte-lane writes on reg[0]");

        axi_write(32'h00, 32'hFFFF_FFFF, 4'hF);   // seed: all-ones
        check_resp(last_bresp, 2'b00, "bresp OKAY wstrb seed");

        // wstrb=0001 clears byte0 → expect 0xFFFF_FF00
        axi_write(32'h00, 32'h0000_0000, 4'b0001);
        check_resp(last_bresp, 2'b00, "bresp OKAY wstrb=0001");
        axi_read(32'h00, rd);
        check_eq  (rd,         32'hFFFF_FF00, "wstrb=0001: byte0 cleared");
        check_resp(last_rresp, 2'b00,         "rresp OKAY wstrb=0001 read");

        // wstrb=1000 sets byte3 to 0xAB → expect 0xABFF_FF00
        axi_write(32'h00, 32'hAB00_0000, 4'b1000);
        check_resp(last_bresp, 2'b00, "bresp OKAY wstrb=1000");
        axi_read(32'h00, rd);
        check_eq  (rd,         32'hABFF_FF00, "wstrb=1000: byte3 set to 0xAB");
        check_resp(last_rresp, 2'b00,         "rresp OKAY wstrb=1000 read");

        // wstrb=0110 updates bytes 1+2 → expect 0xAB34_1200
        // data=0x0034_1200: byte2=0x34, byte1=0x12
        axi_write(32'h00, 32'h0034_1200, 4'b0110);
        check_resp(last_bresp, 2'b00, "bresp OKAY wstrb=0110");
        axi_read(32'h00, rd);
        check_eq  (rd,         32'hAB34_1200, "wstrb=0110: bytes1+2 updated");
        check_resp(last_rresp, 2'b00,         "rresp OKAY wstrb=0110 read");

        axi_write(32'h00, 32'h0, 4'hF);   // clean up reg[0]

        // ============================================================
        // Test 6 – AW-before-W: exercises W_IDLE → W_WAIT_W → W_BRESP
        // ============================================================
        $display("[CHK] t=%0t  phase=aw_before_w", $time);
        $display("[INFO] Test 6: AW-before-W transaction (W_WAIT_W path)");

        axi_write_aw_first(32'h04, 32'hDEAD_BEEF, 4'hF);
        check_resp(last_bresp, 2'b00, "bresp OKAY aw_before_w reg[1]");
        axi_read(32'h04, rd);
        check_eq  (rd,         32'hDEAD_BEEF, "aw_before_w readback reg[1]");
        check_resp(last_rresp, 2'b00,         "rresp OKAY aw_before_w reg[1]");
        axi_write(32'h04, 32'h0, 4'hF);
        check_resp(last_bresp, 2'b00, "bresp OKAY aw_before_w cleanup");

        // ============================================================
        // Test 7 – W-before-AW: exercises W_IDLE → W_WAIT_A → W_BRESP
        // ============================================================
        $display("[CHK] t=%0t  phase=w_before_aw", $time);
        $display("[INFO] Test 7: W-before-AW transaction (W_WAIT_A path)");

        axi_write_w_first(32'h08, 32'hCAFE_F00D, 4'hF);
        check_resp(last_bresp, 2'b00, "bresp OKAY w_before_aw reg[2]");
        axi_read(32'h08, rd);
        check_eq  (rd,         32'hCAFE_F00D, "w_before_aw readback reg[2]");
        check_resp(last_rresp, 2'b00,         "rresp OKAY w_before_aw reg[2]");
        axi_write(32'h08, 32'h0, 4'hF);
        check_resp(last_bresp, 2'b00, "bresp OKAY w_before_aw cleanup");

        // ============================================================
        // Test 8 – invalid address 0x10 (RTL limitation check)
        //
        // RTL uses awaddr[3:2] as the 2-bit register index. For address 0x10:
        //   0x10[3:2] = 2'b00  → silently aliases to reg[0]
        // AXI spec requires SLVERR (2'b10) for accesses to unmapped addresses.
        // The RTL never drives bresp or rresp to anything other than 2'b00
        // (reset value, never updated). This is an RTL limitation.
        //
        // check_resp_note() is used here: logs [FAIL][RTL_LIMITATION] but does
        // not abort, so the alias side-effect can also be observed.
        // ============================================================
        $display("[CHK] t=%0t  phase=invalid_addr", $time);
        $display("[INFO] Test 8: invalid address 0x10 — RTL limitation: no addr decode");

        // Set reg[0] to a known value so the alias effect is detectable
        axi_write(32'h00, 32'hAAAA_AAAA, 4'hF);
        check_resp(last_bresp, 2'b00, "bresp OKAY pre-seed reg[0]");

        // Write to unmapped address 0x10
        axi_write(32'h10, 32'h1234_5678, 4'hF);
        $display("[NOTE] 0x10 write  bresp=2'b%02b  (OKAY=00, SLVERR=10)", last_bresp);
        check_resp_note(last_bresp, 2'b10, "0x10 write: SLVERR expected per AXI spec");

        // Read from unmapped address 0x10
        axi_read(32'h10, rd);
        $display("[NOTE] 0x10 read   rdata=0x%08X  rresp=2'b%02b", rd, last_rresp);
        check_resp_note(last_rresp, 2'b10, "0x10 read:  SLVERR expected per AXI spec");

        // Show alias side-effect: the write to 0x10 modified reg[0]
        axi_read(32'h00, rd);
        $display("[NOTE] reg[0]      value=0x%08X  (expect 0x12345678 if alias, 0xAAAAAAAA if SLVERR)", rd);

        axi_write(32'h00, 32'h0, 4'hF);   // clean up

        // ============================================================
        // Summary
        // ============================================================
        if (fail_count == 0) begin
            $display("[PASS] axi_lite_regfile_tb  %0d/%0d checks passed",
                     pass_count, pass_count);
        end else begin
            $display("[FAIL] axi_lite_regfile_tb  %0d/%0d checks passed  (%0d failure(s))",
                     pass_count, pass_count + fail_count, fail_count);
        end
        $display("[DONE] simulation complete at t=%0t", $time);
        $finish;
    end

endmodule
