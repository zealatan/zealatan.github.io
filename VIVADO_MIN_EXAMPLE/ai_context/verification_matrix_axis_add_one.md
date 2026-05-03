# Verification Matrix: `axis_add_one`

**DUT:** `axis_add_one` (CAT-4 AXI-Stream Block)
**Testbench:** `tb/axis_add_one_tb.sv`
**Simulation run:** 2026-05-03
**Result:** 146/146 checks PASS, 0 failures

---

## Coverage Matrix

| ID | Requirement | Test | Checks | Evidence | Status |
|----|-------------|------|--------|----------|--------|
| V01 | m_tvalid=0 after reset | T1 | 1 | `[PASS] T1 m_tvalid=0 after reset` | PASS |
| V02 | m_tdata=0 after reset | T1 | 1 | `[PASS] T1 m_tdata=0 after reset` | PASS |
| V03 | m_tlast=0 after reset | T1 | 1 | `[PASS] T1 m_tlast=0 after reset` | PASS |
| V04 | Single-beat: tdata = input+1 | T2 | 1 | `[PASS] beat 0 tdata: 0xdeadbef0` | PASS |
| V05 | Single-beat: tlast=1 preserved | T2 | 1 | `[PASS] beat 0 tlast: 1` | PASS |
| V06 | Multi-beat: all 4 output tdata correct | T3 | 4 | beats 0–3 tdata PASS | PASS |
| V07 | Multi-beat: tlast only on last beat | T3 | 4 | beats 0–2 tlast=0; beat 3 tlast=1 | PASS |
| V08 | Back-to-back: simultaneous consume+accept path | T4 | 15 | m_tvalid=1 at beats 1–5 posedge during input | PASS |
| V09 | Back-to-back: final beat tdata/tlast correct | T4 | 3 | `[PASS] T4 tdata last beat: 0xcccc0006` | PASS |
| V10 | Backpressure: m_tvalid held when m_tready=0 | T5 | 3 | 3 stability cycles checked | PASS |
| V11 | Backpressure: m_tdata stable when stalled | T5 | 3 | m_tdata unchanged across 3 cycles | PASS |
| V12 | Backpressure: m_tlast stable when stalled | T5 | 3 | m_tlast unchanged across 3 cycles | PASS |
| V13 | Backpressure: output consumed on m_tready=1 | T5 | 2 | sb_check_beat at release posedge | PASS |
| V14 | Input stall: 3 beats with idle cycles, correct order | T6 | 6 | beats 0–2 tdata/tlast correct | PASS |
| V15 | Wraparound: 0xFFFFFFFF+1=0x00000000 | T7 | 2 | `[PASS] beat 0 tdata: 0x00000000` | PASS |
| V16 | tlast single-beat packet (tlast=1 on beat 0) | T8 | 2 | packet A beat 0 tlast=1 | PASS |
| V17 | tlast 3-beat packet (tlast on beat 2) | T8 | 6 | packet B beats 0–2 tlast correct | PASS |
| V18 | tlast 2-beat packet (tlast on beat 1) | T8 | 4 | packet C beats 0–1 tlast correct | PASS |
| V19 | Reset mid-packet: m_tvalid=0 after reset | T9 | 1 | `[PASS] T9 m_tvalid=0 after reset` | PASS |
| V20 | Reset mid-packet: m_tdata=0 after reset | T9 | 1 | `[PASS] T9 m_tdata=0 after reset` | PASS |
| V21 | Reset mid-packet: m_tlast=0 after reset | T9 | 1 | `[PASS] T9 m_tlast=0 after reset` | PASS |
| V22 | s_tready=1 after reset release | T9 | 1 | `[PASS] T9 s_tready=1 after reset` | PASS |
| V23 | Recovery transfer after reset | T9 | 2 | recovery beat tdata/tlast correct | PASS |
| V24 | Smoke: 39 beats, LFSR data, variable-length packets | T10 | 78 | beats 0–38 all tdata/tlast PASS | PASS |

**Total checks mapped:** 146/146

---

## Handoff Requirements Traceability

| Handoff test ID | Mapped to TB test | Status |
|-----------------|-------------------|--------|
| T-SINGLE | T2 | PASS |
| T-MULTI | T3 | PASS |
| T-WRAP | T7 | PASS |
| T-TLAST | T8 | PASS |
| T-BP-DN | T5 | PASS |
| T-BP-UP | T6 | PASS |
| T-BP-BOTH | T4 | PASS |
| T-RST | T1 | PASS |
| T-RST-MID | T9 | PASS |
| T-SMOKE | T10 | PASS |
| T-THRPT | T4 | PASS |
| T-VARY-BP | T10 (input idles) | PARTIAL — output backpressure in T5 |

---

*Generated: 2026-05-03*
*Simulation log: `logs/axis_add_one_xsim.log`*
