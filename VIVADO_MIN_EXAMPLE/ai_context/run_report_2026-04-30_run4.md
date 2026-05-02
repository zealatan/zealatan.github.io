# Verification Run Report — 2026-04-30 (Run 4: Extended Invalid-Address Coverage)

## Changed Files

- `tb/axi_lite_regfile_tb.sv`: Added Tests 12, 13, 14 — invalid-address sweep across three write orderings
- `ai_context/verification_plan.md`: Status updated; Tests 12–14 added to table; check count updated to 133

## Tests Added

### Test 12 — Invalid-address sweep via simultaneous AW+W (W_IDLE path)

Three invalid addresses (0x14, 0xFF, 0x8000_0000) tested with same-cycle AW+W presentation.
For each address: seed canary to the aliased register, write to invalid address, verify BRESP=SLVERR,
read back via invalid address (RRESP=SLVERR, rdata=0x0), read back canary register (unmodified).

| Address | Canary reg | BRESP | RRESP | rdata | Register modified? |
|---------|-----------|-------|-------|-------|-------------------|
| 0x14 | reg[1]=0x5A5A1400 | SLVERR | SLVERR | 0x0 | No |
| 0xFF | reg[3]=0x5A5AFF00 | SLVERR | SLVERR | 0x0 | No |
| 0x8000_0000 | reg[0]=0x5A5A8000 | SLVERR | SLVERR | 0x0 | No |

15 checks total. All PASS.

### Test 13 — AW-before-W at invalid addresses (W_WAIT_W SLVERR path)

Three invalid addresses tested via `axi_write_aw_first` — AW presented one cycle before W,
exercising the W_WAIT_W FSM state. Guard on `aw_latch[31:4]` fires when W arrives.
Only BRESP and canary-register readback checked (no R-channel in this ordering test).

| Address | Canary reg | BRESP | Register modified? |
|---------|-----------|-------|-------------------|
| 0x14 | reg[1]=0x5A5A1413 | SLVERR | No |
| 0xFF | reg[3]=0x5A5AFF13 | SLVERR | No |
| 0x8000_0000 | reg[0]=0x5A5A8013 | SLVERR | No |

9 checks total. All PASS.

### Test 14 — W-before-AW at invalid addresses (W_WAIT_A SLVERR path)

Three invalid addresses tested via `axi_write_w_first` — W presented one cycle before AW,
exercising the W_WAIT_A FSM state. Guard on `awaddr[31:4]` fires when AW arrives.

| Address | Canary reg | BRESP | Register modified? |
|---------|-----------|-------|-------------------|
| 0x14 | reg[1]=0x5A5A1414 | SLVERR | No |
| 0xFF | reg[3]=0x5A5AFF14 | SLVERR | No |
| 0x8000_0000 | reg[0]=0x5A5A8014 | SLVERR | No |

9 checks total. All PASS.

## Simulation Command

```
bash scripts/run_axi_regfile_sim.sh
```

## Simulation Attempts

**1 of 3.** Clean compile, clean elaboration, no hangs, completed in **3720 ns**.  
Script exit code: **0** (no `[FAIL]` or `FATAL` lines found by CI gate).

## Final Pass/Fail Count

```
[PASS] axi_lite_regfile_tb  133/133 checks passed
[DONE] simulation complete at t=3720000
[PASS] No failures detected.
```

| Metric | Run 3 (baseline) | Run 4 (this run) |
|--------|-----------------|-----------------|
| Total checks | 100 | 133 |
| PASS | 100 | **133** |
| FAIL | 0 | **0** |
| Hard `$fatal` | 0 | 0 |
| CI exit code | 0 | **0** |

## Evidence for Each Invalid-Address SLVERR Path

### W_IDLE simultaneous path (Test 12)
```
[PASS]                     inv 0x14: BRESP=SLVERR  resp=2'b10
[PASS]                     inv 0x14: RRESP=SLVERR  resp=2'b10
[PASS]                        inv 0x14: rdata=0x0  got=0x00000000
[PASS]                inv 0x14: reg[1] unmodified  got=0x5a5a1400
[PASS]               inv 0xFF: BRESP=SLVERR  resp=2'b10
[PASS]               inv 0xFF: RRESP=SLVERR  resp=2'b10
[PASS]                  inv 0xFF: rdata=0x0  got=0x00000000
[PASS]          inv 0xFF: reg[3] unmodified  got=0x5a5aff00
[PASS]               inv 0x80000000: BRESP=SLVERR  resp=2'b10
[PASS]               inv 0x80000000: RRESP=SLVERR  resp=2'b10
[PASS]                  inv 0x80000000: rdata=0x0  got=0x00000000
[PASS]          inv 0x80000000: reg[0] unmodified  got=0x5a5a8000
```

### W_WAIT_W path (Test 13 — AW-before-W)
```
[PASS]            aw_first inv 0x14: BRESP=SLVERR  resp=2'b10
[PASS]       aw_first inv 0x14: reg[1] unmodified  got=0x5a5a1413
[PASS]            aw_first inv 0xFF: BRESP=SLVERR  resp=2'b10
[PASS]       aw_first inv 0xFF: reg[3] unmodified  got=0x5a5aff13
[PASS]      aw_first inv 0x80000000: BRESP=SLVERR  resp=2'b10
[PASS] aw_first inv 0x80000000: reg[0] unmodified  got=0x5a5a8013
```

### W_WAIT_A path (Test 14 — W-before-AW)
```
[PASS]             w_first inv 0x14: BRESP=SLVERR  resp=2'b10
[PASS]        w_first inv 0x14: reg[1] unmodified  got=0x5a5a1414
[PASS]             w_first inv 0xFF: BRESP=SLVERR  resp=2'b10
[PASS]        w_first inv 0xFF: reg[3] unmodified  got=0x5a5aff14
[PASS]       w_first inv 0x80000000: BRESP=SLVERR  resp=2'b10
[PASS]  w_first inv 0x80000000: reg[0] unmodified  got=0x5a5a8014
```

## RTL Modification Required?

**No.** The existing address-decode guard (`addr[31:4] == 28'h0`) correctly rejects all three
new invalid addresses across all three write orderings. No RTL changes were made.

## All Pre-Existing Checks Preserved

Tests 1–11 (100 checks) are all PASS. No regressions introduced.

## Remaining Limitations

None identified.

## Recommended Next Experiment

**Option A — Smoke testbench (`tb/smoke_tb.sv`):**  
Verify post-reset idle state: `awready=1`, `wready=1`, `arready=1`, `bvalid=0`, `rvalid=0`.
Listed as pending in `verification_plan.md §1`. Requires a new script.

**Option B — WSTRB=0 zero-strobe test:**  
Send `wstrb=4'b0000` to a valid register and verify the register is unchanged and `bresp=OKAY`.
Tests the `do_write` task with no byte lanes enabled.

**Option C — AW-first and W-first backpressure variants:**  
Add `axi_write_aw_first_bp` and `axi_write_w_first_bp` variants to verify that W_WAIT_W and
W_WAIT_A FSM states hold their latched data correctly under B-channel backpressure (bready held
low for N cycles after bvalid rises in W_BRESP state).
