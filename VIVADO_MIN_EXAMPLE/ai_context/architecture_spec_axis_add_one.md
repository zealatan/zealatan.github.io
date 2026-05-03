# Architecture Specification: `axis_add_one`

**Version:** 1.0
**Date:** 2026-05-03
**Author:** RTL Designer Agent (Agent 3)
**Status:** Approved

---

## 1. DUT Name

`axis_add_one`

---

## 2. Purpose

`axis_add_one` is a minimal AXI-Stream processing block. It accepts a stream of 32-bit words on its slave interface, adds the constant value 1 to each word, and forwards the result on its master interface. The `tlast` sideband is propagated unmodified. The block is intended as a prototype for the AXI-Stream RTL Designer + Verification Agent workflow and as a building block in any pipeline where a simple per-word increment is required.

---

## 3. DUT Category

Refer to `ai_context/dut_category_taxonomy.md`.

- Category: CAT-4 — AXI-Stream Processing Block
- Verification profile: `ai_context/dut_profile_axistream_block.md`

---

## 4. High-Level Behavior

- Upstream drives `s_axis_tvalid` high with a valid word on `s_axis_tdata` and optional `s_axis_tlast`.
- DUT asserts `s_axis_tready` when its internal one-entry output buffer is empty or is being simultaneously consumed downstream.
- On each cycle where `s_axis_tvalid && s_axis_tready`, the DUT captures the input word, adds 1 (modulo 2^32), and stores the result in the output buffer.
- DUT drives `m_axis_tvalid` high while the buffer holds a valid word and drives `m_axis_tdata` and `m_axis_tlast` with the buffered values.
- When downstream asserts `m_axis_tready`, the buffer is consumed; if a new input word arrives in the same cycle it replaces the consumed word without a gap cycle.
- The DUT can sustain 1 word per clock cycle throughput when downstream is always ready. Backpressure from downstream (`m_axis_tready=0`) propagates to upstream within one cycle.
- On reset (`aresetn=0`), the output buffer is cleared: `m_axis_tvalid=0`, `m_axis_tdata=0`, `m_axis_tlast=0`.

---

## 5. Inputs / Outputs Summary

| Port | Direction | Width | Description |
|------|-----------|-------|-------------|
| `aclk` | Input | 1 | Positive-edge-triggered system clock |
| `aresetn` | Input | 1 | Active-low asynchronous reset |
| `s_axis_tdata` | Input | DATA_WIDTH | Input word (slave channel) |
| `s_axis_tvalid` | Input | 1 | Input word valid (slave channel) |
| `s_axis_tlast` | Input | 1 | Last beat of input packet (slave channel) |
| `s_axis_tready` | Output | 1 | DUT ready to accept input word |
| `m_axis_tdata` | Output | DATA_WIDTH | Output word = input + 1 (master channel) |
| `m_axis_tvalid` | Output | 1 | Output word valid (master channel) |
| `m_axis_tlast` | Output | 1 | Last beat of output packet (master channel) |
| `m_axis_tready` | Input | 1 | Downstream ready to consume output word |

**Parameter:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `DATA_WIDTH` | 32 | Width of `tdata` in bits |

---

## 6. Internal Blocks

```
┌─────────────────────────────────────────────────────┐
│  axis_add_one                                        │
│                                                      │
│  ┌────────────────┐                                  │
│  │ AXI-S Slave    │  s_tvalid & s_tready             │
│  │ input accept   │─────────────────────────────┐    │
│  └────────────────┘                             │    │
│       ↑                                         ↓    │
│  s_tready (comb)                  ┌─────────────────┐│
│  = !m_tvalid || m_tready          │ One-Entry Buffer ││
│                                   │ m_tdata  (reg)   ││
│                                   │ m_tvalid (reg)   ││
│                                   │ m_tlast  (reg)   ││
│                                   └────────┬────────┘│
│                                            │         │
│                                     m_tvalid         │
│                                     m_tdata          │
│                                     m_tlast          │
└─────────────────────────────────────────────────────┘
```

---

## 7. State Machine Overview

No explicit FSM. The registered `m_axis_tvalid` signal encodes the buffer state:

| `m_axis_tvalid` | Buffer state | `s_axis_tready` |
|-----------------|-------------|-----------------|
| 0 | Empty — can always accept | 1 |
| 1, `m_axis_tready=1` | Being consumed this cycle — can accept simultaneously | 1 |
| 1, `m_axis_tready=0` | Full — cannot accept | 0 |

Transition summary:
```
EMPTY  + s_tvalid              → FULL  (capture word; assert m_tvalid)
FULL   + m_tready & !s_tvalid  → EMPTY (consume word; deassert m_tvalid)
FULL   + m_tready &  s_tvalid  → FULL  (consume and replace in same cycle)
FULL   + !m_tready             → FULL  (stall upstream)
```

---

## 8. Datapath Overview

- `m_axis_tdata[DATA_WIDTH-1:0]` (register): holds `s_axis_tdata + 1` for the buffered word.
- `m_axis_tlast` (register): holds `s_axis_tlast` of the buffered word.
- `m_axis_tvalid` (register): buffer-occupancy flag; drives the master valid signal directly.
- `s_axis_tready` (combinatorial): `!m_axis_tvalid || m_axis_tready`.
- Arithmetic: `m_axis_tdata <= s_axis_tdata + 1'b1` — natural `DATA_WIDTH`-bit truncation; `32'hFFFF_FFFF + 1 = 32'h0000_0000`.

---

## 9. Configuration / Register Map

None. No AXI-lite control interface. The `+1` operation is hardwired.

---

## 10. Error Policy

| Error Condition | Response | Observable |
|----------------|----------|------------|
| None defined | — | — |

There is no error signaling interface. `tdata` wraparound at `0xFFFF_FFFF` is correct, expected behavior (not an error).

---

## 11. Reset Policy

- Reset type: **asynchronous, active-low** (`negedge aresetn`)
- `m_axis_tvalid` → 0 (buffer empty; upstream sees ready)
- `m_axis_tdata` → 0
- `m_axis_tlast` → 0
- `s_axis_tready` → 1 (combinatorial: `!0 || x = 1`)

No register has a non-zero reset value.

---

## 12. Assumptions

- [x] Single clock domain (no CDC)
- [x] AXI-Stream handshake: transaction completes on posedge where both valid and ready are 1
- [x] `s_axis_tvalid` is not deasserted once asserted until the word is accepted (AXI requirement)
- [x] `DATA_WIDTH` is a positive multiple of 8 (default 32)
- [x] Upstream and downstream do not issue transactions during `aresetn=0`

---

## 13. Known Limitations

- No `tkeep`, `tstrb`, `tuser`, `tid`, `tdest` sideband support — only `tdata` and `tlast`
- Single-entry buffer; maximum 1 word of input buffering
- `+1` operation is hardwired; no configurable operand
- No packet length or boundary enforcement
- No multi-channel or time-division-multiplex support

---

## 14. Expected Verification Profile

- DUT profile: `ai_context/dut_profile_axistream_block.md`
- Mandatory test coverage: single-beat passthrough, multi-beat packet, backpressure from downstream, backpressure from upstream, back-to-back packets, wraparound (0xFFFF_FFFF), tlast propagation, reset mid-packet, all-valid (bubble-free) throughput check
- Expected check count estimate: ~80–120 checks
- Deferred verification items: tkeep/tstrb fields (not implemented); formal liveness proof (out of scope)

---

*Version: 1.0 — 2026-05-03*
*Used by: RTL Designer Agent (Agent 3)*
