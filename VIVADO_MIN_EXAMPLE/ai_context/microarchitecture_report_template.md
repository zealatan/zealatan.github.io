# Microarchitecture Report Template

> **Usage:** Copy this file to `ai_context/microarch_report_<dut_name>.md` after writing RTL.
> Fill in every section based on the actual implemented RTL, not the intended RTL.
> If the implementation deviates from `architecture_spec.md`, document the deviation here.
> Update this file after every RTL patch.

---

# Microarchitecture Report: `<DUT_NAME>`

**Version:** 1.0
**Date:** YYYY-MM-DD
**Author:** RTL Designer Agent (Agent 3)
**RTL file:** `rtl/<dut_name>.v`
**Arch spec:** `ai_context/architecture_spec_<dut_name>.md`

---

## 1. Implemented RTL File

| File | Language | Line count | Top module |
|------|----------|------------|------------|
| `rtl/<dut_name>.v` | Verilog-2001 / SystemVerilog | N | `<module_name>` |

Sub-modules instantiated:

| Sub-module | File | Purpose |
|------------|------|---------|
| `<sub_module>` | `rtl/<sub>.v` | Description |

---

## 2. FSM States

### 2.1 Write FSM (`<write_state_r>`)

| State | Encoding | Description |
|-------|----------|-------------|
| `W_IDLE` | 2'd0 | Waiting for awvalid or wvalid |
| `W_WAIT_W` | 2'd1 | AW latched; waiting for W |
| `W_WAIT_A` | 2'd2 | W latched; waiting for AW |
| `W_BRESP` | 2'd3 | Both received; decode and write register; assert bvalid |

State transitions:
```
W_IDLE  + awvalid & !wvalid → W_WAIT_W
W_IDLE  + wvalid & !awvalid → W_WAIT_A
W_IDLE  + awvalid & wvalid  → W_BRESP
W_WAIT_W + wvalid           → W_BRESP
W_WAIT_A + awvalid          → W_BRESP
W_BRESP  + bready           → W_IDLE
```

### 2.2 Read FSM (`<read_state_r>`)

| State | Encoding | Description |
|-------|----------|-------------|
| `R_IDLE` | 1'd0 | Waiting for arvalid |
| `R_RVALID` | 1'd1 | Latch rdata; assert rvalid; wait for rready |

### 2.3 DMA Core FSM (if applicable, from sub-module)

| State | Description |
|-------|-------------|
| `IDLE` | Wait for start; latch src/dst/len/add |
| `RD_ADDR` | Assert arvalid; wait for arready |
| `RD_DATA` | Assert rready; wait for rvalid; latch input_lat |
| `WR_ADDR` | Assert awvalid+wvalid; wait for awready&&wready |
| `WR_RESP` | Assert bready; wait for bvalid; increment count |
| `DONE` | Assert done for one cycle; return to IDLE |

---

## 3. Datapath Registers

| Register | Width | Reset | Updated in | Description |
|----------|-------|-------|------------|-------------|
| `src_addr_r` | 32 | 0 | W_BRESP (addr 0x04) | Latched SRC_ADDR |
| `dst_addr_r` | 32 | 0 | W_BRESP (addr 0x08) | Latched DST_ADDR |
| `length_words_r` | 16 | 0 | W_BRESP (addr 0x0C[15:0]) | Latched LENGTH_WORDS |
| `add_value_r` | 32 | 0 | W_BRESP (addr 0x10) | Latched ADD_VALUE |
| `input_lat` | 32 | 0 | RD_DATA (rvalid) | Last AXI read data |
| `word_idx` | 16 | 0 | WR_RESP (success) | Current word index |
| `processed_count_r` | 16 | 0 | Done capture | Total words written |
| `last_input_r` | 32 | 0 | Done capture | LAST_INPUT_DATA |
| `last_output_r` | 32 | 0 | Done capture | LAST_OUTPUT_DATA |

**Combinatorial signals:**

| Signal | Expression | Description |
|--------|-----------|-------------|
| `processed_data` | `input_lat + add_lat` | Current word output value |
| `cur_src_addr` | `src_lat + word_idx * 4` | Current read address |
| `cur_dst_addr` | `dst_lat + word_idx * 4` | Current write address |

---

## 4. Control Registers (AXI-lite visible)

