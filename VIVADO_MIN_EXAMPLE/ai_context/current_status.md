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

## AXI-Lite Controlled DMA Wrapper

Design:
- RTL: rtl/simple_dma_ctrl.v (wraps rtl/simple_dma_copy_nword.v)
- Testbench: tb/simple_dma_ctrl_tb.sv (instantiates tb/axi_mem_model.sv as AXI4 slave)
- Simulation script: scripts/run_simple_dma_ctrl_sim.sh

### Register Map (AXI-lite slave, byte addresses)

| Addr | Name         | Access | Description                              |
|------|--------------|--------|------------------------------------------|
| 0x00 | CONTROL      | W1S/R  | bit0=start (write-1-to-start); reads busy |
| 0x04 | SRC_ADDR     | R/W    | Source byte address                      |
| 0x08 | DST_ADDR     | R/W    | Destination byte address                 |
| 0x0C | LENGTH_WORDS | R/W    | Number of 32-bit words [15:0]            |
| 0x10 | STATUS       | RO     | bit0=done (sticky), bit1=error           |
| 0x14 | COPIED_COUNT | RO     | Words successfully written [15:0]        |

Addresses outside 0x00–0x14 return SLVERR.

### Implementation

- AXI-lite write FSM: 4 states (W_IDLE, W_WAIT_W, W_WAIT_A, W_BRESP) — handles AW-before-W and W-before-AW
- AXI-lite read FSM: 2 states (R_IDLE, R_RVALID)
- `busy_r` set on CONTROL.start write; cleared on DMA done pulse
- `done_r`, `error_r`, `copied_count_r` captured from DMA core on done pulse; `done_r` cleared on next start
- `dma_start_r`: one-cycle pulse generated when CONTROL.start=1 written and !busy_r
- Instantiates simple_dma_copy_nword; AXI4 master ports passed through directly

### Verification Status (last run: 2026-05-03)

208/208 checks passed. 0 failures. CI gate exit code: 0. Simulation end: 4330 ns.

Tests:
- Test 1: program 4 regs (simultaneous AW+W), run 4-word copy, verify STATUS/count/dst (11 checks)
- Test 2: re-program and single-word copy (8 checks)
- Test 3: invalid AXI-lite addr 0x20 — simultaneous write+read SLVERR (2 checks)
- Test 4: OOB src mid-copy (src=0xFF4, len=4) — error=1, count=3, dst[3] unchanged (11 checks)
- Test 5: OOB dst mid-copy (src=0x200, dst=0xFF4, len=4) — error=1, count=3, canary unchanged (11 checks)
- Test 6: mixed write ordering — SRC/LENGTH via AW-first (W_WAIT_W), DST/CONTROL via W-first (W_WAIT_A); 3-word copy verified (10 checks)
- Test 7: invalid addr 0x40 via AW-first, 0x50 via W-first — both return SLVERR (2 checks)
- Test 8: B-channel backpressure — SRC/DST/LENGTH programmed with 3-cycle bready delay; bvalid held verified at each delay cycle; invalid addr with delay returns SLVERR; 2-word copy verified (22 checks)
- Test 9: R-channel backpressure — all six register addresses read with 3-cycle rready delay; rvalid held, rdata stable, rresp stable verified at each delay cycle; invalid addr returns SLVERR with rdata=0 (66 checks)
- Test 10: busy-state reads — CONTROL/STATUS/COPIED_COUNT read immediately after CONTROL.start; CONTROL busy=1, STATUS.done=0/error=0, COPIED_COUNT stale value ≤ LENGTH_WORDS verified; 8-word copy completed and all 8 dst words verified (22 checks)
- Test 11: busy re-trigger guard — start 8-word copy; while busy, overwrite SRC/DST/LENGTH with corrupted values and write CONTROL.start again; verify second start returns OKAY but is ignored (DMA uses latched values); verify count=8, correct dst, canary_before and canary_after unchanged (23 checks)
- Test 12a: zero-length DMA transfer — LENGTH_WORDS=0; DMA goes IDLE→DONE in ~3 cycles; STATUS.done=1, error=0, count=0; src and canary dst words unchanged (10 checks)
- Test 12b: 3-word restart after zero-length — verifies busy_r is cleared after zero-length done and a fresh start is accepted; count=3, all 3 dst words correct (10 checks)

