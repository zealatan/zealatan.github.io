# DUT Profile: DSP Pipeline

**Category:** CAT-5 (DSP Pipeline)
**Validation status:** Not yet verified — profile only
**Example DUTs:** FIR filter, FFT stage, NCO, complex multiplier, CFO corrector, CIC filter

---

## 1. Profile Purpose

This profile applies to DUTs that perform a deterministic arithmetic or signal processing transformation on a sequence of samples, with a fixed pipeline latency and a known numerical output for each known input.

**Applicable DUTs:**
- FIR/IIR filter
- NCO (numerically controlled oscillator)
- Complex multiply-accumulate
- CFO frequency corrector
- CIC filter
- FFT / IFFT butterfly stage
- Saturating adder/multiplier
- Any block with: input sample → N-cycle pipeline → output sample

---

## 2. Required Design Contract Fields

| Field | Description |
|-------|-------------|
| Input format | Bit width, signed/unsigned, integer vs. fixed-point (e.g., Q1.15) |
| Output format | Bit width, signed/unsigned, fixed-point format |
| Rounding policy | Truncate, round-half-up, round-to-even, configurable |
| Saturation policy | Saturate on overflow, wrap, configurable |
| Pipeline latency | Fixed number of clock cycles from input valid to corresponding output valid |
| Valid/ready or enable | Which flow-control interface is used; is back-pressure supported |
| Frame length | Number of samples per frame, if applicable |
| Coefficient/config interface | How coefficients or parameters are loaded; runtime update policy |
| Reset behavior | Clears pipeline registers; latency restarts after reset deassert |
| Numerical error tolerance | Maximum allowable deviation from golden model (e.g., ±1 LSB, SNR ≥ 60 dB) |

---

## 3. Mandatory Test List

| # | Scenario | Key Checks |
|---|----------|------------|
| T-GOLDEN | Golden vector comparison | Apply reference test vectors; compare all output samples to `expected_outputs/` within tolerance |
| T-IMPULSE | Impulse input | Single 1 followed by zeros; output should match impulse response from golden model |
| T-ZEROS | All-zero input | Output must be all-zero (or DC offset if applicable); no spurious output |
| T-MAX | Maximum positive input | Output does not overflow unexpectedly; saturate if saturation is specified |
| T-MIN | Maximum negative input (signed) | Same as T-MAX for negative extreme |
| T-SAT | Overflow / saturation | Input that causes overflow; verify saturated or wrapped output per design contract |
| T-SMOKE | Random vector smoke | ≥50 deterministic input vectors; compare all outputs to golden model |
| T-LAT | Latency alignment | First valid output appears exactly N cycles after first valid input; verify with precise cycle count |
| T-RST-FRAME | Reset during frame | Assert reset mid-frame; verify pipeline drains cleanly; next frame produces correct output with no stale state |
| T-COEFF | Coefficient / config update | Load new coefficients; verify subsequent outputs match new transfer function; verify no crosstalk with prior config |

---

## 4. Python Modeling Agent Handoff

This profile **requires a golden model** from the Python Modeling Agent before the RTL Verification Agent can close verification. The expected handoff artifacts are:

| Artifact | Description |
|----------|-------------|
| `golden_model.py` | Python reference implementation; accepts input vectors, returns expected output vectors |
| `test_vectors/` | Directory of input stimulus files in a format readable by SystemVerilog `$readmemh` or `$fscanf` |
| `expected_outputs/` | Directory of expected output files matching each input file |
| `tolerance.md` | Defines acceptable numerical error: absolute error bound, relative error bound, or SNR floor |
| `format_spec.md` | Declares fixed-point format, bit width, and endianness for both input and output |

The RTL Verification Agent reads these files directly into the testbench via `$readmemh` or memory initialization tasks, runs the DUT, and compares outputs sample-by-sample against the expected results.

---

## 5. Testbench Structure Conventions

```
module <dut>_dsp_tb;
    // Clock + reset
    logic clk = 0;
    logic resetn;
    always #5 clk = ~clk;

    // DUT I/O
    logic signed [IN_W-1:0]  din;
    logic                    din_valid;
    logic signed [OUT_W-1:0] dout;
    logic                    dout_valid;

    // Golden model storage (loaded from expected_outputs/)
    logic signed [OUT_W-1:0] expected [0:NUM_SAMPLES-1];
    logic signed [IN_W-1:0]  stimulus [0:NUM_SAMPLES-1];

    // DUT instantiation

    initial begin
        $readmemh("test_vectors/input_0.hex",   stimulus);
        $readmemh("expected_outputs/output_0.hex", expected);
        // Reset
        // Apply stimulus; collect output; compare vs. expected
        // Summary
        $finish;
    end
endmodule
```

**Latency alignment:** The testbench must correctly account for pipeline latency when indexing into `expected[]`. Output sample `i` corresponds to input sample `i - latency`.

---

## 6. Common Hazards

| Hazard | Description |
|--------|-------------|
| Latency off by one | Scoreboard indexes expected[] at i instead of i-latency; all checks fail or are off by one sample |
| Rounding mismatch | RTL truncates; Python rounds; produces ±1 LSB discrepancy even when the RTL is functionally correct |
| Saturation boundary | RTL saturates at 2^(N-1)-1 but golden model uses Python's unbounded integers; test at exact boundary |
| Fixed-point format mismatch | RTL output is Q1.15 but golden model produces Q2.14; first noticed at large input amplitudes |
| Pipeline not flushing after reset | Old samples in pipeline registers cause first output after reset to be incorrect |

---

## 7. Likely Deferred Items

- Constrained-random coefficient loading
- Frequency-domain verification (FFT of output vs. expected spectrum)
- SNR measurement over long random sequences
- Formal verification of overflow/saturation properties
- FPGA board validation

---

*Last updated: 2026-05-03*
*Applies to: DUT category CAT-5, RTL Verification Agent Phase v1 onward*
