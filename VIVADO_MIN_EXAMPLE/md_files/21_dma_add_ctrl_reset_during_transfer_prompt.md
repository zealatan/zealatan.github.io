Before doing any implementation, save this exact prompt into:

md_files/21_dma_add_ctrl_reset_during_transfer_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/21_dma_add_ctrl_reset_during_transfer_prompt.md
  - tb/simple_dma_add_ctrl_tb.sv
  - ai_context/current_status.md

- Do not modify RTL unless the new test reveals a real RTL issue.

- Do not modify:
  - rtl/simple_dma_add_ctrl.v
  - rtl/simple_dma_add_nword.v
  - tb/axi_mem_model.sv
  - any previously verified RTL/TB/script files

Goal:
Add reset-during-transfer coverage for simple_dma_add_ctrl.

Current status:
- AXI-lite write ordering, B-channel backpressure, and R-channel backpressure are now covered.
- However, reset behavior during an active DMA add transfer is not independently verified.

Requirements:

1. Add a test that starts a longer DMA add transfer and asserts reset while the transfer is still active.

2. The test should:
   - Seed source memory with known values.
   - Program SRC_ADDR, DST_ADDR, LENGTH_WORDS, and ADD_VALUE.
   - Start a DMA add transfer with enough length to make it active for multiple cycles.
   - Wait a few cycles after start.
   - Assert aresetn=0 for several cycles.
   - Deassert reset.
   - Verify the AXI-lite visible state is reset to the RTL-defined defaults.
   - Verify CONTROL/busy is not active after reset.
   - Verify STATUS.done/error behavior matches reset defaults.
   - Verify PROCESSED_COUNT is reset or cleared according to RTL behavior.
   - Verify no simulation hang occurs.

3. After reset, run a fresh valid transfer:
   - Program new SRC_ADDR, DST_ADDR, LENGTH_WORDS, and ADD_VALUE.
   - Start DMA.
   - Poll STATUS.done.
   - Verify STATUS.error=0.
   - Verify PROCESSED_COUNT equals LENGTH_WORDS.
   - Verify destination memory contents are correct.

4. Add canary checks:
   - Place canary values around the destination region used before reset.
   - Verify no unexpected writes occur after reset.
   - It is acceptable that some words may have been written before reset if the reset occurs after partial progress; document the observed behavior.

5. Keep all existing tests passing.

6. Use existing AXI-lite read/write/polling helpers where possible.

7. Add timeout guards to any new wait loop.

8. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_add_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether CI grep gate passed
- Whether reset-during-transfer is now covered
- Observed reset behavior
- Any remaining limitations