Write-ordering coverage: W_IDLE (simultaneous), W_WAIT_W (AW-first), W_WAIT_A (W-first) — all three paths exercised.
B-channel backpressure coverage: W_BRESP held 3 cycles with bvalid=1 verified; OKAY and SLVERR both tested under backpressure.
R-channel backpressure coverage: R_RVALID held 3 cycles with rvalid=1, rdata stable, rresp stable verified; OKAY and SLVERR both tested under backpressure.
Busy-state coverage: CONTROL/STATUS/COPIED_COUNT all read while DMA in-flight; busy=1, done=0, error=0 verified during active transfer.
Re-trigger guard coverage: second CONTROL.start while busy_r=1 returns OKAY but does not restart DMA; mid-transfer register corruption ignored; canary words verify no spurious writes.
Zero-length coverage: LENGTH_WORDS=0 completes immediately with done=1, error=0, count=0; restart after zero-length completes normally.

## N-Word DMA Add Engine

Design:
- RTL: rtl/simple_dma_add_nword.v
- Testbench: tb/simple_dma_add_nword_tb.sv (instantiates tb/axi_mem_model.sv as slave)
- Simulation script: scripts/run_simple_dma_add_nword_sim.sh

### Implementation — 6-state FSM (read-process-write, loops over length_words)

Inputs: aclk, aresetn, start, src_addr[31:0], dst_addr[31:0], length_words[15:0], add_value[31:0]
Outputs: done, error, processed_count[15:0], last_input_data[31:0], last_output_data[31:0]

| State | Action |
|-------|--------|
| IDLE | Clear counters; latch src/dst/len/add; if len=0 → DONE; else → RD_ADDR |
| RD_ADDR | Drive arvalid; wait for arready |
| RD_DATA | Drive rready; wait for rvalid; latch input_lat; if rresp≠OKAY → DONE (abort before write) |
| WR_ADDR | Drive awvalid+wvalid; wdata=processed_data (comb); wait for awready&&wready |
| WR_RESP | Drive bready; wait for bvalid; if bresp≠OKAY → DONE; else processed_count++; last word → DONE; else word_idx++, RD_ADDR |
| DONE | Assert done=1 and error=read_err\|write_err for one cycle |

Processing datapath: `wire [31:0] processed_data = input_lat + add_lat` (purely combinatorial)
last_input_data = input_lat; last_output_data = processed_data.
Read error aborts before write; write error aborts after failed response.
processed_count increments only on successful write (OKAY bresp).

### Verification Status (last run: 2026-05-03)

81/81 checks passed. 0 failures. CI gate exit code: 0. Simulation end: 1545 ns.

Tests:
- Test 1: length_words=0 — done immediately, processed_count=0, canary dst words unchanged (4 checks)
- Test 2: length_words=1, 0x10+0x5=0x15, verify last_input, last_output, dst (6 checks)
- Test 3: length_words=4, add 0x100, verify all 4 dst words, last_input, last_output (9 checks)
- Test 4: 32-bit overflow, 0xFFFF_FFFF+1=0x00000000, no error (4 checks)
- Test 5: invalid src mid-processing (src=0xFF4, len=4) — 3 processed, error=1, dst[3] unchanged; last_input=OOB rdata (0x0), last_output=add_value (9 checks)
- Test 6: invalid dst mid-processing (src=0x200, dst=0xFF4, len=4) — 3 processed, error=1, src unchanged; last_input=failed word's input, last_output=failed word's processed value (9 checks)
- Test 7: identity mode (add_value=0, 4 words) — dst=src, last_input=last_output=last src word, no error (9 checks)
- Test 8a: restart-after-read-error (error step) — src=0xFF8, dst=0x600, len=3, add=0x50; 2 words written, word 2 src OOB; error=1, count=2, dst[2] canary unchanged, last_input=0, last_output=0x50 (8 checks)
- Test 8b: restart-after-read-error (recovery step) — src=0x3E8, dst=0x700, len=2, add=0x0F; both words correct; error=0, count=2, last_input/last_output correct (7 checks)
- Test 9a: restart-after-write-error (error step) — src=0x410, dst=0xFF8, len=3, add=0x03; 2 words written, word 2 dst OOB; error=1, count=2, src unchanged, last_input=word2 read data, last_output=word2 processed (8 checks)
- Test 9b: restart-after-write-error (recovery step) — src=0x420, dst=0x780, len=3, add=0x04; all 3 words correct; error=0, count=3, last_input/last_output correct (8 checks)

