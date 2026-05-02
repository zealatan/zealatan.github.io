# Verification Run Report — 2026-04-30 (Run 2)

## Changed Files

- `tb/axi_lite_regfile_tb.sv`:
  - Added task `axi_write_bp(addr, data, wstrb, bp_cycles)` — simultaneous AW+W with B-channel backpressure
  - Added task `axi_read_bp(addr, rd, bp_cycles)` — AR/R with R-channel backpressure
  - Added Test 10: B-channel backpressure (bp=3 and bp=7 cycles)
  - Added Test 11: R-channel backpressure (bp=3 and bp=5 cycles)
- `ai_context/verification_plan.md`: Updated status table and check count

## Tests Added

### Test 10 — B-channel backpressure
Writes to reg[0] and reg[1] using `axi_write_bp`. After the DUT raises `bvalid`, `bready` is
held low for N cycles before the master accepts the response.

| Sub-test | Reg | Address | Data | bp_cycles | Result |
|----------|-----|---------|------|-----------|--------|
| bp=3 | reg[0] | 0x00 | 0xBA5EB000 | 3 | PASS |
| bp=7 | reg[1] | 0x04 | 0xC0DEF00D | 7 | PASS |

Readback after acceptance confirmed correct data in both registers. 8 checks total.

### Test 11 — R-channel backpressure
Reads from reg[2] and reg[3] using `axi_read_bp`. After the DUT raises `rvalid`, `rready` is
held low for N cycles; the slave must hold `rvalid` and `rdata` stable throughout.

| Sub-test | Reg | Address | Expected data | bp_cycles | Result |
|----------|-----|---------|--------------|-----------|--------|
| bp=3 | reg[2] | 0x08 | 0xF00DCAFE | 3 | PASS |
| bp=5 | reg[3] | 0x0C | 0xDEAD0001 | 5 | PASS |

Data captured after the stall period was correct. 8 checks total.

### Task design notes

Both backpressure tasks use the same negedge-drive / posedge-sample discipline as the
existing tasks. Every wait loop in both tasks has a 100-cycle timeout that calls `$fatal`.

```
axi_write_bp flow:
  negedge: drive awvalid=1, wvalid=1
  posedge: sample awready && wready (timeout guard)
  negedge: deassert, keep bready=0
  posedge: wait for bvalid (timeout guard)
  posedge ×N: stall with bvalid=1, bready=0  (N = bp_cycles)
  negedge: assert bready=1
  posedge: sample bresp, slave transitions W_BRESP→W_IDLE

axi_read_bp flow:
  negedge: drive arvalid=1, rready=0
  posedge: sample arready (timeout guard)
  negedge: deassert arvalid, keep rready=0
  posedge: wait for rvalid (timeout guard)
  posedge ×N: stall with rvalid=1, rready=0  (N = bp_cycles)
  negedge: assert rready=1
  posedge: sample rdata, rresp; slave transitions R_RVALID→R_IDLE
```

## Commands Executed

1. `bash scripts/run_axi_regfile_sim.sh`
   - xvlog: compile `rtl/axi_lite_regfile.v` + `tb/axi_lite_regfile_tb.sv`
   - xelab: elaborate `axi_lite_regfile_tb`
   - xsim: run-all

## Simulation Attempts

**1 of 3** — succeeded on first attempt. No compile errors, no elaboration errors, no hangs.
Simulation completed in **2490 ns**.

## Final Pass/Fail Status

| Metric | Value |
|--------|-------|
| Total checks | 98 |
| PASS | 96 |
| FAIL `[RTL_LIMITATION]` | 2 |
| Hard failures (`$fatal`) | 0 |
| Simulation hangs | 0 |
| Script exit code | 1 (CI gate triggers on `[FAIL]` lines) |

