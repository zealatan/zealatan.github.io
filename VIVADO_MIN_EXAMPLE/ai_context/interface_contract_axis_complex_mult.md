# Interface Contract: `axis_complex_mult`

**Version:** 1.0
**Date:** 2026-05-03
**Author:** RTL Designer Agent (Agent 3)
**Protocol:** RTL Designer Agent Protocol v1

This document is the binding contract between the RTL implementation (`rtl/axis_complex_mult.v`) and the verification testbench. All checks in the testbench must be derived from this document.

---

## 1. Clock and Reset

| Signal | Direction | Description |
|--------|-----------|-------------|
| `aclk` | Input | Rising-edge clock for all synchronous logic |
| `aresetn` | Input | Asynchronous active-low reset |

**Reset policy:** `aresetn = 0` immediately sets all registered outputs to their reset values, regardless of the clock. Reset release is synchronous (effective at the next rising clock edge after `aresetn` returns to 1).

---

## 2. Port Table

| Port | Direction | Width | Description |
|------|-----------|-------|-------------|
| `aclk` | Input | 1 | System clock |
| `aresetn` | Input | 1 | Asynchronous reset, active low |
| `s_axis_a_tdata` | Input | DATA_WIDTH | Input A: `{a_real[CW-1:0], a_imag[CW-1:0]}` |
| `s_axis_a_tvalid` | Input | 1 | Input A valid |
| `s_axis_a_tready` | Output | 1 | Input A ready (combinatorial) |
| `s_axis_a_tlast` | Input | 1 | Input A last beat of packet |
| `s_axis_b_tdata` | Input | DATA_WIDTH | Input B: `{b_real[CW-1:0], b_imag[CW-1:0]}` |
| `s_axis_b_tvalid` | Input | 1 | Input B valid |
| `s_axis_b_tready` | Output | 1 | Input B ready (combinatorial) |
| `s_axis_b_tlast` | Input | 1 | Input B last beat of packet |
| `m_axis_tdata` | Output | DATA_WIDTH | Output: `{out_real[CW-1:0], out_imag[CW-1:0]}` |
| `m_axis_tvalid` | Output | 1 | Output valid (registered) |
| `m_axis_tready` | Input | 1 | Output ready |
| `m_axis_tlast` | Output | 1 | Output last beat of packet (registered) |

`CW` = `COMPONENT_WIDTH` (default 16).

---

## 3. Data Encoding

### Input channels A and B

Each 32-bit tdata word encodes a Q1.15 complex number:

```
tdata[31:16] = real component  (signed 16-bit, Q1.15)
tdata[15:0]  = imaginary component (signed 16-bit, Q1.15)
```

Q1.15 format: 1 sign bit, 15 fractional bits. Representable range: [-32768/32768, 32767/32768) ≈ [-1, +1).

### Output channel

Same packing convention:

```
m_axis_tdata[31:16] = out_real (signed 16-bit, Q1.15 result)
m_axis_tdata[15:0]  = out_imag (signed 16-bit, Q1.15 result)
```

---

## 4. AXI-Stream Slave Interfaces (A and B)

### 4.1 Handshake Rule

A transaction on channel X (A or B) completes at the **rising clock edge** where both of the following are true:

```
s_axis_X_tvalid == 1  AND  s_axis_X_tready == 1
```

### 4.2 Atomic Pair Acceptance

The DUT **only accepts a pair** when both A and B are simultaneously valid and the output buffer is ready:

```
accept = s_axis_a_tvalid && s_axis_b_tvalid && buf_ready
       where buf_ready = !m_axis_tvalid || m_axis_tready
```

The ready signals reflect this:

```
s_axis_a_tready = s_axis_b_tvalid && buf_ready   (combinatorial)
s_axis_b_tready = s_axis_a_tvalid && buf_ready   (combinatorial)
```

**Consequence:** If only one channel presents `tvalid=1`, that channel's `tready` is 0 (unless the other channel also has `tvalid=1`). The upstream must not deadlock waiting for a `tready` that requires the other channel to be driven.

### 4.3 No Independent Buffering

There are no per-channel FIFOs. The DUT does not absorb one channel's beat while waiting for the other. Both channels must present data at the same time.

---

## 5. AXI-Stream Master Interface

### 5.1 Output Valid / Ready

`m_axis_tvalid` is a registered output. It is set to 1 when an accepted pair produces a result and is cleared when the downstream consumes it (`m_tready=1`).

```
buf_ready = !m_axis_tvalid || m_axis_tready
```

When `buf_ready=1` and `accept=1`, the DUT simultaneously clears the old output (if any) and registers the new result. This is the "consume and accept simultaneously" path.

### 5.2 Output Stability