Error-case observability note: RTL always latches rdata into input_lat in RD_DATA, even on SLVERR. After a read error, last_input_data = OOB rdata (0x0 from memory model) and last_output_data = 0 + add_value. After a write error, last_input_data = the read input of the failed write word, last_output_data = that word's processed value. This is the intended RTL design (no "preserve last successful" logic).

Restart-after-error coverage: FSM correctly resets to IDLE after DONE, accepts fresh start/src/dst/len/add inputs, and runs a clean transfer with no stale state from the prior failed transfer.

## AXI-Lite Controlled DMA Add Accelerator

Design:
- RTL: rtl/simple_dma_add_ctrl.v (wraps rtl/simple_dma_add_nword.v)
- Testbench: tb/simple_dma_add_ctrl_tb.sv (instantiates tb/axi_mem_model.sv as AXI4 slave)
- Simulation script: scripts/run_simple_dma_add_ctrl_sim.sh

### Register Map (AXI-lite slave, byte addresses)

| Addr | Name             | Access | Description                                 |
|------|------------------|--------|---------------------------------------------|
| 0x00 | CONTROL          | W1S/R  | bit0=start; reads busy_r                    |
| 0x04 | SRC_ADDR         | R/W    | Source byte address                         |
| 0x08 | DST_ADDR         | R/W    | Destination byte address                    |
| 0x0C | LENGTH_WORDS     | R/W    | Number of 32-bit words [15:0]               |
| 0x10 | ADD_VALUE        | R/W    | 32-bit constant added to each word          |
| 0x14 | STATUS           | RO     | bit0=done(sticky), bit1=error, bit2=busy    |
| 0x18 | PROCESSED_COUNT  | RO     | Words successfully written [15:0]           |
| 0x1C | LAST_INPUT_DATA  | RO     | Last latched input word                     |
| 0x20 | LAST_OUTPUT_DATA | RO     | Last processed output word                  |

Addresses outside 0x00–0x20 return SLVERR.

### Implementation

- AXI-lite write FSM: 4 states (W_IDLE, W_WAIT_W, W_WAIT_A, W_BRESP) — handles all three orderings
- AXI-lite read FSM: 2 states (R_IDLE, R_RVALID)
- busy_r set on CONTROL.start write if !busy_r; cleared on DMA done pulse
- done_r, error_r, processed_count_r, last_input_r, last_output_r captured on done pulse
- done_r cleared on next valid start
- Instantiates simple_dma_add_nword; AXI4 master ports passed through directly

### Verification Status (last run: 2026-05-03)

691/691 checks passed. 0 failures. CI gate exit code: 0. Simulation end: 16140 ns.

