# Prompt 25. DMA/AXI Verification Closure Documentation Prompt

Before doing any implementation, save this exact prompt into:

md_files/25_dma_axi_verification_closure_docs_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/25_dma_axi_verification_closure_docs_prompt.md
  - ai_context/known_limitations.md
  - ai_context/design_contract.md
  - ai_context/verification_matrix.md
  - ai_context/verification_closure_criteria.md
  - ai_context/final_verification_summary.md
  - ai_context/current_status.md

- Do not modify RTL.
- Do not modify testbenches.
- Do not modify simulation scripts.
- Do not modify any previously verified design or test files.

Goal:
Create the verification closure documentation package for the DMA/AXI verification workflow v1.

Current status:
- The DMA add control verification has reached 691/691 checks passing.
- Cumulative checks across all layers reached 1156/1156 PASS.
- CI grep gate passed.
- Repeated restart, deterministic smoke, busy config write policy, and reset-during-transfer coverage are complete.
- The remaining task is to document what has been verified, what is intentionally out of scope, and what evidence supports verification closure.

Requirements:

1. Create ai_context/known_limitations.md.

The document should clearly list limitations intentionally deferred from this verification phase, including at least:
- No UVM environment.
- No constrained-random coverage-driven verification.
- No formal verification.
- No full AXI4 burst support.
- No multiple outstanding AXI transactions.
- No scatter-gather descriptor support.
- No 4KB boundary split support.
- No CDC verification; single-clock design assumption.
- No synthesis/timing closure yet.
- No FPGA board validation yet.
- Misaligned address behavior not fully verified unless already documented elsewhere.
- Source/destination overlap behavior not fully verified unless already documented elsewhere.
- Exact number of destination words completed before reset is not checked because reset timing is intentionally treated as timing-dependent.

2. Create ai_context/design_contract.md.

The document should summarize the expected design behavior for:
- AXI-lite register interface.
- CONTROL.start behavior.
- STATUS.done/error/busy layout.
- SRC_ADDR/DST_ADDR/LENGTH_WORDS/ADD_VALUE register behavior.
- PROCESSED_COUNT behavior.
- LAST_INPUT_DATA and LAST_OUTPUT_DATA behavior.
- Normal add transfer behavior.
- Identity mode behavior.
- Overflow wraparound behavior.
- Read error behavior.
- Write error behavior.
- Busy CONTROL.start retrigger behavior.
- Busy config register write policy.
- Zero-length transfer behavior.
- Restart after normal completion.
- Restart after error.
- Reset during transfer behavior.
- Post-reset register defaults.
- Memory/canary integrity expectations.

Use the observed STATUS layout:
- STATUS bit0 = done
- STATUS bit1 = error
- STATUS bit2 = busy

Use the observed reset policy:
- CONTROL, SRC_ADDR, DST_ADDR, LENGTH_WORDS, ADD_VALUE, STATUS, PROCESSED_COUNT, LAST_INPUT_DATA, LAST_OUTPUT_DATA reset to 0x00000000.

3. Create ai_context/verification_matrix.md.

The matrix should summarize the verification coverage across the project.

Use a markdown table with columns:
- ID
- Module
- Category
- Scenario
- Prompt
- Test or Evidence
- Status

Include entries for at least:
- AXI-lite invalid address patch.
- AXI memory model.
- Simple AXI master.
- 1-word DMA copy.
- Read-error abort.
- Invalid destination behavior.
- N-word DMA copy.
- AXI-lite controlled DMA wrapper.
- AXI-lite write ordering.
- AXI-lite B-channel backpressure.
- AXI-lite R-channel backpressure.
- Busy-state status read.
- Busy retrigger guard.
- Zero-length restart.
- DMA add processing block.
- Identity and error observability.
- Restart after error.
- DMA add control wrapper.
- Reset during transfer for DMA ctrl if present.
- Reset during transfer for DMA add ctrl.
- Repeated restart and deterministic smoke.
- Busy config write policy.

4. Create ai_context/verification_closure_criteria.md.

The document should define when the DMA/AXI verification workflow v1 is considered closed.

Include criteria such as:
- All planned prompts completed.
- All simulation scripts pass.
- No [FAIL] or FATAL in logs.
- [DONE] appears in simulation logs where applicable.
- Expected check counts match final reports.
- No forbidden files were modified.
- Each major design contract item is either verified or listed as a known limitation.
- Remaining limitations are explicitly documented.
- Verification matrix is updated.
- Final verification summary is written.

5. Create ai_context/final_verification_summary.md.

The summary should include:
- Project purpose.
- Verification methodology.
- Prompt sequence summary.
- Modules covered.
- Major coverage categories.
- Final check count summary:
  - simple_dma_add_ctrl: 691/691 PASS
  - cumulative across all layers: 1156/1156 PASS
- CI grep gate result.
- Major hazards closed:
  - AXI-lite invalid access
  - AXI-lite ordering
  - AXI-lite B/R backpressure
  - error abort behavior
  - zero-length transfer
  - busy retrigger
  - busy config write
  - repeated restart
  - deterministic smoke
  - reset during transfer
- Remaining limitations.
- Recommendation that the next phase should move to RTL Designer protocol v1.

6. Update ai_context/current_status.md.

Add a new closure section summarizing:
- Verification phase v1 is technically closed.
- Closure documents created.
- No RTL/TB changes were made.
- Next recommended phase:
  - RTL Designer protocol v1
  - architecture_spec_template.md
  - interface_contract_template.md
  - microarchitecture_report_template.md
  - verification_handoff_template.md

7. Do not invent unsupported check counts.
Use the latest known values:
- simple_dma_add_ctrl: 691/691 PASS
- cumulative across all layers: 1156/1156 PASS

8. Keep the writing clear, concise, and reusable.
These documents should be usable later as the basis for an AI Verification Engineer protocol.

No simulation run is required because this is a documentation-only closure task.

Final report must include:
- Files changed
- Prompt backup path
- Closure documents created
- Whether RTL/TB/scripts were untouched
- Final verification status
- Remaining limitations documented
- Recommended next phase
