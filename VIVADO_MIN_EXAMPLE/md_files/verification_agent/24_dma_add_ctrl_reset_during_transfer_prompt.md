# Prompt 24. DMA Add Ctrl Reset During Transfer Prompt

Before doing any implementation, save this exact prompt into:

md_files/24_dma_add_ctrl_reset_during_transfer_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/24_dma_add_ctrl_reset_during_transfer_prompt.md
  - tb/simple_dma_add_ctrl_tb.sv
  - ai_context/current_status.md

- Do not modify RTL unless the new test reveals a real RTL issue.

- Do not modify:
  - rtl/simple_dma_add_ctrl.v
  - rtl/simple_dma_add_nword.v
  - rtl/simple_dma_ctrl.v
  - tb/simple_dma_ctrl_tb.sv
  - rtl/simple_dma_copy_nword.v
  - tb/simple_dma_copy_nword_tb.sv
  - rtl/simple_dma_copy.v
  - tb/simple_dma_copy_tb.sv
  - rtl/simple_axi_master.v
  - tb/simple_axi_master_tb.sv
  - rtl/axi_lite_regfile.v
  - tb/axi_lite_regfile_tb.sv
  - tb/axi_mem_model.sv
  - tb/mem_rw_tb.sv
  - scripts/run_simple_dma_add_ctrl_sim.sh
  - any previously verified files

Goal:
Add reset-during-transfer coverage for the AXI-lite controlled DMA add accelerator.

Current limitation:
- Repeated normal restart is covered.
- Deterministic valid-transfer smoke coverage is covered.
- Busy-time config register write policy is covered.
- However, the testbench does not yet verify behavior when reset is asserted while the DMA add accelerator is actively running.
- This leaves a reset/lifecycle hazard unclosed.

Expected design policy:
- Asserting reset during an active transfer should return the controller and internal DMA engine to a clean reset state.
- After reset, software-visible control/status registers should return to documented reset defaults.
- No stale busy/done/error/count/last-data state should survive reset.
- After reset release, a fresh transfer should run normally with newly programmed configuration.
- The reset-aborted transfer must not corrupt memory outside the words that may have already completed before reset.
- Canary words around the destination region must remain unchanged.

Requirements:

1. Add a new test, for example Test 18: reset during transfer.

2. The test should first program a long original transfer:
   - original SRC_ADDR
   - original DST_ADDR
   - original LENGTH_WORDS
   - original ADD_VALUE
   - Use a sufficiently long LENGTH_WORDS so reset can be asserted while the DMA is still busy.
   - Seed original source memory with known data.
   - Initialize the original destination region to a known canary or sentinel value.
   - Place canary words before and after the original destination region.

3. Start the original transfer:
   - Write SRC_ADDR.
   - Write DST_ADDR.
   - Write LENGTH_WORDS.
   - Write ADD_VALUE.
   - Write CONTROL.start.
   - Immediately read STATUS or CONTROL if useful.
   - Verify busy=1 if the active window is observable.
   - Remember STATUS layout:
     - bit0 = done
     - bit1 = error
     - bit2 = busy

4. Assert reset while the transfer is in-flight:
   - Wait a small fixed number of cycles after start, for example 5 to 20 cycles.
   - Assert aresetn=0 for several cycles, for example 5 to 10 cycles.
   - Deassert reset.
   - Add enough cycles after reset release for the DUT to settle.

5. After reset release, verify AXI-lite visible reset defaults:
   - CONTROL readback is reset/default value according to RTL policy.
   - SRC_ADDR readback is reset/default value.
   - DST_ADDR readback is reset/default value.
   - LENGTH_WORDS readback is reset/default value.
   - ADD_VALUE readback is reset/default value.
   - STATUS.done = 0.
   - STATUS.error = 0.
   - STATUS.busy = 0.
   - PROCESSED_COUNT = 0.
   - LAST_INPUT_DATA = 0 or documented reset/default value.
   - LAST_OUTPUT_DATA = 0 or documented reset/default value.

6. Verify the reset-aborted transfer did not corrupt memory outside allowed progress:
   - Destination canary before the original destination region remains unchanged.
   - Destination canary after the original destination region remains unchanged.
   - No writes occurred outside the original destination region.
   - It is acceptable if zero or more early destination words inside the original destination region were written before reset, because reset timing may occur after some completed beats.
   - If checking the original destination region, classify each word as either:
     - still sentinel/canary value, or
     - the correct original source + original ADD_VALUE value.
   - Do not require an exact number of completed words before reset unless the testbench timing makes it deterministic and reliable.

7. Verify the DUT is reusable after reset:
   - Program a fresh new transfer with new SRC_ADDR, DST_ADDR, LENGTH_WORDS, and ADD_VALUE.
   - Seed new source memory with known data.
   - Place canaries around the new destination region.
   - Write CONTROL.start.
   - Poll STATUS.done with a timeout.
   - Verify STATUS.done = 1.
   - Verify STATUS.error = 0.
   - Verify STATUS.busy = 0 after completion.
   - Verify PROCESSED_COUNT equals new LENGTH_WORDS.
   - Verify every new destination word equals new source word + new ADD_VALUE.
   - Verify LAST_INPUT_DATA equals the final new source word.
   - Verify LAST_OUTPUT_DATA equals final new source word + new ADD_VALUE.
   - Verify new destination canaries remain unchanged.

8. Add timeout guards to every new wait loop.

9. Use existing AXI-lite read/write/poll helper tasks where possible.

10. Keep all existing tests passing.

11. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_add_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether the CI grep gate passed
- Whether reset-during-transfer is covered
- Whether post-reset register/status defaults are verified
- Whether post-reset restart/reuse is verified
- Whether destination/canary memory integrity is verified
- Any observed reset-default policy for CONTROL/SRC/DST/LENGTH/ADD/STATUS/COUNT/LAST_INPUT/LAST_OUTPUT
- Any remaining limitations
