# Microarchitecture Report: `axis_complex_mult`

**Version:** 1.0
**Date:** 2026-05-03
**Author:** RTL Designer Agent (Agent 3)
**Protocol:** RTL Designer Agent Protocol v1
**RTL file:** `rtl/axis_complex_mult.v` (committed state as of 2026-05-03)

---

## 1. Overview

`axis_complex_mult` is a single-stage AXI-Stream complex multiplier. The entire datapath (component extraction, four multiplications, two accumulations, shift/truncation) is purely combinatorial. Only the output buffer registers (`m_axis_tvalid`, `m_axis_tdata`, `m_axis_tlast`) are sequential.

This report documents the actual RTL implementation. Any discrepancy from the architecture spec is noted in §8.

---

## 2. Implicit FSM

The DUT has no explicit state register. The output buffer state is implicit in `m_axis_tvalid`.

| State | Condition | `m_tvalid` | `buf_ready` | `s_a_tready` | `s_b_tready` |
|-------|-----------|-----------|------------|------------|------------|
| EMPTY | `m_axis_tvalid == 0` | 0 | 1 | `s_b_tvalid` | `s_a_tvalid` |
| FULL_HOLD | `m_axis_tvalid == 1 && m_tready == 0` | 1 | 0 | 0 | 0 |
| FULL_DRAIN | `m_axis_tvalid == 1 && m_tready == 1` | 1 | 1 | `s_b_tvalid` | `s_a_tvalid` |

### State Transitions (on posedge aclk)

| Current state | Condition | Next state | Action |
|--------------|-----------|------------|--------|
| EMPTY | `accept` (a_valid && b_valid) | FULL_HOLD or FULL_DRAIN | Register result; `m_tvalid ← 1` |
| EMPTY | `!accept` | EMPTY | No change |
| FULL_HOLD | `m_tready=1` && `!accept` | EMPTY | `m_tvalid ← 0` |
| FULL_HOLD | `m_tready=1` && `accept` | FULL_HOLD or FULL_DRAIN | Register new result; `m_tvalid` stays 1 |
| FULL_HOLD | `m_tready=0` | FULL_HOLD | No change |
| FULL_DRAIN | same as FULL_HOLD with `m_tready=1` | — | Identical: `buf_ready=1` in both sub-cases |

The `else if (m_axis_tready)` branch in the RTL fires when `m_tready=1` but `accept=0` (i.e., when the buffer is consumed but no new pair is ready). This clears `m_tvalid`.

### Branch Priority (RTL always block)

```
Priority 1: !aresetn             → reset
Priority 2: accept               → register new result
Priority 3: m_axis_tready        → clear m_tvalid
(No branch fires if !accept && !m_tready)
```

Priority 2 subsumes FULL_DRAIN + accept (simultaneous consume and accept). Priority 3 only fires when `!accept`.

---

## 3. Registered Signals

| Signal | Type | Width | Reset value | Updated on |
|--------|------|-------|-------------|-----------|
| `m_axis_tvalid` | reg | 1 | 0 | `accept` (set to 1) or `m_tready && !accept` (set to 0) |
| `m_axis_tdata` | reg | 32 | 0x00000000 | `accept` — loaded with `{out_real, out_imag}` |
| `m_axis_tlast` | reg | 1 | 0 | `accept` — loaded with `a_tlast | b_tlast` |

---

## 4. Combinatorial Signals

| Signal | Expression | Notes |
|--------|-----------|-------|
| `buf_ready` | `!m_axis_tvalid \|\| m_axis_tready` | Output slot available |
| `s_axis_a_tready` | `s_axis_b_tvalid && buf_ready` | Atomic pair: A ready iff B valid and buf free |
| `s_axis_b_tready` | `s_axis_a_tvalid && buf_ready` | Atomic pair: B ready iff A valid and buf free |
| `accept` | `s_axis_a_tvalid && s_axis_b_tvalid && buf_ready` | Both valid and buf free |
| `a_real` | `s_axis_a_tdata[31:16]` (signed) | High half of A |
| `a_imag` | `s_axis_a_tdata[15:0]` (signed) | Low half of A |
| `b_real` | `s_axis_b_tdata[31:16]` (signed) | High half of B |
| `b_imag` | `s_axis_b_tdata[15:0]` (signed) | Low half of B |
| `prod_rr` | `a_real * b_real` (32-bit signed) | Partial product |
| `prod_ii` | `a_imag * b_imag` (32-bit signed) | Partial product |
| `prod_ri` | `a_real * b_imag` (32-bit signed) | Partial product |
| `prod_ir` | `a_imag * b_real` (32-bit signed) | Partial product |
| `full_real` | `{prod_rr[31],prod_rr} - {prod_ii[31],prod_ii}` (33-bit signed) | Real accumulator |
| `full_imag` | `{prod_ri[31],prod_ri} + {prod_ir[31],prod_ir}` (33-bit signed) | Imag accumulator |
| `out_real` | `full_real[30:15]` (16-bit signed) | Scaled real output |
| `out_imag` | `full_imag[30:15]` (16-bit signed) | Scaled imag output |

