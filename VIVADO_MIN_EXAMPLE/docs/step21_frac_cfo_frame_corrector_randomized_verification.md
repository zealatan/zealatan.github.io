# Step 21 — Randomized Verification Campaign: frac_cfo_frame_corrector_top

## Overview

Strengthened verification of `frac_cfo_frame_corrector_top` with a randomized and sweep-based simulation campaign built on top of the Step 20 base tests.

## Files Changed

| File | Change |
|------|--------|
| `rtl/frac_cfo_frame_corrector_top.v` | Created (Step 20 RTL, not modified in Step 21) |
| `tb/frac_cfo_frame_corrector_top_tb.sv` | Extended with 8 randomized test groups (R1–R8) |
| `scripts/run_frac_cfo_frame_corrector_top_sim.sh` | Created |
| `docs/step21_frac_cfo_frame_corrector_randomized_verification.md` | Created (this file) |
| `ai_context/current_status.md` | Updated |

## RTL Summary (frac_cfo_frame_corrector_top.v)

- **AXI-Stream slave**: accepts `{imag[31:16], real[15:0]}` Q1.15 complex samples
- **Phase accumulator**: 16-bit, increments by `cfg_cfo_step` per accepted sample (2's complement; negative = reverse rotation)
- **Phase rotation**: 256-entry Q1.15 sin/cos LUT, indexed by `phase_acc[15:8]`. Initialized in simulation via `$cos`/`$sin` real arithmetic. Full complex multiply `(out_real = in_r*cos - in_i*sin) >> 15`.
- **Frame detection**: discard `cfg_timing_offset` samples (phase tracks them), then output `cfg_frame_len` rotated samples
- **AXI-Stream master**: one-entry registered output buffer; backpressure stalls input only during frame capture; pre-frame samples are accepted freely
- **Status**: `frame_detected` 1-cycle pulse on first frame sample; `dbg_sample_count` debug counter

## Step 20 Tests Preserved (39 checks)

| Test | Description | Checks |
|------|-------------|--------|
| T1 | Reset defaults: m_tvalid=0, frame_detected=0, m_tlast=0 | 3 |
| T2 | Frame at offset=0, cfo=0, len=4: data + fd + tlast | 6 |
| T3 | Frame at offset=3, cfo=0, len=3: data + fd + tlast | 5 |
| T4 | frame_detected pulse timing: no fd before, fd=1 on start, fd=0 after | 3 |
| T5 | tlast pattern for 4-sample frame: 0,0,0,1 | 4 |
| T6 | Backpressure basic: tvalid held, last tlast=1 | 3 |
| T7 | Frame length 1: fd + data + tlast + no extra output | 4 |
| T8 | Reset mid-stream: state clear + recovery frame | 5 |
| T9 | Post-frame canary: tvalid=0, s_tready=1, no extra output | 6 |

## Step 21 Randomized Test Groups (137 checks)

| Group | Description | Trials | Checks |
|-------|-------------|--------|--------|
| R1 | Timing offset sweep (offsets 0..15): fd + tlast each | 16 | 32 |
| R2 | CFO sweep (0x0000, 0x4000, 0x8000, 0xC000): 4 data checks per value | 4 | 16 |
| R3 | Randomized frame placement (LFSR random offset 0..15, len 1..8): fd + tlast | 20 | 40 |
| R4 | Randomized amplitude scaling (cfo=0, random Q1.15 data): data correct | 10 | 10 |
| R5 | AXI-Stream backpressure patterns (delays 0,1,2,3): stall valid + data + tlast | 4 | 12 |
| R6 | Reset robustness (3 scenarios: pre-frame, buffer full, post-frame): state clear + recovery | 3 | 9 |
| R7 | No-frame / false-trigger rejection (n_sent < cfg_timing_offset): m_tvalid=0 + fd=0 | 3 | 6 |
| R8 | Buffer boundary stress (len=1, len=10, offset=15, mid-range): fd + tlast + data | 4 | 12 |

## Simulation Result

```
PASS: 176
FAIL: 0
Randomized trials (sweeps+random): 57
CFO range tested: 0x0000 to 0xC000 and 0xF000
Timing offset range: 0..15 (sweep) + random 0..15
Backpressure patterns tested: 4 (delays 0..3)
CI GATE: PASSED
```

## Bugs Found

None. All RTL behaviors matched the golden model exactly.

**Testbench bugs found and fixed during Step 21 campaign (2 items):**

1. **`run_frame` last-sample buffer leak**: After the frame loop, the last frame sample remained in the DUT's one-entry output buffer (m_tvalid=1). Fixed by adding a consume step at the end of `run_frame` that asserts m_tready=1 for one cycle.

2. **`recv_bp` m_tlast race**: The original `recv_bp` sampled `m_axis_tlast` at `@(posedge) #1` AFTER asserting m_tready, at which point the m_handshake NBA update had already cleared m_tlast to 0. Fixed by reading m_tdata and m_tlast *before* asserting m_tready (while tready=0), then consuming.

## Design Files Modified

None. `rtl/frac_cfo_frame_corrector_top.v` was not changed after initial creation.

## Known Limitations

- `sample_cnt` is 8-bit; `cfg_timing_offset + cfg_frame_len` must not exceed 255 to prevent false frame re-triggers on wrap-around.
- `cfg_frame_len = 0` is undefined behavior (treated as 256-sample frame by the RTL).
- Sin/cos LUT initialized via `$cos`/`$sin` real arithmetic — simulation-only; synthesis requires a pre-computed ROM.
- AXI4-Stream TKEEP/TID/TDEST sidebands not supported.

## Recommended Step 22

**AXI-Lite configuration interface**: Add an AXI-Lite slave to allow runtime programming of `cfg_cfo_step`, `cfg_frame_len`, and `cfg_timing_offset`, plus a `STATUS` register exposing `frame_detected` (sticky), `in_frame`, and `sample_count`. This converts the module from a fixed-config block to a runtime-configurable peripheral, following the pattern established by `simple_dma_add_ctrl` (CAT-3 profile).
