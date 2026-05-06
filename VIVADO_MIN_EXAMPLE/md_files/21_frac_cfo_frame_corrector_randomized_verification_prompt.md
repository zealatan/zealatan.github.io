# Step 21 Prompt — Randomized Verification Campaign for frac_cfo_frame_corrector_top

## Working Directory

```
/home/zealatan/AI_ORC/messi/VIVADO_MIN_EXAMPLE
```

## Phase-1 Context

Phase-1 is a frame-buffered OFDM synchronizer. It is NOT a 1-sample/clock streaming pipeline.
It discards `cfg_timing_offset` samples while the phase accumulator tracks them, then outputs
`cfg_frame_len` rotated samples via a one-entry AXI-Stream registered output buffer.

## Completed Step 20 Summary

`rtl/frac_cfo_frame_corrector_top.v` was created in Step 20. It is a self-contained Verilog-2001
module implementing:

- 256-entry Q1.15 sin/cos LUT (initialized via `$cos`/`$sin`/`$rtoi` in `initial` block)
- 16-bit phase accumulator, incremented by `cfg_cfo_step` per accepted sample
- Full complex multiply: `(out_real = in_r*cos - in_i*sin) >> 15`, 33-bit accumulation
- Frame detection: discard `cfg_timing_offset` samples, output `cfg_frame_len` rotated samples
- One-entry registered AXI-Stream output buffer with backpressure
- `frame_detected`: 1-cycle pulse on first frame sample
- `s_axis_tready` de-asserts during frame capture when buffer is full

Step 20 testbench (`tb/frac_cfo_frame_corrector_top_tb.sv`) covers 9 base tests (T1–T9), 39 checks.
Step 20 simulation result: PASS: 39, FAIL: 0, CI gate: PASSED. RTL bugs found: 0.

## Goal

Strengthen verification of `frac_cfo_frame_corrector_top` with a randomized and sweep-based
simulation campaign. Add 8 new test groups (R1–R8) to the existing testbench. All 39 Step 20
checks must be preserved without modification.

## Rules

- Do **not** modify `rtl/frac_cfo_frame_corrector_top.v` unless a bug is proven by a test failure.
- Do **not** remove or alter any Step 20 tests (T1–T9).
- Do **not** use floating-point golden models — use bit-exact Q1.15 arithmetic matching the RTL.
- Testbench must be deterministic (no `$random` without a fixed seed or PRNG with fixed state).
- Use a XorShift32 or LFSR PRNG with a fixed seed for reproducibility.
- Timing protocol: negedge-drive / posedge-sample. No race conditions.
- CI gate: grep for FAIL/FATAL, exit 1 if found.
- `run_frame` task must consume the last sample from the output buffer at the end of each frame
  (buffer leak fix for T7 and R-group tests).
- `recv_bp` task must read `m_axis_tdata` and `m_axis_tlast` BEFORE asserting `m_axis_tready`
  (prevent m_tlast NBA race).

## Required New Test Groups

### R1 — Timing Offset Sweep

Sweep `cfg_timing_offset` from 0 to 15, `cfg_frame_len=1`, `cfg_cfo_step=0`.
For each offset: verify `frame_detected=1` on the correct cycle and `m_axis_tlast=1` on the
output sample. 2 checks per offset × 16 offsets = **32 checks**.

### R2 — Fractional CFO Sweep

Test `cfg_cfo_step` in {0x0000, 0x4000, 0x8000, 0xC000}, `cfg_timing_offset=0`, `cfg_frame_len=4`.
For each CFO value: drive known input data, apply bit-exact golden model rotation, verify all
4 output samples match. 4 checks per value × 4 values = **16 checks**.

### R3 — Randomized Frame Placement

20 LFSR/XorShift32 trials. Per trial: randomize `cfg_timing_offset` in [0,15] and `cfg_frame_len`
in [1,8]. Verify `frame_detected=1` on first frame sample and `m_axis_tlast=1` on last frame
sample. 2 checks per trial × 20 trials = **40 checks**.

### R4 — Randomized Amplitude Scaling

10 trials, `cfg_cfo_step=0`, `cfg_timing_offset=0`, `cfg_frame_len=1`. Per trial: drive a
randomized Q1.15 input sample (real/imag each 16-bit signed). Verify output matches input
(identity rotation at cfo=0 with appropriate bit-exact tolerance). 1 check per trial = **10 checks**.

### R5 — AXI-Stream Backpressure Patterns

Test `m_axis_tready` delay patterns: delays = {0, 1, 2, 3} cycles, `cfg_timing_offset=0`,
`cfg_frame_len=4`. Per delay pattern:
- Verify `m_axis_tvalid` is held while `m_axis_tready=0` (stall_ok check)
- Verify output data is correct after backpressure
- Verify `m_axis_tlast=1` on last sample
3 checks per pattern × 4 patterns = **12 checks**.

### R6 — Reset Robustness

3 scenarios:
1. Reset asserted before any input — verify `m_axis_tvalid=0`, `frame_detected=0` after release
2. Reset asserted while buffer full (mid-frame) — verify state clears + recovery frame works
3. Reset asserted after frame completes — verify clean restart

Per scenario: 2 checks for state clear + 1 check for recovery frame = **9 checks**.

### R7 — No-Frame / False-Trigger Rejection

3 tests: send N samples where N < `cfg_timing_offset`. After driving N samples, verify:
- `m_axis_tvalid = 0` (no output produced)
- `frame_detected = 0`
2 checks per test × 3 tests = **6 checks**.

### R8 — Buffer Boundary Stress

4 configurations: `cfg_frame_len=1`, `cfg_frame_len=10`, `cfg_timing_offset=15` with large frame,
and a mid-range config. Per config: verify `frame_detected`, `m_axis_tlast`, and at least one
data sample. 3 checks per config × 4 configs = **12 checks**.

## Total New Checks

R1(32) + R2(16) + R3(40) + R4(10) + R5(12) + R6(9) + R7(6) + R8(12) = **137 checks**

Combined with Step 20: 39 + 137 = **176 checks total**.

## Required Files

### Update (preserve existing tests, append new groups)

```
tb/frac_cfo_frame_corrector_top_tb.sv
```

### Create (if not already present)

```
scripts/run_frac_cfo_frame_corrector_top_sim.sh
```

### Create

```
docs/step21_frac_cfo_frame_corrector_randomized_verification.md
```

Must include: test group table, simulation result, bugs found, RTL modified yes/no, recommended Step 22.

### Update

```
ai_context/current_status.md
```

Add Step 21 section with check count, campaign statistics, bugs found.

## Expected Final Report Fields

```
PASS: 176
FAIL: 0
Randomized trials (sweeps + random): 57
CFO range tested: 0x0000 to 0xC000 (and spot-check 0xF000)
Timing offset range: 0..15 (sweep) + random 0..15
Backpressure patterns tested: 4 (delays 0..3)
CI GATE: PASSED
```

- Bugs found (RTL): 0 expected
- Bugs found (testbench): report any found and fixed
- RTL modified: No (expected)
- Recommended Step 22: Phase-1 synthesis-readiness and Vivado resource/timing check for
  `frac_cfo_frame_corrector_top` targeting ZCU102 (`xczu9eg-ffvb1156-2-e`) at 100 MHz