Tests:
- Test 1: register R/W sanity — SRC/DST/LEN/ADD write+readback; invalid addr 0x30 returns SLVERR (15 checks)
- Test 2: 1-word add (0x10+0x05=0x15) — STATUS/COUNT/LAST_IN/LAST_OUT verified (15 checks)
- Test 3: 4-word add (add=0x100) — all 4 dst words, LAST_IN/LAST_OUT for word 4 (18 checks)
- Test 4: identity mode (add=0) — dst=src for 4 words, error=0, count=4 (14 checks)
- Test 5: 32-bit overflow (0xFFFF_FFFF+1=0) — no error generated (9 checks)
- Test 6: zero-length transfer — done=1, error=0, count=0, canary unchanged (11 checks)
- Test 7: invalid src mid-transfer (src=0xFF8, len=3, word 2 OOB) — error=1, count=2, canary unchanged (13 checks)
- Test 8: invalid dst mid-transfer (dst=0xFF8, len=3, word 2 OOB) — error=1, count=2, src unchanged (13 checks)
- Test 9: busy-state + re-trigger guard — busy=1 read after start; second CONTROL.start no-op; 8 dst words verified (21 checks)
- Test 10: restart-after-error — error transfer (count=1) followed by valid recovery (count=2, 2 dst words) (22 checks)
- Test 11: mixed write ordering — invalid addr via AW-first and W-first both return SLVERR; SRC/LEN/CTRL via AW-first, DST/ADD via W-first; 3-word transfer verified with LAST_IN/LAST_OUT and 3 dst words (19 checks)
- Test 12: B-channel backpressure — SRC/DST/LEN/ADD and invalid addr 0x44 each programmed with 3-cycle bready delay; bvalid held asserted at each delay cycle (4 checks per call × 5 calls = 20 bvalid checks); 5 response checks; CTRL via simultaneous; 2-word transfer verified (33 checks)
- Test 13: R-channel backpressure — all 9 registers (SRC/DST/LEN/ADD/STATUS/COUNT/LAST_IN/LAST_OUT) and invalid addr 0x44 each read with 3-cycle rready delay; rvalid held, rdata stable, rresp stable verified per delay cycle (3×3=9 per call); final rvalid+rresp checks; data correctness verified; OKAY and SLVERR both exercised (113 checks)
- Test 14a: reset during active transfer — 16-word add transfer started (src=0xB00, dst=0xA00, add=0x10); reset asserted 10 cycles after start while DMA in-flight; post-reset: all 9 AXI-lite registers verified at reset defaults (all 0); canary mem[639] (before dst) and mem[656] (after dst end) verified unchanged; partial writes to dst[0..15] before reset are expected and not checked (25 checks)
- Test 14b: fresh transfer after reset — 4-word add (src=0xC00, dst=0xD00, add=3); STATUS.done=1, error=0, count=4, all 4 dst words correct (14 checks)
- Test 15: repeated normal restart — 5 back-to-back transfers (len=1/2/3/2/4, add=0xAA/BB/CC/DD/EE); each run's STATUS/COUNT/LAST_IN/LAST_OUT/dst words verified independently; canary after last dst region unchanged; tests that fresh register programming takes effect on each restart (83 checks)
- Test 16: lightweight random valid-transfer smoke — 10 deterministic iterations (len cycling 1..8 then 1,2; add=iter+1); fixed src/dst windows at 0xD80/0xDA0; src seeded per iteration as (iter+1)*0x1000+(j+1); all dst words verified as src+add; STATUS/COUNT verified per iteration; canary after dst window unchanged (140 checks)
- Test 17: busy config write policy — start 16-word transfer (src=0xE10, dst=0xF00, add=0x1234, len=16); verify STATUS.busy=1 immediately after start; write new SRC/DST/LEN/ADD (0xE60/0xF50/5/0x5678) while DMA busy; poll done; verify orig transfer (16 dst words = 0xA0A0_1235..1244) unaffected by mid-flight writes; verify config registers hold new values; start second transfer via CTRL only; verify second transfer uses new parameters (5 dst words = 0xB0B0_5679..567D); canaries before/after both dst regions unchanged (65 checks)
- Test 18: reset during transfer — start 8-word transfer (src=0xF68, dst=0xF8C, add=0x2468, len=8); verify STATUS.busy=1 (bit2) immediately after start; assert aresetn=0 after 10 cycles while DMA in-flight; hold reset 8 cycles; release and settle 4 cycles; verify all 9 AXI-lite registers (CONTROL/SRC/DST/LEN/ADD/STATUS/COUNT/LAST_IN/LAST_OUT) at reset defaults (all 0); verify canaries before/after orig dst region unchanged; orig dst may be partially written — not individually checked; recovery 3-word transfer (src=0xFB0, dst=0xFC0, add=0x100); STATUS/COUNT/LAST_IN/LAST_OUT verified; 3 new dst words and 2 new canaries verified (48 checks)

