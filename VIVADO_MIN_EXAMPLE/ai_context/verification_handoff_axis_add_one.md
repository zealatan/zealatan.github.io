# Verification Handoff: `axis_add_one`

> **Note:** This document is the **primary handoff from RTL Designer Agent (Agent 3) to RTL Verification Agent (Agent 4)**.
>
> The Verification Agent reads this document to understand what the DUT is supposed to do, which test scenarios are required, and what constitutes a complete verification campaign.
>
> **Do not change this file after handoff without notifying Agent 4 and issuing a new revision.**

---

**Version:** 1.0
**Date:** 2026-05-03
**From:** RTL Designer Agent (Agent 3)
**To:** RTL Verification Agent (Agent 4)
**RTL file:** `rtl/axis_add_one.v`
**Interface contract:** `ai_context/interface_contract_axis_add_one.md`
**Microarchitecture report:** `ai_context/microarch_report_axis_add_one.md`

---

## 1. DUT Name and RTL File

- **Module name:** `axis_add_one`
- **RTL file:** `rtl/axis_add_one.v`
- **Language:** Verilog-2001
- **Dependencies:** None (no sub-modules)

---

## 2. DUT Category

- **Category:** CAT-4 — AXI-Stream Processing Block (from `ai_context/dut_category_taxonomy.md`)
- **Recommended profile:** `ai_context/dut_profile_axistream_block.md`

No deviations from the standard CAT-4 profile. The DUT has no AXI-lite control interface; all CAT-4 register-access tests are not applicable (see §3).

---

## 3. Recommended Verification Profile

- **Profile document:** `ai_context/dut_profile_axistream_block.md`
- **Deviations from standard profile:**
  - `T-REG-*` tests: Not applicable — no AXI-lite register interface.
  - Scoreboard rule: `output_tdata = input_tdata + 1` (mod 2^32); `output_tlast = input_tlast`.

---

## 4. Required Tests

| ID | Scenario | Priority | Notes |
|----|----------|----------|-------|
| T-SINGLE | Single-beat transfer (no backpressure) | High | Minimum functional proof |
| T-MULTI | Multi-beat packet (≥4 words, all tready=1) | High | Verify all output words and final tlast |
| T-WRAP | Wraparound: input=0xFFFF_FFFF | High | Expected output=0x0000_0000; no error |
| T-TLAST | `tlast=1` propagation | High | Output tlast must equal input tlast per word |
| T-BP-DN | Downstream backpressure (m_tready=0 mid-packet) | High | s_tready must deassert; upstream stalled |
| T-BP-UP | Upstream stall (s_tvalid=0 mid-packet) | Medium | Output holds valid until m_tready consumes it |
| T-BP-BOTH | Simultaneous consume + accept (m_tready=1, s_tvalid=1 same cycle) | High | No bubble; throughput=1 word/cycle |
| T-RST | Reset deasserted; all outputs at reset defaults | High | m_tvalid=0, m_tdata=0, m_tlast=0 |
| T-RST-MID | Reset asserted mid-packet | High | Buffer cleared; s_tready=1 after reset |
| T-SMOKE | Deterministic smoke: ≥10 words, full scoreboard | Medium | Verify every output word |
| T-THRPT | Sustained throughput: ≥8 words with m_tready=1 always | Medium | No idle cycles between output words |
| T-VARY-BP | Variable downstream backpressure across a packet | Medium | Randomize m_tready; full scoreboard |

---

## 5. Expected Normal Behavior

Golden-path operation for a 3-word packet (`tlast` on word 2):

1. Drive `m_axis_tready=1` (downstream always ready).
2. Cycle 1: Drive `s_axis_tdata=D0`, `s_axis_tvalid=1`, `s_axis_tlast=0` on negedge aclk.
3. Cycle 1 posedge: `s_axis_tready=1` → transaction completes. DUT captures `D0+1` into buffer.
4. Cycle 2 posedge: `m_axis_tvalid=1`, `m_axis_tdata=D0+1`, `m_axis_tlast=0`. Downstream accepts.
5. Simultaneously (same cycle 2): Drive `s_axis_tdata=D1`, `s_axis_tvalid=1`, `s_axis_tlast=0`.
6. Cycle 2 posedge: second input accepted (`s_tready=1` since `m_tready=1`). Buffer loads `D1+1`.
7. Cycle 3 posedge: `m_axis_tdata=D1+1`, `m_axis_tlast=0`. Drive `s_tdata=D2`, `s_tlast=1`.
8. Cycle 3 posedge: third input accepted. Buffer loads `D2+1`, `m_tlast=1`.
9. Cycle 4 posedge: `m_axis_tdata=D2+1`, `m_axis_tlast=1`. Downstream accepts.
10. Cycle 5: `m_axis_tvalid=0` (buffer empty, no new input).

