# Verification Handoff Template

> **Note:** This document is the **primary handoff from RTL Designer Agent (Agent 3) to RTL Verification Agent (Agent 4)**.
>
> The Verification Agent reads this document to understand what the DUT is supposed to do, which test scenarios are required, and what constitutes a complete verification campaign.
>
> **Usage:** Copy this file to `ai_context/verification_handoff_<dut_name>.md` after RTL is complete.
> Deliver this file to Agent 4 simultaneously with the RTL file.
> Do not change this file after handoff without notifying Agent 4 and updating the version.

---

# Verification Handoff: `<DUT_NAME>`

**Version:** 1.0
**Date:** YYYY-MM-DD
**From:** RTL Designer Agent (Agent 3)
**To:** RTL Verification Agent (Agent 4)
**RTL file:** `rtl/<dut_name>.v`
**Interface contract:** `ai_context/interface_contract_<dut_name>.md`
**Microarchitecture report:** `ai_context/microarch_report_<dut_name>.md`

---

## 1. DUT Name and RTL File

- **Module name:** `<module_name>`
- **RTL file:** `rtl/<dut_name>.v`
- **Language:** Verilog-2001 / SystemVerilog
- **Dependencies:** (list any sub-modules or included files)

---

## 2. DUT Category

- **Category:** CAT-N — `<category name>` (from `ai_context/dut_category_taxonomy.md`)
- **Recommended profile:** `ai_context/dut_profile_<category>.md`

If the DUT does not cleanly match an existing category, note the nearest match and list the differences.

---

## 3. Recommended Verification Profile

Reference the DUT profile document directly. Note any deviations from the standard profile for this specific DUT:

- **Profile document:** `ai_context/dut_profile_<category>.md`
- **Deviations from standard profile:**
  - `<Test ID>`: `<Reason this test is not applicable or has modified requirements>`

---

## 4. Required Tests

List the test scenarios that must pass for verification to be considered closed. Use the IDs from the DUT profile where applicable.

| ID | Scenario | Priority | Notes |
|----|----------|----------|-------|
| T-REG | Register read/write + invalid address SLVERR | High | All N registers; reset defaults |
| T-NORM1 | 1-word normal transfer | High | Minimum functional proof |
| T-NORM-N | Multi-word normal transfer | High | Verify all dst words |
| T-IDENT | Identity/passthrough mode | Medium | ADD_VALUE=0 or equivalent |
| T-OVF | Overflow wraparound | Medium | Verify no spurious error |
| T-ZLEN | Zero-length transfer | High | done=1, count=0, no AXI traffic |
| T-ERR-R | Invalid source address | High | error=1; partial count |
| T-ERR-W | Invalid destination address | High | error=1; canary unchanged |
| T-BUSY-RD | Busy-state register read | High | STATUS.busy=1 visible |
| T-BUSY-TRIG | Busy retrigger guard | High | Second start silently ignored |
| T-BUSY-CFG | Config write while busy | Medium | New values readable after done |
| T-ERR-RESTART | Restart after error | High | Clean transfer after error |
| T-RST-XFR | Reset during transfer | High | All registers=0 post-reset |
| T-RST-RECOVER | Post-reset fresh transfer | High | DUT fully functional after reset |
| T-REPEAT | Repeated normal restart | Medium | ≥5 sequential transfers |
| T-SMOKE | Deterministic valid-transfer smoke | Medium | ≥10 iterations |
| T-WO-AW | AW-before-W write ordering | Medium | W_WAIT_W path exercised |
| T-WO-W | W-before-AW write ordering | Medium | W_WAIT_A path exercised |
| T-BP-B | B-channel backpressure | Medium | bvalid held; OKAY and SLVERR |
| T-BP-R | R-channel backpressure | Medium | rvalid held; all readable regs |

*(Add or remove rows as appropriate for this specific DUT.)*

---

## 5. Expected Normal Behavior

Describe the golden-path operation sequence that the testbench should follow for a normal transfer:

1. Program SRC_ADDR = `<value>`
2. Program DST_ADDR = `<value>`
3. Program LENGTH_WORDS = `<value>`
4. Program `<processing operand>` = `<value>`
5. Write CONTROL.start = 1
6. Poll STATUS.done until 1 (timeout after N cycles)
7. Expected STATUS: done=1, error=0, busy=0
8. Expected PROCESSED_COUNT: `<value>`
9. Expected LAST_INPUT_DATA: `<last src word value>`
10. Expected LAST_OUTPUT_DATA: `<last src word + operand>`
11. Expected destination memory: `dst[i] = src[i] <operation> operand`

