Before doing any implementation, save this exact prompt into:

md_files/10_dma_ctrl_r_channel_backpressure_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/10_dma_ctrl_r_channel_backpressure_prompt.md
  - tb/simple_dma_ctrl_tb.sv
  - ai_context/current_status.md

- Do not modify RTL unless the new test reveals a real RTL issue.

- Do not modify:
  - rtl/simple_dma_ctrl.v
  - rtl/simple_dma_copy_nword.v
  - tb/axi_mem_model.sv
  - tb/mem_rw_tb.sv
  - rtl/simple_dma_copy.v
  - tb/simple_dma_copy_tb.sv
  - rtl/simple_axi_master.v
  - tb/simple_axi_master_tb.sv
  - rtl/axi_lite_regfile.v
  - tb/axi_lite_regfile_tb.sv
  - any previously verified files

Goal:
Close the AXI-lite R-channel backpressure coverage gap in simple_dma_ctrl_tb.

Current limitation:
- AXI-lite read paths are exercised.
- However, the testbench does not deliberately delay rready.
- Therefore, R-channel backpressure behavior is not independently verified.

Requirements:

1. Add an AXI-lite master task that deliberately delays rready:
   - axil_read_rready_delay(addr, data, expected_resp, delay_cycles)

2. The task should:
   - use the existing negedge-drive / posedge-sample style
   - complete AR handshake normally
   - keep rready=0 for delay_cycles after rvalid appears
   - verify rvalid remains asserted while rready=0
   - verify rdata remains stable while rready=0
   - verify rresp remains stable while rready=0
   - assert rready after the delay
   - capture rdata and rresp
   - compare rresp with expected_resp
   - include timeout guards for every wait loop

3. Add tests that explicitly exercise:
   - valid read from SRC_ADDR with delayed rready
   - valid read from DST_ADDR with delayed rready
   - valid read from LENGTH_WORDS with delayed rready
   - valid read from STATUS with delayed rready
   - valid read from COPIED_COUNT with delayed rready
   - invalid address read with delayed rready returning SLVERR

4. If useful, program known register values first, then read them back using delayed-rready reads.

5. Keep all existing tests passing.

6. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether the CI grep gate passed
- Whether R-channel backpressure is now covered
- Any remaining limitations