**Scoreboard rule:**
```
output_tdata[i] = input_tdata[i] + 1  (mod 2^DATA_WIDTH)
output_tlast[i] = input_tlast[i]
```

---

## 6. Expected Error Behavior

None defined. `axis_add_one` has no error outputs. Wraparound (`0xFFFFFFFF + 1 = 0x00000000`) is expected correct behavior, not an error.

---

## 7. Reset Behavior to Verify

After `aresetn` is asserted and deasserted:

| Signal | Expected value |
|--------|---------------|
| `m_axis_tvalid` | 0 |
| `m_axis_tdata` | 0x00000000 |
| `m_axis_tlast` | 0 |
| `s_axis_tready` | 1 (combinatorial: `!0 \|\| x = 1`) |

Reset mid-packet: the output buffer is cleared immediately. Any in-flight buffered word is discarded. Upstream sees `s_tready=1` on the first cycle after reset release, regardless of whether `m_tready` is high.

---

## 8. Corner Cases to Verify

| Corner case | Why important | Expected behavior |
|-------------|--------------|-------------------|
| `s_tdata = 32'hFFFF_FFFF` | Wraparound arithmetic | `m_tdata = 32'h0000_0000` |
| `s_tdata = 32'h0000_0000` | Zero input | `m_tdata = 32'h0000_0001` |
| `s_tlast=0` on every word | Packet without termination | `m_tlast=0` on every output |
| `s_tlast=1` on every word | Every word is a single-beat packet | `m_tlast=1` on every output |
| `m_tready=0` then `=1` immediately | Backpressure release | Output resumes same cycle `m_tready` goes high |
| Reset when buffer is full | `m_tvalid=1` before reset | `m_tvalid=0` one cycle after `aresetn` deasserted |
| Back-to-back single-beat packets | No inter-packet gap | `m_tvalid` stays 1 with no gap when `m_tready` is always 1 |
| Single word packet (`s_tvalid=1` then `s_tvalid=0`) | Basic single-beat | `m_tvalid` goes 1 then 0 after output accepted |

---

## 9. Suggested Scoreboard Rule

For each input word accepted at time `t`:
```
output_tdata = input_tdata + 1  (mod 2^DATA_WIDTH, no error flag)
output_tlast = input_tlast
```

There is exactly one output word per input word. The output appears exactly 1 cycle after the input is accepted (when downstream is ready). If downstream is backpressuring, the output word remains stable in the buffer until consumed.

The testbench should build an ordered queue of expected output words as inputs are accepted, then compare each output word as it is consumed by the downstream.

---

## 10. Suggested Evidence

| Evidence | Required |
|----------|----------|
| Simulation log with all `[PASS]` | Yes |
| Zero `[FAIL]` or `FATAL` | Yes |
| CI grep gate exit code 0 | Yes |
| Check count matching expected (≥80) | Yes |
| Full scoreboard: every output word verified | Yes |
| `ai_context/verification_matrix.md` entries for axis_add_one | Yes |
| `ai_context/known_limitations.md` deferred items noted | Yes |

---

## 11. Deferred Verification Items

| Item | Reason |
|------|--------|
| `tkeep` / `tstrb` / `tuser` sideband | Not implemented in RTL |
| DATA_WIDTH != 32 parametric sweep | Out of scope for initial campaign |
| Formal liveness proof (s_tready eventually=1) | Out of scope for simulation-only phase |
| Physical timing / FPGA board validation | Agent 5 scope |
| Multiple simultaneous outstanding inputs | Not supported (single-entry buffer) |

---

## 12. Revision History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-05-03 | Initial handoff |

---

*Template version: 1.0 — 2026-05-03*
*From: RTL Designer Agent (Agent 3) → To: RTL Verification Agent (Agent 4)*
