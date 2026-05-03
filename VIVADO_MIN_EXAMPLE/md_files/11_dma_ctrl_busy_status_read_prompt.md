Before doing any implementation, save this exact prompt into:

md_files/11_dma_ctrl_busy_status_read_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/11_dma_ctrl_busy_status_read_prompt.md
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
Add coverage for AXI-lite register reads while the DMA is busy/running.

Current limitation:
- AXI-lite read backpressure is now covered.
- However, the testbench does not read CONTROL/STATUS/COPIED_COUNT while DMA is actively running.
- Driver-like behavior during busy=1 has not been independently verified.

Requirements:

1. Add a test that starts a longer DMA transfer and reads status registers before completion.

2. The test should:
   - Seed several source words in memory.
   - Program SRC_ADDR, DST_ADDR, and LENGTH_WORDS.
   - Write CONTROL.start.
   - Immediately read STATUS or CONTROL before DMA completion if possible.
   - Verify STATUS.done = 0 while DMA is still busy.
   - Verify STATUS.error = 0 while no error has occurred yet.
   - Read COPIED_COUNT while DMA is running and verify it is between 0 and LENGTH_WORDS.
   - Continue polling until STATUS.done = 1.
   - Verify final STATUS.error = 0.
   - Verify final COPIED_COUNT = LENGTH_WORDS.
   - Verify destination memory contents.

3. If the DMA finishes too quickly to reliably observe busy state:
   - Add a testbench-side backpressure mechanism if already possible, or
   - Use the existing memory model behavior and a sufficiently long LENGTH_WORDS to increase transfer duration.
   - Do not modify RTL just to slow down the DMA.

4. Keep all existing tests passing.

5. Use existing AXI-lite read/write tasks where possible.

6. Add timeout guards to any new wait loop.

7. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether the CI grep gate passed
- Whether busy-state AXI-lite reads are now covered
- Any remaining limitations