Write-ordering coverage: W_IDLE (simultaneous AW+W), W_WAIT_W (AW-before-W), W_WAIT_A (W-before-AW) — all three paths exercised.
B-channel backpressure coverage: W_BRESP held 3 cycles with bvalid=1 verified per cycle; both OKAY and SLVERR tested under backpressure.
R-channel backpressure coverage: R_RVALID held 3 cycles with rvalid=1, rdata stable, rresp stable verified per cycle; all 9 readable register addresses and one invalid address tested; OKAY and SLVERR both exercised under backpressure.
Reset-during-transfer coverage (T14a): async reset asserted mid-flight 16-word transfer; all DUT registers at reset defaults verified; canary words verified unchanged.
Reset-during-transfer coverage (T18): busy=1 verified immediately before reset; reset asserted mid-flight 8-word transfer; all 9 AXI-lite registers at reset defaults (0) verified; canary integrity verified; STATUS.busy=0 after recovery transfer verified.
Observed reset-default policy: all registers (CONTROL/SRC_ADDR/DST_ADDR/LENGTH_WORDS/ADD_VALUE/STATUS/PROCESSED_COUNT/LAST_INPUT_DATA/LAST_OUTPUT_DATA) reset to 0x00000000 on aresetn=0. CONTROL reads busy_r=0. STATUS encodes {busy=0,error=0,done=0}=0.
Busy config write policy coverage: AXI-lite writes to SRC/DST/LEN/ADD accepted (OKAY) while DMA busy; RTL parameter latching verified — orig transfer uses latched values unchanged; post-transfer register readback confirms new values visible; second transfer uses new values correctly.
Invalid-address coverage: SLVERR returned under all three write orderings, under B-channel backpressure, and under R-channel backpressure.

## Documentation Status (last updated: 2026-05-03)

- `docs/rtl_verification_agent_benchmark.md` — full benchmark doc: all 8 layers, verification patterns, agent capability description, coverage gaps
- `docs/rtl_verification_workflow_summary.md` — compact workflow diagram and cumulative check table
- `README.md` — updated with benchmark section (section 14), current status table, and links to docs/

Cumulative check count across all verified layers: **1204/1204 PASS** (664 + 52 from P19 + 113 from P20 + 39 from P21 + 223 from P22 + 65 from P23 + 48 from P24).

## Verification Phase v1 Closure (2026-05-03)

**Status: CLOSED**

All planned prompts (P01–P25) have been executed. All simulation scripts pass. CI grep gate clean on all runs. Verification matrix (67 entries), design contract, known limitations, closure criteria, and final summary are documented.

No RTL, testbench, or simulation script files were modified in P25.

### Closure Documents Created (P25)

| File | Purpose |
|------|---------|
| `ai_context/known_limitations.md` | Deferred scope items (methodology, protocol, physical) |
| `ai_context/design_contract.md` | Expected DUT behavior for all 19 design contract items |
| `ai_context/verification_matrix.md` | 67-entry coverage matrix across all 8 layers |
| `ai_context/verification_closure_criteria.md` | 10 closure criteria; all met |
| `ai_context/final_verification_summary.md` | Complete campaign summary, hazards closed, next phase |

### Recommended Next Phase: RTL Designer Protocol v1

Templates to create:
- `architecture_spec_template.md`
- `interface_contract_template.md`
- `microarchitecture_report_template.md`
- `verification_handoff_template.md`

These will enable the RTL Design Agent (Agent 3) to produce pre-contracted RTL and the RTL Verification Agent (Agent 4) to verify it automatically using the established prompt patterns.

## Verification Agent Protocol and DUT Profiles (P26, 2026-05-03)

The following documents generalize Verification Phase v1 into reusable protocols and DUT-category profiles for the RTL Verification Agent (Agent 4). No RTL, testbench, or simulation scripts were modified.

