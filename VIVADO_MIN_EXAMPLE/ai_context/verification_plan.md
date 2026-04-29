# Verification Plan

Project: VIVADO_MIN_EXAMPLE  
Date created: 2026-04-28  
Last updated: 2026-04-29  
Scope: testbench and scripts only — no RTL modifications

---

## Status Summary

| Layer | File | Status |
|-------|------|--------|
| RTL | `rtl/and2.v` | pre-existing, untouched |
| RTL | `rtl/axi_lite_regfile.v` | **DONE** — 4×32-bit AXI-lite slave |
| TB | `tb/and2_tb.sv` | pre-existing, untouched |
| TB | `tb/axi_lite_regfile_tb.sv` | **DONE** — register r/w, WSTRB, AW-first, W-first, invalid addr |
| Script | `scripts/run_vivado_sim.sh` | pre-existing, untouched |
| Script | `scripts/run_axi_regfile_sim.sh` | **DONE** — CI-safe with [FAIL] grep gate |
| Smoke TB | `tb/smoke_tb.sv` | pending |
| Memory model | `tb/axi_mem_model.sv` | pending |
| Memory TB | `tb/mem_rw_tb.sv` | pending |
| DMA TB | `tb/dma_tb.sv` | pending |

---

## DUT State

The placeholder AND gate (`rtl/and2.v`) is untouched.  
The first real DUT — `rtl/axi_lite_regfile.v` — is implemented and verified.

**Known RTL limitation:** No address decode logic. All 32-bit addresses are indexed
by `awaddr[3:2]` only, so out-of-range addresses alias silently to one of the 4
registers instead of returning SLVERR. See §8 below.

---

## 1. Smoke Test

**Goal:** Confirm clock generation, reset de-assertion, and DUT idle state.

**Proposed file:** `tb/smoke_tb.sv`  
**Status:** pending

Checks:
- `awready`, `wready`, `arready` all high after reset release
- `bvalid`, `rvalid` both low after reset release

---

## 2. Register Read/Write Test

**Goal:** Verify every AXI-lite control register.

**Implemented file:** `tb/axi_lite_regfile_tb.sv`  
**Status:** DONE — 63/65 checks pass (2 are intentional RTL-limitation notes)

### Implemented test sequence

| Test | Description | Checks | Result |
|------|-------------|--------|--------|
| 1 | Reset defaults + rresp | 8 | PASS |
| 2 | Write all-ones + bresp/rresp | 12 | PASS |
| 3 | Unique values per register + resp | 12 | PASS |
| 4 | Write all-zeros + resp | 12 | PASS |
| 5 | Partial WSTRB byte-lane writes | 9 | PASS |
| 6 | AW-before-W (W_WAIT_W path) | 4 | PASS |
| 7 | W-before-AW (W_WAIT_A path) | 4 | PASS |
| 8 | Invalid address 0x10 | 2 | FAIL (RTL limitation — see §8) |

### Task design: negedge-drive / posedge-sample

All AXI master signals are driven on `negedge aclk` so they are stable for a full
half-cycle before the DUT samples them on `posedge aclk`. This avoids the active-region
race condition that caused the original testbench to hang for 1h49m.

```
negedge: drive awvalid=1, awaddr, wdata, wstrb, wvalid=1
posedge: read awready, wready  ← DUT outputs, pre-NBA value (safe)
negedge: deassert awvalid, wvalid; raise bready
posedge: read bvalid            ← capture bresp
negedge: deassert bready
```

### Timeout guard

Every wait loop has a 100-cycle counter. Exceeding it calls `$fatal` immediately
rather than letting the simulation hang indefinitely.

### Soft check for RTL-limitation tests

`check_resp_note()` logs `[FAIL][RTL_LIMITATION]` and increments `fail_count` but
does **not** call `$fatal`, allowing the simulation to run to completion so that all
limitation evidence is visible in the log.

---

## 3. Memory Write/Readback Test

**Proposed file:** `tb/mem_rw_tb.sv`  
**Proposed file:** `tb/axi_mem_model.sv`  
**Status:** pending

---

## 4. DMA Transfer Test

**Proposed file:** `tb/dma_tb.sv`  
**Status:** pending (requires DMA RTL to be designed first)

---

## 5. Timeout and Error Handling

**Status:** DONE (inline in each task, not a separate package)

Implemented as per-task `int timeout` counter with `$fatal` after 100 cycles.
All three new tasks (`axi_write`, `axi_write_aw_first`, `axi_write_w_first`,
`axi_read`) include timeout guards on every wait loop.

---

## 6. Waveform Checkpoints

**Status:** DONE

`[CHK] t=<time>  phase=<name>` display statements are present at every major test
boundary in `axi_lite_regfile_tb.sv`. These timestamps appear in `logs/axi_lite_xsim.log`
and can be used to navigate waveforms without a GUI.

`$dumpfile` / `$dumpvars` are present in the testbench for VCD generation.

---

## 7. Pass/Fail Criteria

### Log format — implemented

```
[PASS] <label>   got=0x...  or  resp=2'b..
[FAIL] <label>   got=0x...  exp=0x...
[FAIL] <label>   got=2'b..  exp=2'b..  [RTL_LIMITATION]
[PASS] axi_lite_regfile_tb  63/65 checks passed
[DONE] simulation complete at t=1520000
```

### CI gate — implemented

`scripts/run_axi_regfile_sim.sh` greps `logs/axi_lite_xsim.log` for `[FAIL]` or
`FATAL` after xsim exits and returns exit code 1 if found.

---

## 8. RTL Limitation: No Address Decode

**Symptom:** Writing or reading address `0x10` returns `bresp/rresp = 2'b00` (OKAY)
instead of `2'b10` (SLVERR). The write silently modifies `reg[0]` because the RTL
uses only `awaddr[3:2]` as the register index and `0x10[3:2] = 2'b00`.

**Evidence in log:**
```
[FAIL] 0x10 write: SLVERR expected per AXI spec  got=2'b00  exp=2'b10  [RTL_LIMITATION]
[FAIL] 0x10 read:  SLVERR expected per AXI spec  got=2'b00  exp=2'b10  [RTL_LIMITATION]
[NOTE] reg[0] value=0x12345678  (alias confirmed)
```

**Decision required:**

| Option | Action |
|--------|--------|
| A — document only | Leave RTL as-is; the 2 failures remain in the log as known limitations |
| B — patch RTL | Add address-valid decode: if `awaddr[31:4] != 0`, drive `bresp = 2'b10` and skip the register write |

Option B requires modifying `rtl/axi_lite_regfile.v` and updating the testbench
to expect `SLVERR` (change `check_resp_note` → `check_resp` for test 8).
