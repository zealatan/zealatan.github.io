Before doing any implementation, save this exact prompt into:

md_files/15_dma_add_identity_and_error_observability_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/15_dma_add_identity_and_error_observability_prompt.md
  - tb/simple_dma_add_nword_tb.sv
  - ai_context/current_status.md

- Do not modify RTL unless the new tests reveal a real RTL issue.

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
Strengthen simple_dma_add_nword verification by adding identity-mode coverage and error-case observability checks.

Current limitations:
- add_value=0 identity/copy mode is not explicitly tested.
- last_input_data and last_output_data are not checked in error cases.

Requirements:

1. Add an identity-mode test:
   - Set add_value = 0.
   - Copy/process multiple source words, for example 4 words.
   - Verify each destination word equals the corresponding source word.
   - Verify processed_count equals length_words.
   - Verify last_input_data equals the final source word.
   - Verify last_output_data equals the final source word.
   - Verify error=0.

2. Strengthen invalid-source mid-processing test:
   - Verify last_input_data and last_output_data remain equal to the last successfully processed word.
   - Verify processed_count equals the number of successfully written words before the failed read.
   - Verify no write was issued for the failed read word.
   - Verify destination canary after the failed index remains unchanged.

3. Strengthen invalid-destination mid-processing test:
   - Verify last_input_data corresponds to the failed write input word if that is the RTL behavior.
   - Verify last_output_data corresponds to the processed value for the failed write word if that is the RTL behavior.
   - Verify processed_count does not include the failed write.
   - Verify in-range destination words before the failure were processed correctly.
   - Verify source memory remains unchanged.

4. Do not change RTL unless the observed behavior is clearly inconsistent with design intent.

5. Keep all existing tests passing.

6. Use existing helper tasks where possible.

7. Add timeout guards to any new wait loop.

8. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_add_nword_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether CI grep gate passed
- Whether identity mode is covered
- Whether error-case last_input_data/last_output_data observability is covered
- Any remaining limitations
