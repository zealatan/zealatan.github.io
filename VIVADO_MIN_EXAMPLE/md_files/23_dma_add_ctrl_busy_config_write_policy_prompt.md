# Prompt 23. DMA Add Ctrl Busy Config Write Policy Prompt

Before doing any implementation, save this exact prompt into:

md_files/23_dma_add_ctrl_busy_config_write_policy_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/23_dma_add_ctrl_busy_config_write_policy_prompt.md
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
Add coverage for configuration register writes while the DMA add controller is busy.

Current limitation:
- Repeated normal restart and deterministic smoke-level valid-transfer coverage are now covered.
- Busy-state CONTROL.start retrigger behavior is covered.
- However, the testbench does not explicitly verify what happens if SRC_ADDR, DST_ADDR, LENGTH_WORDS, and ADD_VALUE are written while a transfer is already active.
- This leaves a possible stale-state or active-transfer corruption hazard.

Expected design policy:
- The active transfer should use the parameters latched at the original CONTROL.start.
- Writes to SRC_ADDR, DST_ADDR, LENGTH_WORDS, and ADD_VALUE while busy may be accepted by AXI-lite, but they must not affect the already-running transfer.
- After the active transfer completes, the written register values should be visible through AXI-lite readback if that is the RTL behavior.
- A later transfer should use the newly programmed values.

Requirements:

1. Add a new test, for example Test 17: busy config write policy.

2. The test should first program an original transfer:
   - original SRC_ADDR
   - original DST_ADDR
   - original LENGTH_WORDS
   - original ADD_VALUE
   - Use a sufficiently long transfer so that the testbench can perform AXI-lite writes while the DMA is still busy.
   - Seed original source memory with known data.
   - Place canary values before and after the original destination region.

3. Start the original transfer:
   - Write CONTROL.start.
   - Confirm busy state if possible by reading STATUS or CONTROL.
   - If busy observation is timing-sensitive, use a long enough LENGTH_WORDS to make the active window reliable.

4. While the original transfer is busy, write new configuration values:
   - new SRC_ADDR
   - new DST_ADDR
   - new LENGTH_WORDS
   - new ADD_VALUE

5. These busy-time writes should:
   - Return OKAY if that matches the existing RTL behavior.
   - Not restart the active transfer.
   - Not corrupt the active transfer.
   - Not change the data produced by the active transfer.

6. Poll until the original transfer completes.

7. Verify the original transfer result:
   - STATUS.done = 1.
   - STATUS.error = 0.
   - PROCESSED_COUNT equals the original LENGTH_WORDS.
   - Destination words at original DST_ADDR equal original source words + original ADD_VALUE.
   - LAST_INPUT_DATA equals the final original source word.
   - LAST_OUTPUT_DATA equals the final original source word + original ADD_VALUE.
   - Original destination canaries remain unchanged.
   - The new destination region has not been accidentally written during the original transfer.

8. After the original transfer completes, read back the configuration registers:
   - SRC_ADDR
   - DST_ADDR
   - LENGTH_WORDS
   - ADD_VALUE

   Verify they match the new values if this is the observed RTL policy.
   If the RTL intentionally ignores config writes while busy, document the observed behavior clearly and verify it consistently.
   Do not modify RTL only to force one policy unless the behavior is clearly inconsistent or corrupts active transfer state.

9. Start a second transfer using the new configuration:
   - Seed the new source memory with known data.
   - Place canaries around the new destination region.
   - Write CONTROL.start.
   - Poll STATUS.done.
   - Verify STATUS.error = 0.
   - Verify PROCESSED_COUNT equals new LENGTH_WORDS.
   - Verify all new destination words equal new source words + new ADD_VALUE.
   - Verify LAST_INPUT_DATA and LAST_OUTPUT_DATA correspond to the final new word.
   - Verify new destination canaries remain unchanged.

10. Add timeout guards to every new wait loop.

11. Use existing AXI-lite read/write/poll helper tasks where possible.

12. Keep all existing tests passing.

13. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_add_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether the CI grep gate passed
- Whether busy-time config register writes are covered
- Whether active-transfer parameter latching is verified
- Whether stale/new parameter behavior after completion is verified
- Whether the second transfer uses the new configuration correctly
- Any observed RTL policy for config writes while busy
- Any remaining limitations
