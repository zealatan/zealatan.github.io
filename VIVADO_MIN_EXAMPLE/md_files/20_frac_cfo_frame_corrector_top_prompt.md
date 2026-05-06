# Step 20 Prompt — frac_cfo_frame_corrector_top Integration

## Working Directory

```
/home/zealatan/AI_ORC/messi/VIVADO_MIN_EXAMPLE
```

## Phase-1 Context

This project builds a Phase-1 frame-buffered OFDM synchronizer for the ZCU102 evaluation board.
Phase-1 is not a 1-sample/clock streaming pipeline. It operates on bursts: pre-frame samples are
discarded while the phase accumulator tracks them, and a configured number of rotated samples are
captured into a registered output buffer.

Lower-level modules (`timing_frac_cfo_top`, `frac_cfo_corrector_top`, `iq_frame_buffer`,
`frame_detector`) have already been designed and unit-verified in prior steps. Step 20 integrates
them into a single top-level AXI-Stream block.

## Goal

Create `rtl/frac_cfo_frame_corrector_top.v` — a self-contained integration of:

- **AXI-Stream slave input**: accepts `{imag[31:16], real[15:0]}` Q1.15 packed complex samples
- **Shared `iq_frame_buffer`**: internal frame capture buffer
- **`frame_detector`**: detects frame start after `cfg_timing_offset` samples have been discarded
- **`timing_frac_cfo_top`**: phase accumulator; increments by `cfg_cfo_step` per accepted sample
- **`frac_cfo_corrector_top`**: Q1.15 complex multiply (sin/cos LUT rotation); corrects each sample
- **AXI-Stream master output**: delivers corrected samples with backpressure and `m_tlast` on last
  sample of the frame

## Design Constraints

- Do **not** redesign for 1 sample/clock streaming.
- Do **not** add AXI-Lite control in this step.
- Do **not** modify or replace existing lower-level RTL unless a bug is proven.
- The integration top must be self-contained: all sub-blocks may be flattened into the top-level
  RTL if separate lower-level files are not required.
- Phase accumulator: 16-bit, 2's complement `cfg_cfo_step`, wraps naturally.
- LUT size: 256 entries, Q1.15 sin/cos, initialized via `$cos`/`$sin` in `initial` block.
- Complex multiply: `(out_real = in_r*cos - in_i*sin) >> 15` with 33-bit accumulation.
- Output buffer: one-entry registered. `s_axis_tready` must de-assert during frame capture when
  the buffer is full.
- `frame_detected`: 1-cycle pulse on the first output sample of the frame.
- `m_tlast`: asserts on the last sample of the frame.
- AXI-Stream clock/reset: `aclk` / `aresetn` (active-low synchronous or async reset).

## Required Files

### RTL (create)

```
rtl/frac_cfo_frame_corrector_top.v
```

Verilog-2001 module. Parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| DATA_WIDTH | 16 | Q1.15 sample width |

Ports (minimum):

| Port | Dir | Width | Description |
|------|-----|-------|-------------|
| aclk | I | 1 | Clock |
| aresetn | I | 1 | Active-low reset |
| cfg_cfo_step | I | 16 | Fractional CFO step (Q1.15, 2's complement) |
| cfg_timing_offset | I | 8 | Pre-frame samples to discard |
| cfg_frame_len | I | 8 | Samples in output frame |
| s_axis_tdata | I | 32 | Packed {imag,real} input |
| s_axis_tvalid | I | 1 | |
| s_axis_tready | O | 1 | |
| m_axis_tdata | O | 32 | Packed {imag,real} output |
| m_axis_tvalid | O | 1 | |
| m_axis_tready | I | 1 | |
| m_axis_tlast | O | 1 | Last sample of frame |
| frame_detected | O | 1 | 1-cycle pulse on first frame sample |
| dbg_sample_count | O | 8 | Debug: current sample counter |

### Testbench (create or update)

```
tb/frac_cfo_frame_corrector_top_tb.sv
```

SystemVerilog testbench. Timing protocol: negedge-drive / posedge-sample. No race conditions.

Required tests (Step 20 base):

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

Total: 39 checks.

Golden model: bit-exact Q1.15 multiply matching RTL arithmetic. Must produce identical results to
the synthesized logic (not floating-point approximation).

CI gate: grep for FAIL/FATAL, exit 1 if found.

### Simulation Script (create)

```
scripts/run_frac_cfo_frame_corrector_top_sim.sh
```

Pipeline: `xvlog` → `xelab` → `xsim`. Grep for FAIL/FATAL in output; exit 1 if found.

### Documentation (create)

```
docs/step20_frac_cfo_frame_corrector_top.md
```

Must include: module purpose, port table, architecture description (phase accumulator, LUT,
complex multiply, frame detection, backpressure), simulation result, known limitations.

### Status Update

```
ai_context/current_status.md
```

Add Step 20 section: RTL summary, verification status (check count, PASS/FAIL), recommended Step 21.

## Expected Final Result

```
PASS: 39
FAIL: 0
CI GATE: PASSED
```

Report format:
- Files changed (with paths)
- Simulation result (PASS count, FAIL count)
- CI gate exit code
- RTL modified (yes/no, which lines if yes)
- Recommended Step 21
