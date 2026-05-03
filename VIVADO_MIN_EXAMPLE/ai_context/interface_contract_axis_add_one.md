# Interface Contract: `axis_add_one`

> **Important:** This document is the primary contract used by the RTL Verification Agent (Agent 4).
> Every claim here will be directly tested. Ambiguous entries cause ambiguous tests.
> This document was completed before RTL was written. Do not change it after verification handoff without issuing a new revision.

---

**Version:** 1.0
**Date:** 2026-05-03
**Author:** RTL Designer Agent (Agent 3)
**Consumed by:** RTL Verification Agent (Agent 4)
**Status:** Final

---

## 1. Clock and Reset

| Signal | Direction | Description |
|--------|-----------|-------------|
| `aclk` | Input | Positive-edge-triggered system clock |
| `aresetn` | Input | Active-low asynchronous reset |

**Reset type:** Asynchronous (sensitive to `negedge aresetn`).
**Reset release:** The DUT exits reset on the rising edge of `aclk` following `aresetn` going high.
**Reset duration:** Minimum 1 clock cycle of `aresetn=0`; recommend ≥4 cycles for testbench margin.

---

## 2. Input Ports

| Port | Width | Description | Valid range / notes |
|------|-------|-------------|---------------------|
| `s_axis_tdata` | DATA_WIDTH | Input data word | Any bit pattern |
| `s_axis_tvalid` | 1 | Input data valid | 0 or 1; once asserted must stay 1 until accepted |
| `s_axis_tlast` | 1 | Last beat of input packet | 0 or 1; sampled with tdata on acceptance |
| `m_axis_tready` | 1 | Downstream ready | 0 or 1; may change any cycle |

*(DATA_WIDTH = 32 unless overridden by parameter.)*

---

## 3. Output Ports

| Port | Width | Reset value | Description |
|------|-------|-------------|-------------|
| `s_axis_tready` | 1 | 1 | DUT ready to accept input (combinatorial; see §6) |
| `m_axis_tdata` | DATA_WIDTH | 0 | Output data = input + 1 |
| `m_axis_tvalid` | 1 | 0 | Output buffer valid |
| `m_axis_tlast` | DATA_WIDTH | 0 | Last beat of output packet; mirrors input tlast |

---

## 4. AXI-lite Slave Interface

Not applicable. `axis_add_one` has no AXI-lite control interface.

---

## 5. AXI4 Master Interface

Not applicable.

---

## 6. AXI-Stream Interface

### 6.1 Input Stream (Slave)

| Signal | Width | Direction | Description |
|--------|-------|-----------|-------------|
| `s_axis_tdata` | DATA_WIDTH | Input | Data payload |
| `s_axis_tvalid` | 1 | Input | Data valid |
| `s_axis_tready` | 1 | Output | DUT ready |
| `s_axis_tlast` | 1 | Input | Last beat of packet |

### 6.2 Output Stream (Master)

| Signal | Width | Direction | Description |
|--------|-------|-----------|-------------|
| `m_axis_tdata` | DATA_WIDTH | Output | Processed data (input + 1 mod 2^DATA_WIDTH) |
| `m_axis_tvalid` | 1 | Output | Output valid |
| `m_axis_tready` | 1 | Input | Downstream ready |
| `m_axis_tlast` | 1 | Output | Last beat of output packet |

### 6.3 Backpressure Rule

```
s_axis_tready = !m_axis_tvalid || m_axis_tready
```

This is **combinatorial** (no registered pipeline stage between m_tready and s_tready).

Implication: when `m_axis_tready=0` and `m_axis_tvalid=1`, `s_axis_tready=0`. Upstream must hold `s_axis_tvalid` and `s_axis_tdata` stable until the word is accepted.

When `m_axis_tready=1` (or `m_axis_tvalid=0`), `s_axis_tready=1` and a new input word can be accepted simultaneously with the output word being consumed.

### 6.4 Unsupported Sideband Signals

The following AXI-Stream sideband signals are **not implemented**. They must not be driven or checked in the testbench:

- `tkeep`
- `tstrb`
- `tuser`
- `tid`
- `tdest`

---

## 7. Valid/Ready Semantics

- A transaction completes on the rising edge of `aclk` where both `valid=1` and `ready=1` simultaneously.
- Once `s_axis_tvalid` is asserted, it must not be deasserted until `s_axis_tready=1` accepts the word.
- `s_axis_tready` may be asserted before `s_axis_tvalid` (speculative ready is allowed and normal).
- `m_axis_tvalid` must not be deasserted once asserted until `m_axis_tready=1` accepts the output word. Exception: `aresetn=0` clears `m_axis_tvalid` unconditionally.
- `m_axis_tready` may be asserted before `m_axis_tvalid`.

---

## 8. Timing Assumptions

- Testbench drives AXI-Stream input signals on **negedge aclk**; samples DUT outputs on **posedge aclk**.
- `aresetn` is driven on **negedge aclk**.
- All setup/hold requirements relative to `aclk` are assumed met (simulation only).
- Minimum reset duration: **4 clock cycles** of `aresetn=0` (testbench convention).

---

## 9. Reset Values

All output ports return to the following values when `aresetn=0`:

| Signal | Reset value |
|--------|-------------|
| `m_axis_tvalid` | 0 |
| `m_axis_tdata` | 0 |
| `m_axis_tlast` | 0 |
| `s_axis_tready` | 1 (combinatorial: `!0 \|\| x = 1`) |

---

## 10. Functional Contract

| Input condition | Expected output |
|----------------|----------------|
| `s_tdata = D`, `s_tlast = L` accepted | `m_tdata = D + 1` (mod 2^DATA_WIDTH), `m_tlast = L` |
| `s_tdata = 32'hFFFF_FFFF`, `s_tlast = 0` accepted | `m_tdata = 32'h0000_0000`, `m_tlast = 0` (wraparound) |
| `s_tdata = 32'hFFFF_FFFF`, `s_tlast = 1` accepted | `m_tdata = 32'h0000_0000`, `m_tlast = 1` |
| Reset asserted mid-packet | `m_tvalid = 0`, `m_tdata = 0`, `m_tlast = 0`; buffer cleared |
| `m_tready = 0`, `m_tvalid = 1` | `s_tready = 0`; upstream stalled |
| `m_tready = 1`, `m_tvalid = 0` | `s_tready = 1`; DUT ready to accept |

**Latency:** 1 clock cycle from input acceptance to output valid assertion.

**Throughput:** 1 word per clock cycle when `m_axis_tready=1` continuously.

---

## 11. Error / Response Behavior

There are no error response signals. `axis_add_one` does not generate any error indication. The `+1` wraparound at 0xFFFFFFFF is defined, expected behavior.

---

## 12. Unsupported Behavior

The following scenarios are outside the scope of this design. Behavior is **undefined**:

- Asserting `s_axis_tvalid` and then deasserting it before `s_axis_tready` (AXI protocol violation)
- Driving `s_axis_tdata` or `s_axis_tlast` unstable while `s_axis_tvalid=1` and `s_axis_tready=0`
- Any DATA_WIDTH other than a positive multiple of 8
- `start` asserted while `aresetn=0` (no start signal; not applicable)
- Multiple simultaneous outstanding inputs (single-entry buffer; exactly one buffered word maximum)

---

## 13. Revision History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-05-03 | Initial contract |

---

*Template version: 1.0 — 2026-05-03*
*Used by: RTL Designer Agent (Agent 3) → RTL Verification Agent (Agent 4)*