| Register | Address | Bit fields | Writeable | Reset |
|----------|---------|------------|-----------|-------|
| `CONTROL` | 0x00 | [0]=start/busy_r readback | W1S | 0x0 |
| `SRC_ADDR` | 0x04 | [31:0] | Yes | 0x0 |
| `DST_ADDR` | 0x08 | [31:0] | Yes | 0x0 |
| `LENGTH_WORDS` | 0x0C | [15:0] | Yes | 0x0 |
| `ADD_VALUE` | 0x10 | [31:0] | Yes | 0x0 |
| `STATUS` | 0x14 | [2]=busy [1]=error [0]=done | RO | 0x0 |
| `PROCESSED_COUNT` | 0x18 | [15:0] | RO | 0x0 |
| `LAST_INPUT_DATA` | 0x1C | [31:0] | RO | 0x0 |
| `LAST_OUTPUT_DATA` | 0x20 | [31:0] | RO | 0x0 |

---

## 5. Output Behavior

| Output | Asserted when | Deasserted when | Registered? |
|--------|--------------|----------------|-------------|
| `s_awready` | W_IDLE + awvalid received | Next cycle | Yes |
| `s_wready` | W_IDLE + wvalid received | Next cycle | Yes |
| `s_bvalid` | W_BRESP entry | bready seen | Yes |
| `s_arready` | R_IDLE + arvalid | Next cycle | Yes |
| `s_rvalid` | R_RVALID entry | rready seen | Yes |
| `m_arvalid` | DMA RD_ADDR state | arready seen | Yes (from DMA) |
| `m_awvalid` | DMA WR_ADDR state | awready seen | Yes (from DMA) |

---

## 6. Reset Behavior

Sensitivity list: `always @(posedge aclk or negedge aresetn)`

On `!aresetn`:
- All FSM states → idle (0)
- All data registers → 0
- All AXI handshake outputs (awready, wready, bvalid, arready, rvalid) → 0
- `busy_r`, `done_r`, `error_r` → 0
- `dma_start_r` → 0 (clears start pulse)

The DMA core sub-module also has `aresetn` connected; it resets simultaneously.

---

## 7. Error Handling

| Error | Detected in | RTL action | Propagated to |
|-------|-------------|------------|---------------|
| AXI-lite invalid write address | W_BRESP (addr decode) | bresp=SLVERR; no register write | s_bresp signal |
| AXI-lite invalid read address | R_RVALID (addr decode) | rresp=SLVERR; rdata=0 | s_rresp, s_rdata |
| AXI4 read SLVERR (rresp[1]=1) | RD_DATA in DMA core | FSM → DONE; error_lat=1 | done, error outputs |
| AXI4 write SLVERR (bresp[1]=1) | WR_RESP in DMA core | FSM → DONE; error_lat=1 | done, error outputs |

---

## 8. Latency

| Operation | Latency (clock cycles) |
|-----------|----------------------|
| AXI-lite write (W_IDLE → W_BRESP → W_IDLE) | 3 cycles (both channels ready, 0 wait states) |
| AXI-lite read (R_IDLE → R_RVALID → R_IDLE) | 3 cycles (arvalid, rvalid, rready, 0 wait states) |
| DMA 1-word transfer (from start to done) | ~12 cycles |
| DMA N-word transfer | ~6N + 6 cycles (0 wait state memory) |
| Zero-length transfer | ~3 cycles |

---

## 9. Resource / Complexity Notes

- Two AXI-lite FSMs (write: 4 states, read: 2 states) + DMA core FSM (6 states)
- No BRAM or DSP primitives; pure LUT/FF logic
- Parameterized: `DATA_WIDTH` (default 32), `ADDR_WIDTH` (default 32)
- Estimated LUT/FF count: small (<500 LUTs, <200 FFs) — not formally synthesized

---

## 10. Deviations from Architecture Spec

| # | Architecture spec claim | Actual implementation | Reason |
|---|-------------------------|-----------------------|--------|
| 1 | *(None)* | | |

*(Document every deviation. A blank table means the implementation exactly matches the spec.)*

---

## 11. Known Limitations

*(Copy from architecture_spec.md and add any new ones discovered during implementation.)*

- No AXI4 burst support
- No scatter-gather
- No 4KB boundary handling
- No misaligned address support
- Single clock domain only

---

## 12. Revision History

| Version | Date | RTL change | Reason |
|---------|------|------------|--------|
| 1.0 | YYYY-MM-DD | Initial implementation | — |

---

*Template version: 1.0 — 2026-05-03*
*Used by: RTL Designer Agent (Agent 3)*