---

## 6. Expected Error Behavior

### Read Error
- Stimulus: SRC_ADDR points to out-of-range memory; LENGTH long enough that OOB is reached mid-transfer
- Expected: transfer aborts at word N; PROCESSED_COUNT = N-1 (words successfully written before error); STATUS.error=1
- Expected LAST_INPUT_DATA: memory model returns 0x0 for OOB read
- Expected LAST_OUTPUT_DATA: 0x0 + operand = operand value

### Write Error
- Stimulus: DST_ADDR points such that word N is out-of-range
- Expected: transfer aborts after failed write; PROCESSED_COUNT = N-1; STATUS.error=1
- Expected LAST_INPUT_DATA: the input of the failed word
- Expected LAST_OUTPUT_DATA: the processed value of the failed word

### Invalid AXI-lite Address
- Any address outside `[0x00..0x<max_addr>]`
- Expected write response: `bresp=SLVERR`; no register modified
- Expected read response: `rresp=SLVERR`, `rdata=0x0`

---

## 7. Reset Behavior to Verify

After `aresetn` is asserted and deasserted:

| Register | Expected value |
|----------|---------------|
| CONTROL | 0x00000000 |
| SRC_ADDR | 0x00000000 |
| DST_ADDR | 0x00000000 |
| LENGTH_WORDS | 0x00000000 |
| `<processing operand>` | 0x00000000 |
| STATUS | 0x00000000 |
| PROCESSED_COUNT | 0x00000000 |
| LAST_INPUT_DATA | 0x00000000 |
| LAST_OUTPUT_DATA | 0x00000000 |

Reset during transfer: no guarantee on number of destination words written before reset; canary words outside the destination region must be unaffected.

---

## 8. Corner Cases to Verify

| Corner case | Why important | Expected behavior |
|-------------|--------------|-------------------|
| LENGTH_WORDS = 0 | Edge case that must not stall | done=1 immediately, count=0 |
| Overflow: `max_value + operand` wraps | Tests 32-bit arithmetic | Result = (max_value + operand) mod 2^32; no error |
| Start while done=1 | Restart after completion | done is cleared; new transfer begins |
| Start while error=1 | Restart after error | error is cleared; new transfer begins |
| Start while busy=1 (re-trigger) | Must be silently ignored | DMA uses original parameters; busy stays 1 |
| Config write while busy | Parameters take effect next transfer | Post-transfer readback shows new values |

---

## 9. Suggested Scoreboard Rule

For each transferred word at index `i` (0-indexed):
```
expected_dst[i] = src_mem[src_addr/4 + i] <operation> operand
```

For simple add:
```
expected_dst[i] = src_mem[src_addr/4 + i] + add_value   (mod 2^32)
```

LAST_INPUT_DATA = `src_mem[src_addr/4 + length_words - 1]`
LAST_OUTPUT_DATA = `src_mem[src_addr/4 + length_words - 1] + add_value` (mod 2^32)
PROCESSED_COUNT = `length_words` on success; `<N completed before error>` on error

---

## 10. Suggested Evidence

| Evidence | Required |
|----------|----------|
| Simulation log with all `[PASS]` | Yes |
| Zero `[FAIL]` or `FATAL` | Yes |
| CI grep gate exit code 0 | Yes |
| Check count matching expected | Yes |
| `ai_context/verification_matrix.md` entries | Yes |
| `ai_context/known_limitations.md` deferred items | Yes |

---

## 11. Deferred Verification Items

The following scenarios are intentionally deferred from the initial verification campaign:

| Item | Reason |
|------|--------|
| AXI4 burst support | Not implemented in RTL |
| Multiple outstanding transactions | Not supported |
| Misaligned address behavior | Undefined per interface contract |
| Src/dst memory overlap | Undefined per interface contract |
| Formal property verification | Out of scope for simulation-only phase |
| FPGA board validation | Agent 5 scope |

---

## 12. Revision History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | YYYY-MM-DD | Initial handoff |

---

*Template version: 1.0 — 2026-05-03*
*From: RTL Designer Agent (Agent 3) → To: RTL Verification Agent (Agent 4)*
