# Verification Handoff: `axis_complex_mult`

**Version:** 1.0
**Date:** 2026-05-03
**Author:** RTL Designer Agent (Agent 3)
**Protocol:** RTL Designer Agent Protocol v1
**Receiver:** RTL Verification Agent (Agent 4)

This document provides everything the verification agent needs to write a self-checking testbench for `axis_complex_mult` without reading the RTL.

---

## 1. DUT Summary

| Field | Value |
|-------|-------|
| Module | `axis_complex_mult` |
| RTL file | `rtl/axis_complex_mult.v` |
| Category | CAT-4 (AXI-Stream Block) / CAT-5 (DSP Pipeline) |
| Profile | `dut_profile_axistream_block.md` (timing rules), `dut_profile_dsp_pipeline.md` (arithmetic) |
| Parameters | DATA_WIDTH=32, COMPONENT_WIDTH=16, SHIFT=15 |
| Interfaces | 2 AXI-Stream slaves (A, B), 1 AXI-Stream master (output) |
| Latency | 1 clock cycle |
| Throughput | 1 pair/cycle (max) |

---

## 2. Scoreboard Rule

For each accepted pair `(A, B)`:

```
a_real = signed(A[31:16])   // Q1.15
a_imag = signed(A[15:0])
b_real = signed(B[31:16])
b_imag = signed(B[15:0])

full_real = (a_real * b_real) - (a_imag * b_imag)   // 33-bit signed
full_imag = (a_real * b_imag) + (a_imag * b_real)   // 33-bit signed

out_real = full_real[30:15]  // arithmetic right shift by 15, truncate to 16 bits
out_imag = full_imag[30:15]

expected_tdata = {out_real[15:0], out_imag[15:0]}
expected_tlast = a_tlast | b_tlast
```

**Overflow:** If `full_real` or `full_imag` requires more than 31 bits for the result (i.e., bits [32:31] do not sign-extend bit [30]), the output wraps. The scoreboard must model wrap-on-truncation, not saturate.

**Golden model:** Implement the above arithmetic in the testbench as a SystemVerilog function or task. For floating-point reference comparison, an external Python golden model may be used for the T-SMOKE test.

---

## 3. Required Test List

| ID | Name | Checks | Description |
|----|------|--------|-------------|
| T-RST | Reset defaults | 4 | After aresetn=0: `m_tvalid=0`, `m_tdata=0`, `m_tlast=0`; `s_a_tready` and `s_b_tready` correct when both inputs valid after reset |
| T-MATH-RR | Real × Real | 4 | A=(1.0, 0), B=(0.5, 0); output real = 0.5, output imag = 0; verify Q1.15 arithmetic |
| T-MATH-II | Imaginary × Imaginary | 4 | A=(0, 1.0), B=(0, 1.0); output real = -1.0, output imag = 0 |
| T-MATH-FULL | Full complex product | 6 | A=(0.5, 0.25), B=(0.25, 0.5); full product computed and compared against reference |
| T-MULTI | Multi-pair sequence | ≥16 | 4+ pairs sent sequentially; all output beats verified via scoreboard |
| T-THRPT | Back-to-back throughput | ≥12 | m_tready=1 always; no stall between consecutive pairs; 1 pair/cycle verified |
| T-OUT-BP | Output backpressure | ≥8 | Hold m_tready=0; verify m_tvalid stable, m_tdata/tlast stable for 3+ cycles; then release and consume |
| T-ONE-CHAN | One channel only | 4 | Drive only A valid (B not valid): verify s_a_tready=0, no output; then drive both: output appears |
| T-TLAST | TLAST policy | ≥8 | Verify: a_tlast=0,b_tlast=0→m_tlast=0; a_tlast=1,b_tlast=0→m_tlast=1; a_tlast=0,b_tlast=1→m_tlast=1; a_tlast=1,b_tlast=1→m_tlast=1 |
| T-WRAP | Overflow wrap | 4 | A=(1.0, 0), B=(1.0, 0): 1.0×1.0 in Q1.15 overflows; verify output matches truncated result (no saturation) |
| T-RST-MID | Reset mid-stream | 4 | Assert reset after a pair is in the output buffer; verify m_tvalid=0 after reset; verify clean pair processed after reset release |
| T-SMOKE | Deterministic random smoke | ≥80 | Fixed LFSR seed; 10 packets; variable-length; all beats verified via scoreboard using inline golden model |

**Minimum total checks: 154**

---

## 4. Test Vector Examples

### T-MATH-RR: A=(1.0, 0.0), B=(0.5, 0.0)

