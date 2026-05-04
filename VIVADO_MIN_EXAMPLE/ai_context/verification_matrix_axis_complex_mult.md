# Verification Matrix: `axis_complex_mult`

**DUT:** `axis_complex_mult` (CAT-4 AXI-Stream Processing Block / CAT-5 DSP Pipeline)
**Testbench:** `tb/axis_complex_mult_tb.sv`
**Simulation run:** 2026-05-03
**Result:** 33/33 checks PASS, 0 failures

---

## Coverage Matrix

| ID | Requirement (from verification_handoff) | Test | Checks | Evidence | Status |
|----|----------------------------------------|------|--------|----------|--------|
| V01 | m_tvalid=0 after reset | T1 | 1 | `[PASS] T1 reset: outputs clear during reset` | PASS |
| V02 | m_tdata=0 after reset | T1 | 1 | T1 checks `m_axis_tdata !== 32'h0` | PASS |
| V03 | m_tlast=0 after reset | T1 | 1 | T1 checks `m_axis_tlast !== 1'b0` | PASS |
| V04 | Real×Real arithmetic (T-MATH-RR) | T4 | 2 | `[PASS] T4 rr[0] 0.75x0.5  data=0x30000000`; `[PASS] T4 rr[1]` | PASS |
| V05 | Imaginary product path exercised (T-MATH-II) | T3/T6/T12 | — | T3 vec[1], T6 neg[1] exercise pii term; golden mirrors RTL exactly | PASS |
| V06 | Full complex product (T-MATH-FULL) | T3/T6/T12 | 3+ | T3 vec[1–2], T6 neg[0–1], T12 80 random full-complex beats | PASS |
| V07 | Multi-pair sequence output order (T-MULTI) | T3/T11/T12 | 5+ | T3 ×3, T11 ×5 back-to-back, T12 ×80 | PASS |
| V08 | Back-to-back throughput, 1 pair/cycle (T-THRPT) | T11 | 5 | `[PASS] T11 beat[0–4]` at consecutive posedges, no idle gap | PASS |
| V09 | Output backpressure: m_tvalid stable (T-OUT-BP) | T8 | 3 | `[PASS] T8 stall cycle: tvalid=1 data stable` ×3 | PASS |
| V10 | Output backpressure: m_tdata/tlast stable | T8 | 3 | T8 compares against captured stable_data ×3 | PASS |
| V11 | Output consumed after backpressure release | T8 | 1 | `[PASS] T8 accepted after stall  data=0x30000000` | PASS |
| V12 | A-valid-only: s_a_tready=0, no output (T-ONE-CHAN) | T9 | 3 | `[PASS] T9 A-only stall: no accept, no output` ×3 | PASS |
| V13 | A-only then B arrives → correct output | T9 | 1 | `[PASS] T9 output after B driven` | PASS |
| V14 | B-valid-only: s_b_tready=0, no output (T-ONE-CHAN) | T10 | 3 | `[PASS] T10 B-only stall: no accept, no output` ×3 | PASS |
| V15 | B-only then A arrives → correct output | T10 | 1 | `[PASS] T10 output after A driven` | PASS |
| V16 | TLAST: a=0,b=0 → out=0 (T-TLAST) | T5 | 1 | `[PASS] T5 tlast al=0 bl=0  data=0x20000000 tlast=0` | PASS |
| V17 | TLAST: a=1,b=0 → out=1 | T5 | 1 | `[PASS] T5 tlast al=1 bl=0  data=0x20000000 tlast=1` | PASS |
| V18 | TLAST: a=0,b=1 → out=1 | T5 | 1 | `[PASS] T5 tlast al=0 bl=1  data=0x20000000 tlast=1` | PASS |
| V19 | TLAST: a=1,b=1 → out=1 | T5 | 1 | `[PASS] T5 tlast al=1 bl=1  data=0x20000000 tlast=1` | PASS |
| V20 | Overflow/wrap: no saturation, truncation only (T-WRAP) | T7 | 2 | `[PASS] T7 wrap[0]  data=0xfffdffff`; `[PASS] T7 wrap[1]  data=0x00000000` | PASS |
| V21 | Negative real×positive real product | T6 | 1 | `[PASS] T6 neg[0]  data=0xe0000000 tlast=0` | PASS |
| V22 | Mixed sign complex product | T6 | 1 | `[PASS] T6 neg[1]  data=0x20002000 tlast=0` | PASS |
| V23 | Deterministic smoke: 80 beats, inline golden (T-SMOKE) | T12 | 1 | `[PASS] T12 smoke: 80/80 beats + 20 bp stall cycles verified` | PASS |
| V24 | Smoke: TLAST propagation under random last signals | T12 | — | T12 generates a_last/b_last from xorshift32, all 80 tlast checks pass | PASS |
| V25 | Smoke: backpressure stall hold under random data | T12 | 20 | 20 bp stall cycles verified across 10 backpressure events | PASS |

---

## AXI-Stream Profile Coverage (CAT-4)

| Profile Check | Test | Result |
|--------------|------|--------|
| tvalid/tready handshake — normal accept | T2/T3/T4 | PASS |
| Output deasserts after drain (m_tvalid=0) | T8/T9/T10 | PASS |
| buf_ready = !m_tvalid ∥ m_tready holds | T8 stall checks | PASS |
| s_a_tready gated by s_b_tvalid | T9 (b_valid=0 → a_tready=0) | PASS |
| s_b_tready gated by s_a_tvalid | T10 (a_valid=0 → b_tready=0) | PASS |
| Output backpressure: tvalid+tdata stable | T8 ×3 cycles | PASS |
| Back-to-back: 1 pair/cycle throughput | T11 ×5 consecutive posedges | PASS |
| TLAST OR policy: 4-combo matrix | T5 ×4 | PASS |

---

## DSP Pipeline Profile Coverage (CAT-5)

| Profile Check | Test | Result |
|--------------|------|--------|
| Real×real path (prr) | T2/T4 | PASS |
| Imaginary×imaginary path (pii, subtracted) | T3/T6 (neg[1] has b_imag≠0) | PASS |
| Real×imaginary cross-products (pri, pir) | T3 vec[1]/T6 | PASS |
| 33-bit accumulation (no carry loss) | T3/T6/T7 exercise all sign combos | PASS |
| Q1.15 scale: out = accum[30:15] | T4 rr[0]: 0.75×0.5=0x3000 exact | PASS |
| Signed negative inputs | T6 neg[0]: (−0.5)×(0.5)=−0.25 | PASS |
| Overflow wrap (no saturation) | T7 wrap[0–1] | PASS |
| Wide random arithmetic coverage | T12 ×80 beats, xorshift32 | PASS |

---

## Deferred Items

| ID | Item | Disposition |
|----|------|-------------|
| D-RST-MID | T-RST-MID: reset mid-stream recovery | NOT COVERED in this campaign |
| D1 | DATA_WIDTH ≠ 32 parametric sweep | Out of scope (CW=16, SHIFT=15 only) |
| D2 | Saturation variant | Not implemented in RTL |
| D3 | tkeep / tstrb / tuser signals | Not supported by DUT |
| D4 | Independent per-channel buffering | Architectural variant |
| D5 | Formal proof of deadlock freedom | Simulation-only campaign |
| D6 | Round-to-nearest output | Not implemented; truncation only |
| D7 | Python golden model comparison | Inline SV golden used; Python optional |
| D8 | Pipelined version (N-stage) | Out of scope |
| D9 | X-propagation under partial reset | Not tested |
| D10 | CDC lint / timing closure | Not in simulation scope |
| D11 | FPGA board validation | Not in simulation scope |