Relevant log excerpt (new tests only):
```
[CHK] t=1910000  phase=b_backpressure
[INFO] Test 10: B-channel backpressure (bp=3 and bp=7)
[PASS]             bresp OKAY bp_write bp3 reg[0]  resp=2'b00
[PASS]             bresp OKAY bp_write bp7 reg[1]  resp=2'b00
[PASS]                   bp_write readback reg[0]  got=0xba5eb000
[PASS]        rresp OKAY bp_write readback reg[0]  resp=2'b00
[PASS]                   bp_write readback reg[1]  got=0xc0def00d
[PASS]        rresp OKAY bp_write readback reg[1]  resp=2'b00
[PASS]         bresp OKAY bp_write cleanup reg[0]  resp=2'b00
[PASS]         bresp OKAY bp_write cleanup reg[1]  resp=2'b00
[CHK] t=2210000  phase=r_backpressure
[INFO] Test 11: R-channel backpressure (bp=3 and bp=5)
[PASS]            bresp OKAY bp_read setup reg[2]  resp=2'b00
[PASS]            bresp OKAY bp_read setup reg[3]  resp=2'b00
[PASS]                    bp_read bp3 reg[2] data  got=0xf00dcafe
[PASS]              rresp OKAY bp_read bp3 reg[2]  resp=2'b00
[PASS]                    bp_read bp5 reg[3] data  got=0xdead0001
[PASS]              rresp OKAY bp_read bp5 reg[3]  resp=2'b00
[PASS]          bresp OKAY bp_read cleanup reg[2]  resp=2'b00
[PASS]          bresp OKAY bp_read cleanup reg[3]  resp=2'b00
[FAIL] axi_lite_regfile_tb  96/98 checks passed  (2 failure(s))
[DONE] simulation complete at t=2490000
```

Known RTL-limitation failures (unchanged from previous run):
```
[FAIL]   0x10 write: SLVERR expected per AXI spec  got=2'b00  exp=2'b10  [RTL_LIMITATION]
[FAIL]   0x10 read:  SLVERR expected per AXI spec  got=2'b00  exp=2'b10  [RTL_LIMITATION]
[NOTE] reg[0]      value=0x12345678  (expect 0x12345678 if alias, 0xAAAAAAAA if SLVERR)
```

## Failure Classification

| Failure | Classification | Evidence |
|---------|----------------|----------|
| `0x10 write: SLVERR expected` | **RTL protocol limitation** | bresp=2'b00 (OKAY) instead of 2'b10 (SLVERR); write to 0x10 silently aliases to reg[0] via awaddr[3:2]=2'b00 |
| `0x10 read: SLVERR expected` | **RTL protocol limitation** | rresp=2'b00 (OKAY) instead of 2'b10 (SLVERR); rdata=0x12345678 confirms alias |

No TB bugs, script bugs, or unexpected RTL functional failures were found.

## RTL Modification Required

**Yes** — to fix the address-decode limitation. Proposed minimal patch (NOT applied):

```verilog
// In every write-FSM branch that commits a write, add an address-range guard.
// Example for the W_IDLE simultaneous-AW+W branch:
if (awvalid && wvalid) begin
    if (awaddr[31:4] != 28'h0) begin
        bresp  <= 2'b10;          // SLVERR — address out of range
    end else begin
        do_write(awaddr[3:2], wdata, wstrb);
        bresp  <= 2'b00;
    end
    awready <= 1'b0; wready <= 1'b0; bvalid <= 1'b1;
    wstate  <= W_BRESP;
end
// Same guard needed in W_WAIT_W and W_WAIT_A states (use aw_latch[31:4]).
// Read FSM: same guard for araddr[31:4] != 0 → rresp = 2'b10, rdata = 32'h0.
```

Applying this fix requires explicit user approval and will also change `check_resp_note`
→ `check_resp` for Test 8, expecting 4 checks to PASS instead of FAIL.

## Recommended Next Experiment

**Option A (requires RTL patch approval):** Apply the address-decode fix, update Test 8 to use
`check_resp` with `exp=2'b10`, and verify 98/98 PASS.

**Option B (no RTL change):** Add `tb/smoke_tb.sv` (pending in verification_plan.md §1):
check that after reset, `awready=1`, `wready=1`, `arready=1`, `bvalid=0`, `rvalid=0`.

**Option C:** Increase backpressure aggressiveness — add `axi_write_aw_first_bp` and
`axi_write_w_first_bp` variants to verify that the `W_WAIT_W` and `W_WAIT_A` FSM paths
also hold their state correctly under B-channel backpressure.