| File | Purpose |
|------|---------|
| `ai_context/verification_agent_core_protocol.md` | Core agent workflow, mandatory mechanics, failure classification, modification policy, report format |
| `ai_context/dut_category_taxonomy.md` | 8 DUT categories with decision tree, interface descriptions, mandatory tests, common hazards, and deferred items |
| `ai_context/dut_profile_axil_dma_accelerator.md` | CAT-3 profile: validated by Phase v1 benchmark; 21 mandatory tests; Phase v1 closure evidence |
| `ai_context/dut_profile_axistream_block.md` | CAT-4 profile: AXI-Stream DUTs; scoreboard/golden model requirement; 10 mandatory tests |
| `ai_context/dut_profile_dsp_pipeline.md` | CAT-5 profile: DSP/math pipelines; Python Modeling Agent handoff format; 10 mandatory tests |
| `ai_context/dut_profile_cdc_fifo.md` | CAT-6 profile: async FIFO and CDC blocks; formal/SVA recommendation; 10 mandatory tests |

These documents establish the reusable protocol foundation for Agent 4 verification campaigns beyond Phase v1. Any new DUT is identified by category, assigned a profile, and verified against the profile's mandatory test list and closure criteria.

**AXI-Stream profile updated after axis_add_one handoff experiment (P29/P30, 2026-05-03):** axis_add_one achieved 146/146 PASS with no RTL bugs and no contract ambiguities. Profile `dut_profile_axistream_block.md` updated with: validated test list (10 tests), negedge-drive timing rules, interleave-vs-drain scoreboard guidance, common failure mode table, recommended TB architecture, and Rule 1–4 lessons from the experiment. Validation status changed from "not yet verified" to "validated." Core protocol `verification_agent_core_protocol.md` updated with §3.6a Interface-Specific TB Timing Rules.

## RTL Designer Agent Protocol (P27, 2026-05-03)

The following documents define Agent 3 (RTL Designer Agent) and the Agent 3 → Agent 4 handoff. No RTL, testbench, or simulation scripts were modified. Prompt backup stored in `md_files/rtl_designer/`.

| File | Purpose |
|------|---------|
| `ai_context/rtl_designer_core_protocol.md` | Agent 3 purpose, 14-step workflow, 8 design quality rules, RTL modification policy, Agent 3↔4 interaction diagram, final report format |
| `ai_context/architecture_spec_template.md` | 14-section reusable template: DUT name/purpose/category, block diagram, FSM overview, register map, error/reset policy, assumptions, verification profile |
| `ai_context/interface_contract_template.md` | 12-section reusable template: clock/reset, port tables, AXI-lite/master/stream interfaces, valid/ready semantics, timing assumptions, reset values, unsupported behavior |
| `ai_context/microarchitecture_report_template.md` | 12-section reusable template: FSM states with transitions, datapath registers, control registers, output behavior, error handling, latency table, deviations from spec |
| `ai_context/verification_handoff_template.md` | 12-section reusable handoff document: required tests, expected normal/error/reset behavior, corner cases, scoreboard rule, evidence checklist, deferred items |

These documents close the design-to-verification loop: Agent 3 produces RTL + four artifacts; Agent 4 consumes the verification_handoff.md and runs the verification campaign against the interface_contract.md.

## AXI-Stream Add-One RTL Design (P28, 2026-05-03)

Design artifacts created per RTL Designer Agent Protocol v1 for DUT `axis_add_one`. No testbench written (verification is Agent 4 scope). No simulation run.

### Design Artifacts