Once `m_axis_tvalid` is asserted, `m_axis_tdata` and `m_axis_tlast` **must remain stable** until `m_axis_tready` is asserted and the transaction completes. The DUT must not deassert `m_axis_tvalid` or change `m_axis_tdata`/`m_axis_tlast` while `m_axis_tready=0`.

---

## 6. Functional Contract

For each accepted pair `(A, B)` where `A = (a_real, a_imag)` and `B = (b_real, b_imag)`:

### 6.1 Complex Multiplication (full precision)

```
full_real = (a_real × b_real) - (a_imag × b_imag)   [33-bit signed]
full_imag = (a_real × b_imag) + (a_imag × b_real)   [33-bit signed]
```

All arithmetic is signed integer arithmetic at full precision (sign-extended to 33 bits to prevent carry loss).

### 6.2 Output Scaling (Q1.15 normalization)

```
out_real = full_real[30:15]   (truncate to 16 bits after arithmetic right shift by 15)
out_imag = full_imag[30:15]
```

For the default parameters (CW=16, SHIFT=15), this extracts bits [30:15] of the 33-bit accumulator.

### 6.3 Output Packing

```
m_axis_tdata = {out_real[15:0], out_imag[15:0]}
```

### 6.4 Overflow Behavior

When the mathematical result exceeds the Q1.15 range (i.e., `full_real[32:31]` do not all equal `full_real[30]`), the output **wraps naturally** via truncation. No saturation, no error signal, no overflow flag.

---

## 7. TLAST Contract

```
m_axis_tlast = s_axis_a_tlast | s_axis_b_tlast
```

Registered. The output beat carries `tlast=1` if and only if at least one input channel had `tlast=1` at the accepted pair.

---

## 8. Reset Values

| Signal | Reset value |
|--------|-------------|
| `m_axis_tvalid` | 0 |
| `m_axis_tdata` | 0x00000000 |
| `m_axis_tlast` | 0 |
| `s_axis_a_tready` | Combinatorial; = `s_axis_b_tvalid && 1` after reset (since `m_tvalid=0`) |
| `s_axis_b_tready` | Combinatorial; = `s_axis_a_tvalid && 1` after reset |

---

## 9. Timing Assumptions

| Assumption | Description |
|-----------|-------------|
| T1 | All inputs (`s_axis_a_tdata/tvalid/tlast`, `s_axis_b_tdata/tvalid/tlast`, `m_axis_tready`) are stable before the rising clock edge |
| T2 | Ready signals (`s_axis_a_tready`, `s_axis_b_tready`) are combinatorial and valid shortly after inputs change |
| T3 | `m_axis_tdata` and `m_axis_tlast` are registered; stable from 1 cycle after `accept` until consumed |

---

## 10. Unsupported Behavior

| Feature | Status |
|---------|--------|
| `tkeep` / `tstrb` | Not implemented; not present at ports |
| `tuser` | Not implemented; not present at ports |
| Saturation on overflow | Not implemented; result wraps |
| Independent per-channel buffering | Not implemented; requires simultaneous valid |
| Multiple outstanding pairs | Not applicable; 1-entry output buffer |
| `DATA_WIDTH != 2 × COMPONENT_WIDTH` | Undefined behavior |

---

## 11. Latency

| Metric | Value |
|--------|-------|
| Latency (input pair to output valid) | 1 clock cycle |
| Throughput (max, back-to-back pairs, downstream ready) | 1 pair/cycle |
| Throughput (max, if one stream has idle cycles) | Limited by slower stream |

---

## 12. Verification Evidence Required

The following must be demonstrated by simulation to close this contract:

| # | Requirement | Test scenarios |
|---|-------------|---------------|
| R1 | Reset defaults: `m_tvalid=0`, `m_tdata=0`, `m_tlast=0` | T-RST |
| R2 | Correct arithmetic for real × real (imaginary = 0) | T-SINGLE, T-MATH-RR |
| R3 | Correct arithmetic for imaginary × imaginary (real = 0) | T-MATH-II |
| R4 | Correct full complex product: `(a+bj)(c+dj)` | T-MATH-FULL |
| R5 | Q1.15 scaling: result in Q1.15 format (divide by 2^15) | T-MATH-FULL |
| R6 | `m_tvalid` held stable when `m_tready=0` | T-OUT-BP |
| R7 | Input stalls when only one channel has `tvalid=1` | T-ONE-CHAN |
| R8 | `tlast` OR policy: output `tlast=1` when either input has `tlast=1` | T-TLAST |
| R9 | Overflow wraps (no saturation) | T-WRAP |
| R10 | Reset mid-computation clears output | T-RST-MID |
| R11 | Deterministic smoke over multiple pairs | T-SMOKE |

---

*Created: 2026-05-03 — RTL Designer Agent Protocol v1, Prompt 31*
*See also: `architecture_spec_axis_complex_mult.md`, `microarchitecture_report_axis_complex_mult.md`, `verification_handoff_axis_complex_mult.md`*
