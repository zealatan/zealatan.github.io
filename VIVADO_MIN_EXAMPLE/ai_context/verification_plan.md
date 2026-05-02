# Verification Plan

Project: VIVADO_MIN_EXAMPLE  
Date created: 2026-04-28  
Last updated: 2026-04-30 (run 4 — extended invalid-address coverage)  
Scope: testbench, scripts, and approved RTL patch

---

## Status Summary

| Layer | File | Status |
|-------|------|--------|
| RTL | `rtl/and2.v` | pre-existing, untouched |
| RTL | `rtl/axi_lite_regfile.v` | **DONE** — 4×32-bit AXI-lite slave; address-decode fix applied |
| TB | `tb/and2_tb.sv` | pre-existing, untouched |
| TB | `tb/axi_lite_regfile_tb.sv` | **DONE** — register r/w, WSTRB, byte-lane isolation, AW-first, W-first, same-cycle, invalid addr sweep (3 addresses × 3 orderings), B/R backpressure |
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

**Address-decode fix applied (2026-04-30):** The RTL now checks `awaddr[31:4]==0`
and `araddr[31:4]==0`. Out-of-range accesses return SLVERR and do not modify
registers or leak register data. Valid addresses (0x00–0x0F) behave as before.

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
**Status:** DONE — 133/133 checks pass (0 failures; RTL address-decode fix verified; extended invalid-address coverage added)

### Implemented test sequence

| Test | Description | Checks | Result |
|------|-------------|--------|--------|
| 1 | Reset defaults + rresp | 8 | PASS |
| 2 | Write all-ones + bresp/rresp | 12 | PASS |
| 3 | Unique values per register + resp | 12 | PASS |
| 4 | Write all-zeros + resp | 12 | PASS |
| 5 | Partial WSTRB byte-lane writes (reg[0]) | 10 | PASS |
| 5b | Individual byte-lane isolation (reg[2]) | 13 | PASS |
| 6 | AW-before-W (W_WAIT_W path) | 4 | PASS |
| 7 | W-before-AW (W_WAIT_A path) | 4 | PASS |
| 8 | Invalid address 0x10 (SLVERR + no alias) | 5 | PASS (RTL fix applied) |
| 9 | Simultaneous AW+W same-cycle (W_IDLE→W_BRESP) | 4 | PASS |
| 10 | B-channel backpressure (bp=3 and bp=7) | 8 | PASS |
| 11 | R-channel backpressure (bp=3 and bp=5) | 8 | PASS |
| 12 | Invalid-addr sweep 0x14/0xFF/0x80000000 — W_IDLE simultaneous | 15 | PASS |
| 13 | Invalid-addr AW-before-W 0x14/0xFF/0x80000000 — W_WAIT_W SLVERR | 9 | PASS |
| 14 | Invalid-addr W-before-AW 0x14/0xFF/0x80000000 — W_WAIT_A SLVERR | 9 | PASS |

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

## 8. Address Decode — FIXED (2026-04-30)

**Previous symptom:** Writes/reads to 0x10 returned OKAY and aliased to reg[0].

**Fix applied:** `rtl/axi_lite_regfile.v` now checks `addr[31:4] == 28'h0` in every
write-commit branch (W_IDLE simultaneous, W_WAIT_W, W_WAIT_A) and the R_IDLE read
branch. Invalid addresses return SLVERR without touching registers or leaking data.

**Evidence in log (post-fix):**
```
[PASS]   0x10 write: BRESP=SLVERR               resp=2'b10
[PASS]   0x10 read: RRESP=SLVERR                resp=2'b10
[PASS]   0x10 read: rdata=0x0 (no register leak) got=0x00000000
[PASS]   0x10 write did not alias to reg[0]      got=0xaaaaaaaa
```

No remaining known RTL limitations.
