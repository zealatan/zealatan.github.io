Before doing any implementation, save this exact prompt into:

md_files/20_dma_add_ctrl_r_channel_backpressure_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/20_dma_add_ctrl_r_channel_backpressure_prompt.md
  - tb/simple_dma_add_ctrl_tb.sv
  - ai_context/current_status.md

- Do not modify RTL unless the new tests reveal a real RTL issue.

- Do not modify:
  - rtl/simple_dma_add_ctrl.v
  - rtl/simple_dma_add_nword.v
  - tb/axi_mem_model.sv
  - any previously verified RTL/TB/script files

Goal:
Close the AXI-lite R-channel backpressure coverage gap in simple_dma_add_ctrl_tb.

Current limitation:
- AXI-lite read paths are exercised.
- However, this DUT's testbench does not deliberately delay rready.
- Therefore, R-channel backpressure behavior is not independently verified for simple_dma_add_ctrl.

Requirements:

1. Add an AXI-lite read task that deliberately delays rready:
   - axil_read_rready_delay(addr, expected_resp, delay_cycles, data)

2. The task should:
   - use negedge-drive / posedge-sample style
   - complete AR handshake normally
   - wait for rvalid
   - keep rready=0 for delay_cycles after rvalid appears
   - verify rvalid remains asserted while rready=0
   - verify rdata remains stable while rready=0
   - verify rresp remains stable while rready=0
   - assert rready after the delay
   - capture final rdata/rresp
   - compare rresp with expected_resp
   - include timeout guards for every wait loop

3. Add tests that explicitly exercise delayed-rready reads for:
   - SRC_ADDR
   - DST_ADDR
   - LENGTH_WORDS
   - ADD_VALUE
   - STATUS
   - PROCESSED_COUNT
   - LAST_INPUT_DATA
   - LAST_OUTPUT_DATA
   - invalid address read returning SLVERR

4. Program known register values first, and if useful run a small valid transfer before reading STATUS/COUNT/LAST_INPUT/LAST_OUTPUT.

5. Verify:
   - valid register reads return OKAY
   - invalid register read returns SLVERR
   - rvalid is held during backpressure
   - rdata and rresp remain stable during backpressure
   - read data values are correct

6. Keep all existing tests passing.

7. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_add_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New task added
- New tests added
- Number of checks passed
- Whether CI grep gate passed
- Whether R-channel backpressure is now covered
- Any remaining limitations
