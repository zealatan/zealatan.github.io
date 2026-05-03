Before doing any implementation, save this exact prompt into:

md_files/13_dma_ctrl_zero_length_restart_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/13_dma_ctrl_zero_length_restart_prompt.md
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
Add coverage for LENGTH_WORDS=0 DMA start and restart behavior in simple_dma_ctrl_tb.

Current limitation:
- Re-trigger while busy is now covered.
- However, LENGTH_WORDS=0 transfer and restart behavior after a zero-length transfer are not independently verified.

Requirements:

1. Add a test for zero-length DMA transfer:
   - Program SRC_ADDR and DST_ADDR to valid addresses.
   - Program LENGTH_WORDS = 0.
   - Write CONTROL.start.
   - Poll STATUS.done.
   - Verify STATUS.done = 1.
   - Verify STATUS.error = 0.
   - Verify COPIED_COUNT = 0.
   - Verify destination memory remains unchanged.
   - Verify source memory remains unchanged.

2. Then immediately start a normal nonzero transfer after the zero-length transfer:
   - Program a new SRC_ADDR, DST_ADDR, and LENGTH_WORDS.
   - Write CONTROL.start again.
   - Poll STATUS.done.
   - Verify STATUS.error = 0.
   - Verify COPIED_COUNT = LENGTH_WORDS.
   - Verify destination memory contents.

3. Add canary checks:
   - Place canary values around the zero-length destination region.
   - Verify canaries remain unchanged.

4. Keep all existing tests passing.

5. Use existing AXI-lite read/write/polling tasks where possible.

6. Add timeout guards to any new wait loop.

7. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether the CI grep gate passed
- Whether zero-length transfer and restart behavior are now covered
- Any remaining limitations
