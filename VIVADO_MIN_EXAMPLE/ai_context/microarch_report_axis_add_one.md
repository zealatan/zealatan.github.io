# Microarchitecture Report: `axis_add_one`

> This document describes the **actual implemented RTL**, not the intended design.
> Updated to match `rtl/axis_add_one.v` as delivered.

---

**Version:** 1.0
**Date:** 2026-05-03
**Author:** RTL Designer Agent (Agent 3)
**RTL file:** `rtl/axis_add_one.v`
**Arch spec:** `ai_context/architecture_spec_axis_add_one.md`

---

## 1. Implemented RTL File

| File | Language | Line count | Top module |
|------|----------|------------|------------|
| `rtl/axis_add_one.v` | Verilog-2001 | 46 | `axis_add_one` |

Sub-modules instantiated: none.

---

## 2. FSM States

No explicit FSM. The DUT uses a single register `m_axis_tvalid` as an implicit buffer-occupancy flag. All control is encoded in the `always` block guard conditions.

### 2.1 Implicit Buffer State (encoded in `m_axis_tvalid`)

| State | `m_axis_tvalid` | `s_axis_tready` | Description |
|-------|-----------------|-----------------|-------------|
| EMPTY | 0 | 1 | Buffer empty; ready to accept |
| FULL\_DRAIN | 1, `m_tready=1` | 1 | Consuming output; can simultaneously accept new input |
| FULL\_STALL | 1, `m_tready=0` | 0 | Buffer occupied; upstream stalled |

State transitions (each posedge aclk):
```
EMPTY       + s_tvalid            → FULL_STALL or FULL_DRAIN (depending on m_tready)
FULL_DRAIN  + s_tvalid            → FULL_STALL or FULL_DRAIN (replace with new word)
FULL_DRAIN  + !s_tvalid           → EMPTY
FULL_STALL  + m_tready=1          → FULL_DRAIN (output now accepted this cycle)
FULL_STALL  + m_tready=0          → FULL_STALL
```

### 2.2 Priority of `always` block branches

1. `!aresetn` — highest: clears all registers
2. `s_tvalid && s_tready` — input accepted: load new word (overwrites any simultaneous consume)
3. `m_tready` — output consumed, no new input: clear buffer
4. (implicit else) — no event: hold

Note: branch 2 and branch 3 are mutually exclusive when `m_axis_tvalid=0` (branch 2 fires, branch 3 cannot since `m_tvalid=0` means buffer is empty and nothing to consume). When `m_axis_tvalid=1`: if `m_tready=1`, then `s_tready=1`, so if `s_tvalid=1` both transitions are "simultaneous" — branch 2 takes priority, loading the new word while leaving `m_tvalid=1` (correct: replace old with new).

---

## 3. Datapath Registers

| Register | Width | Reset | Updated in | Description |
|----------|-------|-------|------------|-------------|
| `m_axis_tvalid` | 1 | 0 | Branch 2 (set) / Branch 3 (clear) / Reset (clear) | Buffer-occupancy flag; also the master valid output |
| `m_axis_tdata` | DATA_WIDTH | 0 | Branch 2 | Buffered output word = input + 1 |
| `m_axis_tlast` | 1 | 0 | Branch 2 | Buffered output tlast = input tlast |

**Combinatorial signals:**

| Signal | Expression | Description |
|--------|-----------|-------------|
| `s_axis_tready` | `!m_axis_tvalid \|\| m_axis_tready` | Upstream ready; high when buffer empty or being drained |

**Arithmetic:**

| Expression | RTL | Behavior |
|-----------|-----|----------|
| `s_axis_tdata + 1` | `s_axis_tdata + {{(DATA_WIDTH-1){1'b0}}, 1'b1}` | 32-bit add; wraps at 0xFFFFFFFF → 0x00000000 |

---

## 4. Control Registers (AXI-lite visible)

None. No AXI-lite interface.

---

## 5. Output Behavior

| Output | Asserted when | Deasserted when | Registered? |
|--------|--------------|----------------|-------------|
| `s_axis_tready` | `m_tvalid=0` OR `m_tready=1` | `m_tvalid=1` AND `m_tready=0` | No (combinatorial) |
| `m_axis_tvalid` | Input accepted (branch 2) | Output consumed with no new input (branch 3) or reset | Yes |
| `m_axis_tdata` | Captured in branch 2 | N/A (holds last value) | Yes |
| `m_axis_tlast` | Captured in branch 2 | N/A (holds last value) | Yes |

---

## 6. Reset Behavior

Sensitivity list: `always @(posedge aclk or negedge aresetn)`

On `!aresetn`:
- `m_axis_tvalid` → 0
- `m_axis_tdata` → 0 (all bits)
- `m_axis_tlast` → 0
- `s_axis_tready` → 1 (combinatorial: `!0 || x = 1`)

---

## 7. Error Handling

None. No error output ports or error conditions defined.

---

## 8. Latency

| Operation | Latency (clock cycles) |
|-----------|----------------------|
| Single word: input accepted to `m_tvalid=1` | 1 cycle |
| Single word: end-to-end (tvalid+tready → downstream sees output) | 1 cycle |
| Back-to-back sustained throughput (m_tready=1 always) | 1 word/cycle (no bubbles) |
| After backpressure removed (m_tready goes 0→1) | Output resumes same cycle |

---

## 9. Resource / Complexity Notes

- No FSM states array; one register bit (`m_tvalid`) encodes buffer state
- No BRAM or DSP primitives; 1-bit adder + DATA_WIDTH registers
- Parameterized: `DATA_WIDTH` (default 32)
- Estimated resource: ~33 FFs, ~33 LUTs (1 for ready logic, 32 for adder) — minimal

---

## 10. Deviations from Architecture Spec

| # | Architecture spec claim | Actual implementation | Reason |
|---|-------------------------|-----------------------|--------|
| 1 | *(None)* | — | — |

The implementation exactly matches the architecture spec.

---

## 11. Known Limitations

- No `tkeep`, `tstrb`, `tuser`, `tid`, `tdest` sideband support
- Single-entry output buffer; maximum 1 word in-flight
- `+1` operation hardwired; no configurable operand
- `s_axis_tready` is combinatorial — `m_axis_tready` propagates to `s_axis_tready` with no registered stage; may create timing paths in physical implementation

---

## 12. Revision History

| Version | Date | RTL change | Reason |
|---------|------|------------|--------|
| 1.0 | 2026-05-03 | Initial implementation | — |

---

*Version: 1.0 — 2026-05-03*
*Used by: RTL Designer Agent (Agent 3)*