| File | Purpose |
|------|---------|
| `ai_context/architecture_spec_axis_add_one.md` | DUT purpose, high-level behavior, block diagram, FSM (implicit buffer state), datapath, reset policy, assumptions, known limitations |
| `ai_context/interface_contract_axis_add_one.md` | Clock/reset, port table, AXI-Stream slave/master interfaces, backpressure rule (`s_tready = !m_tvalid \|\| m_tready`), functional contract, unsupported sidebands |
| `rtl/axis_add_one.v` | 46-line Verilog-2001 RTL; one-entry output buffer pattern; `m_tdata = s_tdata + 1` (mod 2^32); `s_tready` combinatorial |
| `ai_context/microarch_report_axis_add_one.md` | Implicit FSM state table, datapath registers (m_tvalid/m_tdata/m_tlast), combinatorial signals (s_tready), branch priority analysis, latency (1 cycle), resource estimate (~33 FFs, ~33 LUTs) |
| `ai_context/verification_handoff_axis_add_one.md` | 12 required tests (T-SINGLE through T-VARY-BP), golden-path 3-word example, scoreboard rule, corner cases, deferred items |

### RTL Summary

```verilog
assign s_axis_tready = !m_axis_tvalid || m_axis_tready;

always @(posedge aclk or negedge aresetn) begin
    if (!aresetn)                                  m_axis_tvalid <= 0; ...
    else if (s_axis_tvalid && s_axis_tready) begin m_axis_tvalid <= 1; m_axis_tdata <= s_axis_tdata + 1; m_axis_tlast <= s_axis_tlast; end
    else if (m_axis_tready)                        m_axis_tvalid <= 0;
end
```

Category: CAT-4 AXI-Stream Processing Block. Profile: `dut_profile_axistream_block.md`. Verification campaign pending (Agent 4 scope).

## AXI-Stream Add-One Verification (P29, 2026-05-03)

Design:
- RTL: rtl/axis_add_one.v (from P28)
- Testbench: tb/axis_add_one_tb.sv
- Simulation script: scripts/run_axis_add_one_sim.sh

### Implementation (axis_add_one)

One-entry registered output buffer. `m_tdata = s_tdata + 1` (mod 2^32). `s_tready = !m_tvalid || m_tready` (combinatorial). Async reset. 1-cycle latency, 1 word/cycle sustained throughput.

### Verification Status (last run: 2026-05-03)

146/146 checks passed. 0 failures. CI gate exit code: 0.

Tests:
- Test 1: reset defaults — m_tvalid=0, m_tdata=0, m_tlast=0 after reset (3 checks)
- Test 2: single-beat transfer — tdata+1 and tlast=1 verified (2 checks)
- Test 3: multi-beat packet (4 beats) — all tdata/tlast correct, interleaved (8 checks)
- Test 4: back-to-back throughput (6 beats) — simultaneous consume+accept path exercised; pipeline no-bubble verified (18 checks)
- Test 5: output backpressure — m_tvalid/tdata/tlast stable for 3 cycles; consumed on m_tready=1 (11 checks)
- Test 6: input stall — 3 beats with idle gaps; order and data correct (6 checks)
- Test 7: wraparound — 0xFFFFFFFF+1=0x00000000 (2 checks)
- Test 8: tlast propagation — 3 packet types (1-beat, 3-beat, 2-beat); all tlast positions verified (12 checks)
- Test 9: reset mid-packet — buffer cleared, s_tready=1 after reset, recovery transfer (6 checks)
- Test 10: LFSR smoke — 10 packets, lengths 1–8, 39 beats, deterministic LFSR data (78 checks)

### Agent 3 → Agent 4 Handoff Result: SUCCEEDED

First AXI-Stream handoff experiment. All 12 handoff-required tests covered. No RTL bugs found. No contract ambiguities. Testbench bugs found and fixed (3 items; see final_verification_summary_axis_add_one.md).

Key testbench protocol finding: all signal drives including m_tready must be at negedge to avoid race conditions with the DUT's posedge-triggered always block. Interleaved send+check required for 1-cycle-latency DUTs with m_tready=1.

### Documentation

- `ai_context/verification_matrix_axis_add_one.md` — 24-entry coverage matrix
- `ai_context/final_verification_summary_axis_add_one.md` — full campaign summary; Agent 3→4 handoff assessment; protocol observations
- `md_files/verification_agent/29_axis_add_one_verification_prompt.md` — prompt backup

## Legacy and2 Example

- RTL: rtl/and2.v
- Testbench: tb/and2_tb.sv
- Simulation script: scripts/run_vivado_sim.sh
