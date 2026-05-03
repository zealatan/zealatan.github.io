# Architecture Specification Template

> **Usage:** Copy this file to `ai_context/architecture_spec_<dut_name>.md` before writing RTL.
> Fill in every section. Leave no section blank — write "N/A" or "none" if genuinely not applicable.
> This document must be complete and unambiguous before RTL writing begins.

---

# Architecture Specification: `<DUT_NAME>`

**Version:** 1.0
**Date:** YYYY-MM-DD
**Author:** RTL Designer Agent (Agent 3)
**Status:** Draft / Review / Approved

---

## 1. DUT Name

`<module_name>` — e.g., `simple_dma_add_ctrl`

---

## 2. Purpose

One paragraph. What does this DUT do? Why does it exist in the system?

---

## 3. DUT Category

Refer to `ai_context/dut_category_taxonomy.md`.

- Category: CAT-N — `<category name>`
- Verification profile: `ai_context/dut_profile_<category>.md`

---

## 4. High-Level Behavior

Describe the DUT's operation from an external observer's perspective, in 3–6 bullet points or a short paragraph. Focus on:
- How software or another agent interacts with the DUT
- What the DUT does in response
- What observable outputs are produced
- How the operation completes

**Example:**
- Software writes SRC_ADDR, DST_ADDR, LENGTH_WORDS, and ADD_VALUE to AXI-lite registers.
- Software writes CONTROL.start=1 to begin the transfer.
- DUT reads LENGTH_WORDS words from SRC_ADDR, adds ADD_VALUE to each, and writes results to DST_ADDR.
- On completion, STATUS.done=1 and STATUS.busy=0.

---

## 5. Inputs / Outputs Summary

| Port | Direction | Width | Description |
|------|-----------|-------|-------------|
| `aclk` | Input | 1 | System clock |
| `aresetn` | Input | 1 | Active-low asynchronous reset |
| `s_awaddr` | Input | 32 | AXI-lite write address |
| `...` | | | |
| `m_araddr` | Output | 32 | AXI4 master read address |
| `...` | | | |

*(List all ports. Refer to interface_contract.md for full timing and protocol details.)*

---

## 6. Internal Blocks

List the major internal sub-blocks or pipeline stages. Include instantiated sub-modules.

```
┌────────────────────────────────────────────────────┐
│  <DUT_NAME>                                         │
│                                                     │
│  ┌──────────────┐     ┌───────────────────────────┐ │
│  │ AXI-lite     │────>│ Control / Register File   │ │
│  │ Slave FSM    │     │ (start, status, config)   │ │
│  └──────────────┘     └──────────┬────────────────┘ │
│                                  │ start pulse       │
│                       ┌──────────▼────────────────┐ │
│                       │ DMA Core (sub-module)     │ │
│                       │ Reads src, processes,     │ │
│                       │ writes dst                │ │
│                       └──────────┬────────────────┘ │
│                                  │ done / results    │
│                       ┌──────────▼────────────────┐ │
│                       │ Status / Result Registers │ │
│                       └───────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

## 7. State Machine Overview

List each FSM by name and enumerate its states. Describe the main transitions informally.

**Write FSM (AXI-lite slave write path):**

| State | Description |
|-------|-------------|
| `W_IDLE` | Waiting for awvalid or wvalid |
| `W_WAIT_W` | AW received; waiting for W |
| `W_WAIT_A` | W received; waiting for AW |
| `W_BRESP` | Both received; send bvalid; decode address and write register |

**Read FSM (AXI-lite slave read path):**

| State | Description |
|-------|-------------|
| `R_IDLE` | Waiting for arvalid |
| `R_RVALID` | Latch rdata; assert rvalid; wait for rready |

*(Add additional FSMs as needed — DMA core FSM, stream FSM, etc.)*

---

## 8. Datapath Overview

Describe the main datapath: what registers hold in-flight data, what arithmetic is performed, and where results are stored.

**Example:**
- `input_lat[31:0]`: latches AXI read data from R channel
- `processed_data[31:0]`: combinatorial: `input_lat + add_lat`
- `word_idx[15:0]`: increments per word; resets to 0 on start
- `cur_src_addr`: `src_lat + word_idx * 4` (combinatorial)

---

## 9. Configuration / Register Map (if applicable)

| Address | Name | Access | Reset | Description |
|---------|------|--------|-------|-------------|
| 0x00 | CONTROL | W/R | 0x0 | bit0=start; reads busy_r |
| 0x04 | SRC_ADDR | R/W | 0x0 | Source byte address |
| ... | | | | |

---

## 10. Error Policy

Describe all error conditions and how the DUT responds:

| Error Condition | Response | STATUS field | DUT action after |
|----------------|----------|--------------|-----------------|
| AXI read SLVERR | Abort transfer | error=1, done=1 | Return to IDLE |
| AXI write SLVERR | Abort transfer | error=1, done=1 | Return to IDLE |
| Invalid AXI-lite address | SLVERR response | No STATUS change | Accept next transaction |

---

## 11. Reset Policy

- Reset type: **asynchronous, active-low** (`negedge aresetn`)
- All registers reset to 0x0 unless noted otherwise
- All FSMs return to idle state
- In-flight AXI transactions are abandoned; no bus error is issued (DUT simply stops driving)

*(Document any register that does NOT reset to 0 and explain why.)*

---

## 12. Assumptions

List every assumption about the operating environment:

- [ ] Single clock domain (no CDC)
- [ ] AXI-lite master always accepts bvalid within N cycles
- [ ] Memory slave always responds within N cycles
- [ ] LENGTH_WORDS ≤ <maximum value>
- [ ] Addresses are 4-byte aligned
- [ ] No simultaneous multiple AXI-lite transactions
- [ ] `start` is not pulsed faster than one pulse per N cycles

---

## 13. Known Limitations

List limitations that are intentional and will NOT be fixed in this design revision:

- No AXI4 burst support; single-beat only
- No scatter-gather descriptor support
- No 4KB boundary split handling
- No misaligned address support
- No multiple outstanding AXI transactions

---

## 14. Expected Verification Profile

- DUT profile: `ai_context/dut_profile_<category>.md`
- Mandatory test coverage: (list key test IDs from the profile)
- Expected check count estimate: (rough number)
- Deferred verification items: (list anything not planned for initial verification)

---

*Template version: 1.0 — 2026-05-03*
*Used by: RTL Designer Agent (Agent 3)*
