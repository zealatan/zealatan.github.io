# Current Status

## AXI-Lite Register File

Design:
- RTL: rtl/axi_lite_regfile.v
- Testbench: tb/axi_lite_regfile_tb.sv
- Simulation script: scripts/run_axi_regfile_sim.sh

### Implementation

4 × 32-bit registers at byte offsets 0x00, 0x04, 0x08, 0x0C.

Invalid-address detection (addr[31:4] != 0):
- Write path: bresp=SLVERR (2'b10), no register modified — handled in all 3 FSM states (W_IDLE, W_WAIT_W, W_WAIT_A)
- Read path: rresp=SLVERR (2'b10), rdata=0x00000000

### Verification Status (last run: 2026-05-01)

133/133 checks passed. 0 failures. CI gate exit code: 0.

Tests:
- Test 1: reset defaults (8 checks)
- Test 2: write all-ones + bresp/rresp (12 checks)
- Test 3: unique values (12 checks)
- Test 4: write all-zeros (12 checks)
- Test 5: partial WSTRB byte-lane writes (10 checks)
- Test 5b: individual byte-lane isolation (12 checks)
- Test 6: AW-before-W (W_WAIT_W path) (4 checks)
- Test 7: W-before-AW (W_WAIT_A path) (4 checks)
- Test 8: invalid address 0x10 — hard SLVERR checks, no alias (5 checks)
- Test 9: simultaneous AW+W same-cycle (4 checks)
- Test 10: B-channel backpressure (8 checks)
- Test 11: R-channel backpressure (8 checks)
- Test 12: invalid-address sweep W_IDLE path (15 checks)
- Test 13: AW-before-W invalid addresses W_WAIT_W path (9 checks)
- Test 14: W-before-AW invalid addresses W_WAIT_A path (9 checks)

## AXI4 Memory Model

Design:
- Model: tb/axi_mem_model.sv
- Testbench: tb/mem_rw_tb.sv
- Simulation script: scripts/run_mem_rw_sim.sh

### Implementation

- 32-bit data width, single-beat transactions
- Parameters: MEM_DEPTH (words, default 1024 = 4 KB), MEM_BASE (default 0x0)
- Same 4-state write FSM / 2-state read FSM as axi_lite_regfile
- Byte write strobes (WSTRB) supported
- Out-of-range addresses return SLVERR, in-range return OKAY
- Memory zeroed at simulation start via `initial`
- WLAST accepted at port but not checked (single-beat only)
- No ID signals, no AxLEN/AxSIZE/AxBURST/AxPROT (simulation-only model)

### Verification Status (last run: 2026-05-01)

30/30 checks passed. 0 failures. CI gate exit code: 0. Simulation end: 690 ns.

Tests:
- Test 1: full word write/readback at two addresses (6 checks)
- Test 2: multiple addresses, unique values (12 checks)
- Test 3: byte-lane WSTRB partial writes (10 checks)
- Test 4: read from unwritten address returns zero (2 checks)

## Simple AXI4 Master

Design:
- RTL: rtl/simple_axi_master.v
- Testbench: tb/simple_axi_master_tb.sv (instantiates tb/axi_mem_model.sv as slave)
- Simulation script: scripts/run_simple_axi_master_sim.sh

### Implementation — 6-state FSM

| State | Action |
|-------|--------|
| IDLE | Wait for start; latch addr and write_data |
| WR_ADDR | Drive awvalid+wvalid simultaneously; wait for awready&&wready |
| WR_RESP | Drive bready; wait for bvalid; latch bresp |
| RD_ADDR | Drive arvalid; wait for arready |
| RD_DATA | Drive rready; wait for rvalid; latch rdata/rresp; compute data_err |
| DONE | Assert done=1 and error=write_err\|read_err\|data_err for one cycle |

AXI outputs (awvalid, wvalid, bready, arvalid, rready) are combinatorial from state.
All data registers (addr_lat, wdata_lat, rdata_lat) and error flags are registered.
Single-beat only; wstrb=4'hF fixed; no burst/ID support.

### Verification Status (last run: 2026-05-01)

14/14 checks passed. 0 failures. CI gate exit code: 0. Simulation end: 445 ns.

Tests:
- Test 1: single write/readback at addr=0x00 (3 checks: done, no_error, readback)
- Test 2: three transactions at addr=0x04/0x08/0x0C with unique data (9 checks)
- Test 3: out-of-range address 0x1000 — expect done=1, error=1 (2 checks)

## Simple DMA Copy Engine

Design:
- RTL: rtl/simple_dma_copy.v
- Testbench: tb/simple_dma_copy_tb.sv (instantiates tb/axi_mem_model.sv as slave)
- Simulation script: scripts/run_simple_dma_copy_sim.sh

### Implementation — 6-state FSM (read-first)

| State | Action |
|-------|--------|
| IDLE | Wait for start; latch src_addr, dst_addr |
| RD_ADDR | Drive arvalid; wait for arready |
| RD_DATA | Drive rready; wait for rvalid; latch rdata/rresp; if rresp≠OKAY → DONE (abort) |
| WR_ADDR | Drive awvalid+wvalid simultaneously; wait for awready&&wready |
| WR_RESP | Drive bready; wait for bvalid; latch bresp |
| DONE | Assert done=1 and error=read_err\|write_err for one cycle |

AXI outputs (arvalid, rready, awvalid, wvalid, bready) are combinatorial from state.
All data registers (src_lat, dst_lat, rdata_lat) and error flags are registered.
wstrb=4'hF fixed; wlast=1; no burst/ID support.
copied_data reflects the latched read data throughout and after the transaction.
Read error aborts the copy — write phase is skipped, destination memory unchanged.

### Verification Status (last run: 2026-05-02)

16/16 checks passed. 0 failures. CI gate exit code: 0. Simulation end: 355 ns.

Tests:
- Test 1: copy 0x00 → 0x10, verify copied_data and dst mem (4 checks)
- Test 2: copy 0x04 → 0x20, verify copied_data and dst mem (4 checks)
- Test 3: invalid src 0x1000 — error=1, dst mem[0x30>>2] unchanged (3 checks)
- Test 4: invalid dst 0x2000 — error=1, copied_data=src, src unchanged, canary unchanged (5 checks)

## N-Word DMA Copy Engine

Design:
- RTL: rtl/simple_dma_copy_nword.v
- Testbench: tb/simple_dma_copy_nword_tb.sv (instantiates tb/axi_mem_model.sv as slave)
- Simulation script: scripts/run_simple_dma_copy_nword_sim.sh

### Implementation — 6-state FSM (read-first, loops over length_words)

Inputs: aclk, aresetn, start, src_addr[31:0], dst_addr[31:0], length_words[15:0]
Outputs: done, error, copied_count[15:0], last_copied_data[31:0]

| State | Action |
|-------|--------|
| IDLE | Clear counters; latch src/dst/len; if len=0 → DONE; else → RD_ADDR |
| RD_ADDR | Drive arvalid=cur_raddr; wait for arready |
| RD_DATA | Drive rready; wait for rvalid; latch rdata/rresp; if rresp≠OKAY → DONE (abort) |
| WR_ADDR | Drive awvalid+wvalid simultaneously; wait for awready&&wready |
| WR_RESP | Drive bready; wait for bvalid; if bresp≠OKAY → DONE; else copied_count++; last word → DONE; else word_idx++, RD_ADDR |
| DONE | Assert done=1 and error=read_err\|write_err for one cycle |

cur_raddr = src_lat + word_idx×4 (combinatorial); cur_waddr = dst_lat + word_idx×4.
wstrb=4'hF fixed; wlast=1; no burst/ID support.
Read or write error aborts immediately — remaining words are skipped.
copied_count reflects words successfully written (write response OKAY received).

### Verification Status (last run: 2026-05-02)

31/31 checks passed. 0 failures. CI gate exit code: 0. Simulation end: 745 ns.

Tests:
- Test 1: length_words=0 — done immediately, no transfers, copied_count=0 (4 checks)
- Test 2: length_words=1, copy 0x00→0x40, verify last_copied_data and dst (5 checks)
- Test 3: length_words=4, copy 0x00-0x0C→0x80-0x8C, verify all 4 dst words (7 checks)
- Test 4: invalid src mid-copy (src=0xFF4, len=4) — words 0-2 OK, word 3 OOB read aborts; copied_count=3, dst[3] unchanged (7 checks)
- Test 5: invalid dst mid-copy (src=0x200, dst=0xFF4, len=4) — words 0-2 OK, word 3 OOB write aborts; copied_count=3, canary unchanged (8 checks)

## Legacy and2 Example

- RTL: rtl/and2.v
- Testbench: tb/and2_tb.sv
- Simulation script: scripts/run_vivado_sim.sh
