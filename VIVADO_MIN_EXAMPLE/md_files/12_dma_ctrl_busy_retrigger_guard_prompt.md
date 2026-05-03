Before doing any implementation, save this exact prompt into:

md_files/12_dma_ctrl_busy_retrigger_guard_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/12_dma_ctrl_busy_retrigger_guard_prompt.md
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
Add coverage for CONTROL.start writes while the DMA is already busy.

Current limitation:
- Busy-state AXI-lite reads are now covered.
- However, the testbench does not attempt to write CONTROL.start again while busy_r=1.
- Re-trigger guard behavior has not been independently verified.

Requirements:

1. Add a test that starts a longer DMA transfer and attempts to write CONTROL.start again before the first transfer completes.

2. The test should:
   - Seed source memory with known data.
   - Program SRC_ADDR, DST_ADDR, and LENGTH_WORDS for a longer transfer.
   - Write CONTROL.start once.
   - Confirm DMA is busy if possible by reading CONTROL or STATUS.
   - While busy, write CONTROL.start again.
   - Verify the second start write returns OKAY or the RTL-defined response.
   - Verify the second start does not restart, corrupt, or alter the ongoing DMA transfer.
   - Poll until STATUS.done = 1.
   - Verify STATUS.error = 0.
   - Verify COPIED_COUNT equals the original LENGTH_WORDS.
   - Verify destination memory contains exactly the original expected copied data.

3. Also check that no unintended second transfer occurred:
   - Use canary values around the destination region.
   - Verify canary words before and after the destination range remain unchanged.
   - If practical, use a different SRC/DST/LENGTH register write before the second CONTROL.start attempt and verify it does not affect the active transfer.

4. Do not modify RTL unless the test reveals that re-trigger protection is broken.

5. Keep all existing tests passing.

6. Use existing AXI-lite read/write tasks where possible.

7. Add timeout guards to any new wait loop.

8. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether the CI grep gate passed
- Whether busy re-trigger guard is now covered
- Any remaining limitations