Q1.15 encoding:
- `a_real = 0x7FFF` (≈ 0.99997, maximum positive)
- `a_imag = 0x0000`
- `b_real = 0x4000` (= 16384 = 0.5 in Q1.15)
- `b_imag = 0x0000`

Expected:
```
prod_rr = 0x7FFF * 0x4000 = 0x1FFF_C000
prod_ii = 0
full_real = 0x1FFF_C000 (33-bit)
out_real = full_real[30:15] = 0x3FFF (≈ 0.499985)
full_imag = 0
out_imag = 0x0000
expected_tdata = {0x3FFF, 0x0000} = 0x3FFF_0000
```

### T-MATH-II: A=(0.0, 1.0), B=(0.0, 1.0)

```
a_imag = b_imag = 0x7FFF
prod_ii = 0x7FFF * 0x7FFF = 0x3FFF_0001
full_real = -{0x0_3FFF_0001} = -0x3FFF_0001 (as 33-bit)
out_real = full_real[30:15]
         = (-0x3FFF_0001)[30:15]
```

In 2's complement 33-bit: `-0x3FFF_0001 = 0x1_C000_FFFF`
`[30:15]` = bits 30 down to 15 of `0x1_C000_FFFF` = `0xC001` = -16383 ≈ -1.0

```
full_imag = 0 (a_real=0, b_real=0)
out_imag = 0x0000
expected_tdata = {0xC001, 0x0000} = 0xC001_0000
```

### T-WRAP: A=(1.0, 0.0), B=(1.0, 0.0) — maximum values, overflow expected

```
a_real = b_real = 0x7FFF = 32767
prod_rr = 32767 * 32767 = 1_073_676_289 = 0x3FFF_0001
full_real = 0x3FFF_0001 (33-bit)
full_real[30:15] = 0x7FFE   (no overflow at max×max for Q1.15)
```

Note: `0x7FFF × 0x7FFF = 0x3FFF_0001`. `full_real[30:15] = 0x7FFE` (≈ 0.99994). This does NOT wrap for the maximum representable inputs.

**True overflow example:** Use a synthetic `prod_rr` value where `full_real[32:31]` disagree with `full_real[30]`. Since Q1.15 max input is 0x7FFF, max product is 0x3FFF_0001 which fits in Q1.15 output without true overflow (sign bit [30]=0, so [32:31] are also 0).

For wrapping test, use: `a_real = 0x7FFF, a_imag = 0x8000 (-32768)`. Then `prod_ii = 0x7FFF * 0x8000 = -1_073_709_056 = -0x3FFF_8000`. `full_real = prod_rr - prod_ii = 0x3FFF_0001 - (-0x3FFF_8000) = 0x7FFE_8001`. In 33-bit: `0x0_7FFE_8001`. `[30:15] = 0xFFD0`. This wraps — the true result exceeds Q1.15 range.

The testbench golden model must compute the same truncation.

---

## 5. Testbench Architecture Notes

### 5.1 Dual-Input Send Task

The standard `send_beat` helper sends one AXI-Stream beat on a single channel. For `axis_complex_mult`, a `send_pair` task must drive both A and B simultaneously:

```systemverilog
task send_pair(input [31:0] a_data, a_last, b_data, b_last);
    @(negedge aclk);
    s_axis_a_tdata = a_data; s_axis_a_tvalid = 1'b1; s_axis_a_tlast = a_last;
    s_axis_b_tdata = b_data; s_axis_b_tvalid = 1'b1; s_axis_b_tlast = b_last;
    @(posedge aclk);
    // wait until s_a_tready == 1 (which occurs when both valid and buf_ready)
    // push scoreboard: golden(a_data, b_data), a_last|b_last
    @(negedge aclk);
    s_axis_a_tvalid = 1'b0; s_axis_b_tvalid = 1'b0;
endtask
```

Both channels must be driven to `tvalid=1` at the same negedge, held through the posedge where handshake completes, then deasserted together at the next negedge.

### 5.2 One-Channel Tests

For T-ONE-CHAN, drive only A or only B to `tvalid=1` and verify `tready=0` on the driven channel, no output produced.

### 5.3 Output Monitor

For interleaved send+expect: call `wait_output_beat` after each `send_pair` (same pattern as `axis_add_one`). This DUT has 1-cycle latency; the output appears 1 cycle after `accept`.

### 5.4 Scoreboard Golden Model

Implement the complex multiply arithmetic inline as a SystemVerilog function. Use 64-bit integers to hold 33-bit signed intermediates:

```systemverilog
function automatic [31:0] golden_complex_mult(input [31:0] a, b);
    logic signed [15:0] ar, ai, br, bi;
    logic signed [31:0] prr, pii, pri, pir;
    logic signed [32:0] fr, fi;
    logic signed [15:0] or_, oi;
    ar = a[31:16]; ai = a[15:0]; br = b[31:16]; bi = b[15:0];
    prr = ar * br; pii = ai * bi; pri = ar * bi; pir = ai * br;
    fr = {prr[31],prr} - {pii[31],pii};
    fi = {pri[31],pri} + {pir[31],pir};
    or_ = fr[30:15];
    oi  = fi[30:15];
    return {or_, oi};
endfunction
```

---

## 6. Testbench Timing Rules

Per `dut_profile_axistream_block.md` §9 (validated rules):

- Drive `s_axis_a_tvalid`, `s_axis_a_tdata`, `s_axis_a_tlast`, `s_axis_b_tvalid`, `s_axis_b_tdata`, `s_axis_b_tlast`, and `m_axis_tready` on **negedge aclk**.
- Sample all DUT outputs (`s_axis_a_tready`, `s_axis_b_tready`, `m_axis_tvalid`, `m_axis_tdata`, `m_axis_tlast`) on **posedge aclk**.
- Never change `m_axis_tready` in the posedge active region.
- Use `interleave` (send_pair + wait_output_beat per pair) since DUT latency is 1 cycle.

---

## 7. Known Corner Cases and Protocol Observations

| # | Case | Expected behavior |
|---|------|-----------------|
| C1 | Both A and B valid; output buffer full (`m_tready=0`) | No accept; both `s_tready=0`; output stable |
| C2 | A valid, B not valid | `s_a_tready=0`; no accept; no output change |
| C3 | B valid, A not valid | `s_b_tready=0`; no accept; no output change |
| C4 | `accept=1` while `m_tvalid=1 && m_tready=1` | Simultaneous consume+accept; new result registered in same cycle; m_tvalid stays 1 |
| C5 | a_tlast=1, b_tlast=0 | m_tlast=1 on output |
| C6 | a_tlast=0, b_tlast=1 | m_tlast=1 on output |
| C7 | a_tlast=1, b_tlast=1 | m_tlast=1 on output |
| C8 | a_tlast=0, b_tlast=0 | m_tlast=0 on output |
| C9 | Reset asserted with m_tvalid=1 | m_tvalid → 0 asynchronously |
| C10 | Overflow in full_real (sum > 2^30) | out_real wraps per [30:15] truncation |

---

## 8. Deferred Items

| ID | Item | Reason |
|----|------|--------|
| D1 | `DATA_WIDTH != 32` parametric sweep | Out of scope for initial campaign; CW=16, SHIFT=15 only |
| D2 | Saturation variant | Not implemented in RTL |
| D3 | tkeep / tstrb / tuser | Not supported by DUT |
| D4 | Independent per-channel buffering (A FIFO, B FIFO) | Architectural variant, out of scope |
| D5 | Formal proof of deadlock freedom | Out of scope for simulation-only phase |
| D6 | Round-to-nearest output | Not implemented; truncation only |
| D7 | Python golden model comparison | T-SMOKE may use inline golden model; Python model optional for this phase |
| D8 | Pipelined version (N-stage) | Out of scope; single-stage only |

---

## 9. Simulation Script Requirements

- Source: `source /home/zealatan/Vivado/2022.2/settings64.sh`
- xvlog: `xvlog --sv tb/axis_complex_mult_tb.sv rtl/axis_complex_mult.v`
- xelab: `xelab axis_complex_mult_tb -debug typical -s axis_complex_mult_tb_sim -timescale 1ns/1ps`
- xsim: `xsim axis_complex_mult_tb_sim --runall`
- Log: `logs/axis_complex_mult_xsim.log`
- CI gate: `grep -qE '\[FAIL\]|FATAL' logs/axis_complex_mult_xsim.log && { echo "[ERROR] Failures detected"; exit 1; } || echo "[PASS] No failures detected"`

---

## 10. Evidence Required for Closure

| # | Criterion |
|---|----------|
| 1 | All 11+ required tests produce `[PASS]` for all checks |
| 2 | Total check count ≥ 154 |
| 3 | CI grep gate exits with code 0 |
| 4 | `ai_context/verification_matrix_axis_complex_mult.md` updated |
| 5 | `ai_context/final_verification_summary_axis_complex_mult.md` created |
| 6 | All deferred items listed in known limitations |

---

*Created: 2026-05-03 — RTL Designer Agent Protocol v1, Prompt 31*
*See also: `architecture_spec_axis_complex_mult.md`, `interface_contract_axis_complex_mult.md`, `microarchitecture_report_axis_complex_mult.md`*
