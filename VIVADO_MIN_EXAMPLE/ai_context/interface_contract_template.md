# Interface Contract Template

> **Usage:** Copy this file to `ai_context/interface_contract_<dut_name>.md` before writing RTL.
> **Important:** This document is the primary contract used by the RTL Verification Agent (Agent 4).
> Every claim here will be directly tested. Ambiguous entries cause ambiguous tests.
> Complete this document before writing RTL. Do not change it after verification handoff without issuing a new revision.

---

# Interface Contract: `<DUT_NAME>`

**Version:** 1.0
**Date:** YYYY-MM-DD
**Author:** RTL Designer Agent (Agent 3)
**Consumed by:** RTL Verification Agent (Agent 4)
**Status:** Draft / Review / Final

---

## 1. Clock and Reset

| Signal | Direction | Description |
|--------|-----------|-------------|
| `aclk` | Input | Positive-edge-triggered system clock |
| `aresetn` | Input | Active-low reset |

**Reset type:** Asynchronous (sensitive to `negedge aresetn`).
**Reset release:** Synchronous to the rising edge of `aclk` after `aresetn` goes high.
**Reset duration:** Minimum N clock cycles of `aresetn=0` required for correct reset.

---

## 2. Input Ports

| Port | Width | Description | Valid range / notes |
|------|-------|-------------|---------------------|
| `<port_name>` | N | Description | Notes |

*(List all non-AXI input ports. Use separate sections below for AXI signals.)*

---

## 3. Output Ports

| Port | Width | Reset value | Description |
|------|-------|-------------|-------------|
| `<port_name>` | N | 0x0 | Description |

*(List all non-AXI output ports. State the reset value for every output.)*

---

## 4. AXI-lite Slave Interface (if applicable)

**Supported write orderings:**
- [x] Simultaneous AW+W (W_IDLE → W_BRESP)
- [x] AW-before-W (W_IDLE → W_WAIT_W → W_BRESP)
- [x] W-before-AW (W_IDLE → W_WAIT_A → W_BRESP)

**Register map:**

| Byte address | Name | Access | Reset default | Description |
|-------------|------|--------|---------------|-------------|
| 0x00 | `CONTROL` | W/R | 0x00000000 | bit0=start (W1S); reads busy_r |
| 0x04 | `SRC_ADDR` | R/W | 0x00000000 | Source byte address |
| 0x08 | `DST_ADDR` | R/W | 0x00000000 | Destination byte address |
| ... | | | | |

**Invalid address policy:**
- Addresses outside `[0x00..0xNN]`: write returns `bresp=SLVERR`; read returns `rresp=SLVERR, rdata=0x0`
- No register is modified on an invalid write

**WSTRB:** All write transactions use `wstrb=4'hF` (full-word writes). Partial WSTRB behavior: `<declared or "not applicable">`

---

## 5. AXI4 Master Interface (if applicable)

**Transaction type:** Single-beat only (`AxLEN=0`, `AxBURST=INCR`)

| Channel | Key signals | Notes |
|---------|-------------|-------|
| AR | arvalid, araddr, arlen=0, arsize=2 | Address presented one cycle; arready expected same or next cycle |
| R | rvalid, rdata, rresp, rready | DUT asserts rready when ready to accept data |
| AW | awvalid, awaddr | Simultaneous with W channel |
| W | wvalid, wdata, wstrb=4'hF, wlast=1 | Single beat |
| B | bvalid, bresp, bready | DUT asserts bready when ready to accept response |

**Transaction ordering:** Read before write per word; one outstanding transaction at a time.

**Error response handling:**
- `rresp=SLVERR`: transfer aborts; STATUS.error=1
- `bresp=SLVERR`: transfer aborts; STATUS.error=1

---

## 6. AXI-Stream Interface (if applicable)

**Input stream (slave):**

| Signal | Width | Description |
|--------|-------|-------------|
| `s_axis_tvalid` | 1 | Data valid |
| `s_axis_tready` | 1 | DUT ready to accept |
| `s_axis_tdata` | N | Data payload |
| `s_axis_tlast` | 1 | Last beat of packet/frame |

**Output stream (master):**

| Signal | Width | Description |
|--------|-------|-------------|
| `m_axis_tvalid` | 1 | Output data valid |
| `m_axis_tready` | 1 | Downstream ready |
| `m_axis_tdata` | N | Processed data |
| `m_axis_tlast` | 1 | Last beat of output packet |

**Backpressure:** `<Does m_axis_tready=0 stall s_axis_tready? After how many cycles?>`

---

## 7. Valid/Ready Semantics

- A transaction completes on the clock edge where both `valid=1` and `ready=1` simultaneously.
- The DUT must not deassert `valid` once asserted until the transaction is accepted (AXI requirement).
- `ready` may be asserted before `valid` (speculative ready is allowed).
- The DUT must not require both AW and W channels simultaneously — each is accepted independently.

---

## 8. Timing Assumptions

- Testbench drives AXI signals on **negedge aclk**; samples DUT outputs on **posedge aclk**.
- `aresetn` is driven on **negedge aclk**.
- All setup/hold requirements relative to `aclk` are assumed met (simulation only; no timing constraints declared here).
- Minimum reset duration: **8 clock cycles** of `aresetn=0`.

---

## 9. Reset Values

All output ports and registers return to the following values when `aresetn=0`:

| Signal / Register | Reset value |
|-------------------|-------------|
| `CONTROL` | 0x00000000 |
| `SRC_ADDR` | 0x00000000 |
| `STATUS` | 0x00000000 |
| `<all outputs>` | 0x0 or as noted |

*(Enumerate any register or output with a non-zero reset value explicitly.)*

---

## 10. Error / Response Behavior

| Scenario | AXI response | DUT state change | Observable evidence |
|----------|-------------|-----------------|---------------------|
| Invalid AXI-lite write address | `bresp=SLVERR` | No register written | Read back register; value unchanged |
| Invalid AXI-lite read address | `rresp=SLVERR`, `rdata=0` | No state change | rdata==0 |
| AXI4 master read SLVERR | Transfer abort | STATUS.error=1, STATUS.done=1 | PROCESSED_COUNT = words before error |
| AXI4 master write SLVERR | Transfer abort | STATUS.error=1, STATUS.done=1 | PROCESSED_COUNT = successful writes before error |

---

## 11. Unsupported Behavior

The following scenarios are outside the scope of this design. Behavior in these cases is **undefined**:

- AXI4 burst transactions (`AxLEN > 0`)
- Multiple simultaneous outstanding AXI4 master transactions
- Misaligned byte addresses (e.g., `SRC_ADDR` not 4-byte aligned)
- Source and destination regions that overlap
- `LENGTH_WORDS` value that exceeds the physical memory capacity
- `start` asserted while `aresetn=0`
- AXI-lite write with `wstrb != 4'hF` (partial byte writes) — behavior is `<declared>`

---

## 12. Revision History

| Version | Date | Change |
|---------|------|--------|
| 1.0 | YYYY-MM-DD | Initial contract |

---

*Template version: 1.0 — 2026-05-03*
*Used by: RTL Designer Agent (Agent 3) → RTL Verification Agent (Agent 4)*
