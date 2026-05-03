Before doing any implementation, save this exact prompt into:

md_files/16_dma_add_restart_after_error_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/16_dma_add_restart_after_error_prompt.md
  - tb/simple_dma_add_nword_tb.sv
  - ai_context/current_status.md

- Do not modify RTL unless the new test reveals a real RTL issue.

- Do not modify:
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
  - any previously verified files

Goal:
Add restart-after-error coverage for simple_dma_add_nword.

Current limitation:
- Identity mode and error-case observability are now covered.
- However, the testbench does not verify that the DMA add engine can recover and run a normal transfer after an error.

Requirements:

1. Add a restart-after-read-error test:
   - First run a transfer that triggers a read error, for example invalid source mid-processing.
   - Verify done=1 and error=1.
   - Verify processed_count reflects only successfully written words before the failed read.
   - Then immediately run a new valid transfer.
   - Verify done=1 and error=0.
   - Verify processed_count equals the new valid length.
   - Verify all destination words of the new valid transfer are correct.

2. Add a restart-after-write-error test:
   - First run a transfer that triggers a write error, for example invalid destination mid-processing.
   - Verify done=1 and error=1.
   - Verify processed_count excludes the failed write.
   - Then immediately run a new valid transfer.
   - Verify done=1 and error=0.
   - Verify processed_count equals the new valid length.
   - Verify all destination words of the new valid transfer are correct.

3. Add canary checks:
   - Verify failed-transfer destination canaries remain unchanged where appropriate.
   - Verify the later valid transfer does not accidentally use stale src/dst/length/add_value from the failed transfer.

4. Keep all existing tests passing.

5. Use existing helper tasks where possible.

6. Add timeout guards to any new wait loop.

7. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_add_nword_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether CI grep gate passed
- Whether restart-after-read-error is covered
- Whether restart-after-write-error is covered
- Any remaining limitations
