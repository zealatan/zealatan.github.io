# Verification Run Report — 2026-04-30

## Changed Files

- `tb/axi_lite_regfile_tb.sv`: Added Test 5b (individual byte-lane isolation on reg[2]) and Test 9 (explicit same-cycle AW+W). All existing tests 1–8 preserved unchanged.

## Commands Executed

1. `bash scripts/run_axi_regfile_sim.sh`
   - xvlog: compile `rtl/axi_lite_regfile.v` + `tb/axi_lite_regfile_tb.sv`
   - xelab: elaborate `axi_lite_regfile_tb`
   - xsim: run-all with timeout-guarded stimulus

## Tests Added

### Test 5b — Individual byte-lane isolation on reg[2]
Seeds reg[2] = 0xFFFFFFFF, then applies four sequential single-byte writes:

| Sub-test | wstrb | wdata byte | Expected reg[2] | Result |
|----------|-------|-----------|-----------------|--------|
| byte 0 only | 4'b0001 | 0x11 | 0xFFFFFF11 | PASS |
| byte 1 only | 4'b0010 | 0x22 | 0xFFFF2211 | PASS |
| byte 2 only | 4'b0100 | 0x33 | 0xFF332211 | PASS |
| byte 3 only | 4'b1000 | 0x44 | 0x44332211 | PASS |

Each sub-test checks: `bresp=OKAY`, data readback exact, `rresp=OKAY` (3 checks × 4 lanes + 1 seed = 13 checks).

### Test 9 — Simultaneous AW+W (same-cycle)
Exercises the `W_IDLE → W_BRESP` direct path (both `awvalid` and `wvalid` asserted on the same posedge, no `W_WAIT_x` state visited).

| Check | Expected | Result |
|-------|----------|--------|
| `bresp OKAY same_cycle reg[3]` | 2'b00 | PASS |
| `same_cycle readback reg[3]` | 0xBEEFCAFE | PASS |
| `rresp OKAY same_cycle reg[3]` | 2'b00 | PASS |
| `bresp OKAY same_cycle cleanup` | 2'b00 | PASS |

## Result

**PASS (functional) / FAIL (CI gate)**

- 80/82 checks passed.
- 2 failures are pre-existing soft checks (`check_resp_note`) for the known RTL address-decode limitation (Test 8). They do NOT call `$fatal`; the simulation ran to completion.
- CI gate (`grep [FAIL]|FATAL`) triggers on these 2 lines and exits with code 1. This is expected behavior.

## Failure Classification

- **Category:** RTL bug (pre-existing, known)
- **Evidence:**
  - Address `0x10` write returns `bresp=2'b00` (OKAY), expected `2'b10` (SLVERR).
  - Address `0x10` read returns `rresp=2'b00` (OKAY), expected `2'b10` (SLVERR).
  - `reg[0]` reads back `0x12345678` after the 0x10 write → alias to `reg[0]` confirmed.
  - Root cause: RTL uses only `awaddr[3:2]` as register index; no out-of-range decode logic.

## RTL Modification Required

**Yes** — to fix the aliasing/SLVERR issue, `rtl/axi_lite_regfile.v` must be modified.

Proposed minimal patch (requires explicit approval before applying):

```verilog
// In write FSM — W_IDLE state, simultaneous AW+W branch:
if (awvalid && wvalid) begin
    if (awaddr[31:4] != 0) begin
        bresp  <= 2'b10;   // SLVERR — address out of range
    end else begin
        do_write(awaddr[3:2], wdata, wstrb);
        bresp  <= 2'b00;
    end
    awready <= 1'b0; wready <= 1'b0; bvalid <= 1'b1;
    wstate  <= W_BRESP;
end
// Similar guard needed in W_WAIT_W and W_WAIT_A states.
// Read FSM needs the same guard for araddr[31:4] != 0.
```

**This patch has NOT been applied. Awaiting user approval.**

## Pass/Fail Summary

| Test | Description | Checks | Result |
|------|-------------|--------|--------|
| 1 | Reset defaults + rresp | 8 | PASS |
| 2 | Write all-ones + bresp/rresp | 12 | PASS |
| 3 | Unique values per register + resp | 12 | PASS |
| 4 | Write all-zeros + resp | 12 | PASS |
| 5 | Partial WSTRB byte-lane writes (reg[0]) | 10 | PASS |
| 5b | Individual byte-lane isolation (reg[2]) | 13 | **NEW — PASS** |
| 6 | AW-before-W (W_WAIT_W path) | 4 | PASS |
| 7 | W-before-AW (W_WAIT_A path) | 4 | PASS |
| 8 | Invalid address 0x10 | 2 | FAIL [RTL_LIMITATION] |
| 9 | Same-cycle AW+W (W_IDLE→W_BRESP direct) | 4 | **NEW — PASS** |
| **Total** | | **82** | **80 PASS / 2 FAIL** |

## Next Recommended Test

**Option A (requires RTL patch approval):** Apply the address-decode patch above, update `check_resp_note` → `check_resp` for Test 8, rerun — expect 82/82 PASS.

**Option B (no RTL change):** Add a smoke testbench (`tb/smoke_tb.sv`) as listed in `verification_plan.md` §1 to verify post-reset idle state (`awready`, `wready`, `arready` all high; `bvalid`, `rvalid` both low).