---

## 5. No Combinatorial Loops

`s_axis_a_tready` depends on: `s_axis_b_tvalid` (external input) and `m_axis_tvalid` (registered DUT output). Not on `s_axis_a_tvalid` (DUT output) or `s_axis_a_tready` itself. No loop exists.

`s_axis_b_tready` is symmetric. No loop.

---

## 6. Datapath Bit-Width Analysis

For `CW=16`, `SHIFT=15`:

| Stage | Width | Range |
|-------|-------|-------|
| Input component | 16-bit signed | [-32768, 32767] |
| Partial product | 32-bit signed | [-2^30, 2^30] (well within 32-bit) |
| Sign-extended product | 33-bit signed | Same range, zero-extended sign |
| Accumulator (full_real, full_imag) | 33-bit signed | [-2^31, 2^31] at max |
| Output (bits [30:15]) | 16-bit | Arithmetic right-shifted by 15 |

The bit extraction `full_real[30:15]` maps:
- `full_real[30]` → `out_real[15]` (sign/MSB of Q1.15 result)
- `full_real[15]` → `out_real[0]` (LSB of Q1.15 result)

Bits `full_real[14:0]` are the sub-Q1.15 fractional remainder (truncated, not rounded).
Bits `full_real[32:31]` are the sign-extension overflow indicator (ignored; wrap-on-overflow).

---

## 7. Latency and Throughput

| Metric | Value | Notes |
|--------|-------|-------|
| Input-to-output latency | 1 clock cycle | Combinatorial datapath → registered output |
| Max throughput | 1 pair/cycle | With both channels valid and m_tready=1 |
| Backpressure stall | Both inputs stall when `buf_ready=0` | Combinatorial s_tready=0 propagates upstream |

---

## 8. Deviations from Architecture Spec

None. The RTL implements exactly what was specified in `architecture_spec_axis_complex_mult.md` and `interface_contract_axis_complex_mult.md`.

---

## 9. Resource Estimate (FPGA, 7-series/UltraScale)

| Resource | Estimate | Notes |
|----------|---------|-------|
| FFs | ~33 | 1 (m_tvalid) + 32 (m_tdata) |
| LUTs | ~60–80 | buf_ready, accept, tready logic, tlast |
| DSP48 blocks | 4 | One per partial product (prod_rr, prod_ii, prod_ri, prod_ir) |

DSP inference: Vivado will typically map each `signed * signed` 16×16 multiply to one DSP48E1/E2 slice. The adder/subtractor will likely be absorbed into the DSP post-add or mapped to fabric.

---

## 10. RTL Checklist

| Check | Status |
|-------|--------|
| All registered signals have reset values | ✓ |
| No latches (all always @posedge or fully covered comb) | ✓ |
| No `initial` blocks (synthesis-unsafe) | ✓ |
| No `$display` / `$monitor` in RTL | ✓ |
| Async reset uses `or negedge aresetn` | ✓ |
| Combinatorial tready signals fully driven | ✓ |
| No unintended combinatorial loops | ✓ |
| Parameter defaults match design intent | ✓ |
| No timescale directive (testbench provides it via xelab -timescale) | ✓ |

---

*Created: 2026-05-03 — RTL Designer Agent Protocol v1, Prompt 31*
*See also: `architecture_spec_axis_complex_mult.md`, `interface_contract_axis_complex_mult.md`, `verification_handoff_axis_complex_mult.md`*
