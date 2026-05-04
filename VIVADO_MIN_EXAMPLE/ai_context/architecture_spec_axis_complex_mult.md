# Architecture Specification: `axis_complex_mult`

**Version:** 1.0
**Date:** 2026-05-03
**Author:** RTL Designer Agent (Agent 3)
**Protocol:** RTL Designer Agent Protocol v1

---

## 1. DUT Name and Purpose

| Field | Value |
|-------|-------|
| Module name | `axis_complex_mult` |
| Purpose | AXI-Stream complex multiplier: computes C = A × B where A, B, C are complex numbers encoded in Q1.15 fixed-point |
| DUT category | CAT-4 (AXI-Stream Processing Block) / CAT-5 (DSP Pipeline) |
| Verification profile | `dut_profile_axistream_block.md` (primary), `dut_profile_dsp_pipeline.md` (secondary) |

---

## 2. Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `DATA_WIDTH` | 32 | Bits per AXI-Stream beat; must equal `2 × COMPONENT_WIDTH` |
| `COMPONENT_WIDTH` | 16 | Bits per complex component (real or imaginary) |
| `SHIFT` | 15 | Arithmetic right-shift applied after multiplication; equals `COMPONENT_WIDTH - 1` for Q1.15 |

**Assumption:** `DATA_WIDTH == 2 × COMPONENT_WIDTH`. This is not enforced by RTL.

---

## 3. High-Level Behavior

`axis_complex_mult` accepts two AXI-Stream inputs — channel A and channel B — and produces one AXI-Stream output stream carrying the complex product.

- Each beat on channel A carries one complex number `(a_real, a_imag)` packed as `{a_real[15:0], a_imag[15:0]}` (big-endian: high half = real, low half = imaginary).
- Each beat on channel B carries one complex number `(b_real, b_imag)` packed the same way.
- The DUT accepts a pair (A, B) **atomically**: both A and B must present `tvalid=1` simultaneously for a transaction to complete. There is no independent per-channel buffering.
- For each accepted pair, the DUT computes the Q1.15 complex product and writes one beat to the master output.

**Fixed-point format:** Q1.15 — one sign bit and 15 fractional bits. The representable range is approximately `[-1, +1)`.

---

## 4. Block Diagram (Text)

```
        ┌─────────────────────────────────────────────┐
        │             axis_complex_mult                │
        │                                             │
 A ───► │  s_axis_a (slave, 32-bit)                   │
        │                                             │
 B ───► │  s_axis_b (slave, 32-bit)                   │      ┌──────────────┐
        │                                             │  ──► │  m_axis      │
        │  Datapath:                                  │      │  (master)    │
        │  a_real * b_real → prod_rr  ─► +            │      └──────────────┘
        │  a_imag * b_imag → prod_ii  ─► -  = full_real│
        │  a_real * b_imag → prod_ri  ─► +            │
        │  a_imag * b_real → prod_ir  ─► +  = full_imag│
        │                                             │
        │  out_real = full_real[30:15]  (>>> 15)      │
        │  out_imag = full_imag[30:15]  (>>> 15)      │
        │                                             │
        │  Output buffer (1 entry, registered)        │
        │  buf_ready = !m_tvalid || m_tready           │
        └─────────────────────────────────────────────┘
```

---

## 5. Datapath Description

### 5.1 Component Extraction

For each input channel (A and B), the 32-bit tdata word is split into two 16-bit signed components:
- High half `[31:16]` → real part
- Low half `[15:0]` → imaginary part

### 5.2 Four Partial Products

| Product | Formula | Width |
|---------|---------|-------|
| `prod_rr` | `a_real × b_real` | 32-bit signed |
| `prod_ii` | `a_imag × b_imag` | 32-bit signed |
| `prod_ri` | `a_real × b_imag` | 32-bit signed |
| `prod_ir` | `a_imag × b_real` | 32-bit signed |

### 5.3 Accumulation (33-bit)

Each 32-bit product is sign-extended to 33 bits before summing:

```
full_real = {prod_rr[31], prod_rr} - {prod_ii[31], prod_ii}
full_imag = {prod_ri[31], prod_ri} + {prod_ir[31], prod_ir}
```

33-bit accumulation prevents carry loss when the magnitude of the sum/difference exceeds a 32-bit signed range.

### 5.4 Scaling (Arithmetic Right Shift)

```
out_real = full_real[30:15]   (arithmetic right shift by 15)
out_imag = full_imag[30:15]   (arithmetic right shift by 15)
```

Bits `[30:15]` of the 33-bit accumulator correspond to the Q1.15-scaled result. This is equivalent to `full_real >>> 15`, truncated to 16 bits.

