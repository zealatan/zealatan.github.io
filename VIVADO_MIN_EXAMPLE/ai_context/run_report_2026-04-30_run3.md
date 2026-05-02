# Verification Run Report — 2026-04-30 (Run 3: RTL Address-Decode Fix)

## Changed Files

- `rtl/axi_lite_regfile.v`: Address-decode guard added to write and read FSMs (approved patch)
- `tb/axi_lite_regfile_tb.sv`: Test 8 hardened — `check_resp_note` → `check_resp`; two new hard checks added
- `ai_context/verification_plan.md`: Status updated; §8 rewritten to reflect fix

## Minimal RTL Patch Summary

Six targeted edits to `rtl/axi_lite_regfile.v`; no other lines touched.

### Write FSM — W_IDLE (simultaneous AW+W)
```verilog
if (awvalid && wvalid) begin
    if (awaddr[31:4] == 28'h0) begin   // ← NEW: valid address guard
        do_write(awaddr[3:2], wdata, wstrb);
        bresp <= 2'b00;
    end else begin
        bresp <= 2'b10;                // ← NEW: SLVERR, skip write
    end
    awready <= 1'b0; wready <= 1'b0; bvalid <= 1'b1; wstate <= W_BRESP;
```

### Write FSM — W_WAIT_W (AW latched, W arrives late)
```verilog
if (aw_latch[31:4] == 28'h0) begin    // ← NEW: guard on latched address
    do_write(aw_latch[3:2], wdata, wstrb);
    bresp <= 2'b00;
end else begin
    bresp <= 2'b10;
end
```

### Write FSM — W_WAIT_A (W latched, AW arrives late)
```verilog
if (awaddr[31:4] == 28'h0) begin      // ← NEW: guard on live AW address
    do_write(awaddr[3:2], wd_latch, ws_latch);
    bresp <= 2'b00;
end else begin
    bresp <= 2'b10;
end
```

### Write FSM — W_BRESP (exit)
```verilog
bresp <= 2'b00;   // ← NEW: clear SLVERR after master accepts response
```

### Read FSM — R_IDLE
```verilog
if (araddr[31:4] == 28'h0) begin      // ← NEW: valid address guard
    rdata <= regs[araddr[3:2]];
    rresp <= 2'b00;
end else begin
    rdata <= 32'h0;                    // ← NEW: no data leak
    rresp <= 2'b10;                    // ← NEW: SLVERR
end
```

### Read FSM — R_RVALID (exit)
```verilog
rresp <= 2'b00;   // ← NEW: clear SLVERR after master accepts response
```

## DUT Interface Changed?

**No.** Port list, port widths, and port directions are identical to before.

## Simulation Command

```
bash scripts/run_axi_regfile_sim.sh
```

## Simulation Attempts

**1 of 3.** Clean compile, clean elaboration, no hangs, completed in **2490 ns**.  
Script exit code: **0** (no `[FAIL]` or `FATAL` lines found by CI gate).

## Final Pass/Fail Count

```
[PASS] axi_lite_regfile_tb  100/100 checks passed
[DONE] simulation complete at t=2490000
[PASS] No failures detected.
```

| Metric | Before fix | After fix |
|--------|-----------|-----------|
| Total checks | 98 | 100 |
| PASS | 96 | **100** |
| FAIL `[RTL_LIMITATION]` (soft) | 2 | **0** |
| Hard `$fatal` | 0 | 0 |
| CI exit code | 1 | **0** |

## Evidence That 0x10 No Longer Aliases to reg[0]

Relevant log excerpt from Test 8:

```
[CHK] t=1670000  phase=invalid_addr
[INFO] Test 8: invalid address 0x10 — BRESP/RRESP=SLVERR, no alias
[PASS]                 bresp OKAY pre-seed reg[0]  resp=2'b00
[PASS]                   0x10 write: BRESP=SLVERR  resp=2'b10
[PASS]                    0x10 read: RRESP=SLVERR  resp=2'b10
[PASS]    0x10 read: rdata=0x0 (no register leak)  got=0x00000000
[PASS]         0x10 write did not alias to reg[0]  got=0xaaaaaaaa
```

- `BRESP=SLVERR` — write to 0x10 correctly rejected
- `RRESP=SLVERR` — read from 0x10 correctly rejected
- `rdata=0x00000000` — no register content leaked
- `reg[0]=0xaaaaaaaa` — canary value intact; the write to 0x10 did not modify reg[0]

All pre-existing passing tests (Tests 1–7, 9–11) remain PASS.

## Remaining Limitations

None identified. The previously documented aliasing issue is fully resolved.

The `check_resp_note` task definition remains in the TB (not removed) for potential
future use with other DUT limitations, but is not called anywhere.

## Recommended Next Experiment

**Option A — Smoke testbench (`tb/smoke_tb.sv`):**  
Verify post-reset idle state: `awready=1`, `wready=1`, `arready=1`, `bvalid=0`, `rvalid=0`.
This is listed as pending in `verification_plan.md §1` and requires a new script.

**Option B — Extended invalid-address coverage:**  
Test additional out-of-range addresses (e.g., 0xFF, 0x14, 0x8000_0000) and both
AW-before-W and W-before-AW orderings at invalid addresses. This exercises the
W_WAIT_W and W_WAIT_A SLVERR paths with the new guard logic.

**Option C — WSTRB with zero strobe:**  
Send `wstrb=4'b0000` (no byte lanes enabled) to a valid register and verify that
the register is unchanged (no bytes written) and `bresp=OKAY` is returned.