**No saturation:** when the result overflows the Q1.15 range (i.e., full_real[32:31] do not match bit [30]), the output wraps naturally via truncation.

### 5.5 Output Packing

```
m_axis_tdata = {out_real[15:0], out_imag[15:0]}
```

High half = real component, low half = imaginary component (same convention as inputs).

---

## 6. Output Buffer (Skid Register)

The DUT uses the same single-entry registered output buffer pattern as `axis_add_one`:

```
buf_ready = !m_axis_tvalid || m_axis_tready
```

The `accept` condition is:

```
accept = s_axis_a_tvalid && s_axis_b_tvalid && buf_ready
```

Both input channels are consumed simultaneously when `accept` is true.

### 6.1 Implicit FSM States

| State | Condition | Description |
|-------|-----------|-------------|
| EMPTY | `m_tvalid == 0` | Output buffer has no valid data; accepts new pair when both A and B valid |
| FULL_HOLD | `m_tvalid == 1 && m_tready == 0` | Output buffer holds data; downstream not ready; input stalls |
| FULL_DRAIN | `m_tvalid == 1 && m_tready == 1` | Output consumed this cycle; if A and B both valid, new pair accepted simultaneously |

---

## 7. Backpressure and Ready Signals

The input ready signals are combinatorial and mutually cross-connected:

```
s_axis_a_tready = s_axis_b_tvalid && buf_ready
s_axis_b_tready = s_axis_a_tvalid && buf_ready
```

**Rationale:** A beat on channel A is only accepted when channel B is also presenting a valid beat (and vice versa). This implements atomic pair acceptance without independent input FIFOs. The AXI-Stream handshake for each channel completes simultaneously on the same clock edge.

**No combinatorial loop:** `s_axis_a_tready` depends on `s_axis_b_tvalid` (an external input) and `m_axis_tvalid` (a registered DUT output). There is no path from `s_axis_a_tready` back to itself.

---

## 8. TLAST Policy

```
m_axis_tlast = s_axis_a_tlast | s_axis_b_tlast
```

If either input channel asserts `tlast`, the output beat carries `tlast=1`. If both assert `tlast=0`, the output carries `tlast=0`.

**Rationale:** When processing two independent streams that may have different packet boundaries, taking the OR ensures that a packet end on either stream is propagated to the output. The downstream consumer sees a packet boundary whenever either upstream source sees one.

---

## 9. Reset Behavior

- Reset: asynchronous, active-low (`aresetn = 0`)
- On reset: `m_axis_tvalid = 0`, `m_axis_tdata = 0`, `m_axis_tlast = 0`
- After reset: `s_axis_a_tready = s_axis_b_tvalid` (since `buf_ready = !0 || 0 = 1`), `s_axis_b_tready = s_axis_a_tvalid`
- No data flush required: only one output register; the in-flight state is the registered output.

---

## 10. Assumptions and Constraints

| # | Assumption | Consequence if violated |
|---|-----------|-------------------------|
| A1 | `DATA_WIDTH == 2 × COMPONENT_WIDTH` | Component extraction slices will be wrong |
| A2 | Input data is Q1.15 (values in [-32768, 32767]) | Arithmetic correct only for this encoding |
| A3 | Channel A and B streams carry data at the same rate (no independent buffering) | Starvation possible if one channel sends faster than the other |
| A4 | Upstream sources tolerate that `tready` depends on the other channel's `tvalid` | Deadlock if upstream state machines require `tready=1` before asserting `tvalid` |

---

## 11. Known Limitations

| # | Limitation | Deferred to |
|---|-----------|-------------|
| L1 | No saturation: overflow wraps silently | Could add saturation logic in a future variant |
| L2 | No tkeep, tstrb, tuser support | Out of scope for this design |
| L3 | Single-entry output buffer: 1-cycle latency, 1 pair/cycle throughput (when not stalled) | Pipelined version out of scope |
| L4 | No independent input buffering: stream B stalls if stream A is absent and vice versa | Independent FIFO buffering out of scope |
| L5 | No rounding: truncation after right-shift (consistent with SHIFT-bit right truncation) | Round-to-nearest out of scope |
| L6 | Parameter validation not enforced in RTL | Synthesis or sim wrapper can add assertions |

---

*Created: 2026-05-03 — RTL Designer Agent Protocol v1, Prompt 31*
*See also: `interface_contract_axis_complex_mult.md`, `microarchitecture_report_axis_complex_mult.md`, `verification_handoff_axis_complex_mult.md`*
