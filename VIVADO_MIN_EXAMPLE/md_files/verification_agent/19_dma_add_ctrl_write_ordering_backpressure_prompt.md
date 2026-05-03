Before doing any implementation, save this exact prompt into:

md_files/19_dma_add_ctrl_write_ordering_backpressure_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/19_dma_add_ctrl_write_ordering_backpressure_prompt.md
  - tb/simple_dma_add_ctrl_tb.sv
  - ai_context/current_status.md

- Do not modify RTL unless the new tests reveal a real RTL issue.

- Do not modify:
  - rtl/simple_dma_add_ctrl.v
  - rtl/simple_dma_add_nword.v
  - tb/axi_mem_model.sv
  - any previously verified RTL/TB/script files

Goal:
Close the AXI-lite write-ordering and B-channel backpressure coverage gaps in simple_dma_add_ctrl_tb.

Current limitation:
- simple_dma_add_ctrl_tb currently uses mostly simultaneous AW+W writes.
- AW-before-W and W-before-AW write paths are not independently covered.
- B-channel backpressure with delayed bready is not independently covered.

Requirements:

1. Add AXI-lite write-ordering tasks if not already present:
   - axil_write_aw_first(addr, data, expected_resp)
   - axil_write_w_first(addr, data, expected_resp)

2. Add an AXI-lite delayed-BREADY task:
   - axil_write_bready_delay(addr, data, expected_resp, delay_cycles)

3. All new tasks must:
   - use negedge-drive / posedge-sample style
   - include timeout guards on every wait loop
   - capture and check bresp
   - print [PASS]/[FAIL] evidence through existing helper checks

4. Add tests for write-ordering:
   - AW-before-W write to SRC_ADDR
   - W-before-AW write to DST_ADDR
   - AW-before-W write to LENGTH_WORDS
   - W-before-AW write to ADD_VALUE
   - W-before-AW or AW-before-W write to CONTROL.start
   - invalid address with AW-before-W returns SLVERR
   - invalid address with W-before-AW returns SLVERR

5. After programming registers using mixed write ordering:
   - start a DMA add transfer
   - poll STATUS.done
   - verify STATUS.error = 0
   - verify PROCESSED_COUNT
   - verify LAST_INPUT_DATA
   - verify LAST_OUTPUT_DATA
   - verify destination memory contents equal source + ADD_VALUE

6. Add tests for B-channel backpressure:
   - valid write to SRC_ADDR with delayed bready
   - valid write to DST_ADDR with delayed bready
   - valid write to LENGTH_WORDS with delayed bready
   - valid write to ADD_VALUE with delayed bready
   - invalid address write with delayed bready returning SLVERR

7. In the delayed-bready task:
   - keep bready=0 for delay_cycles after bvalid appears
   - verify bvalid remains asserted while bready=0
   - then assert bready and complete the transaction

8. Keep all existing tests passing.

9. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_add_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tasks added
- New tests added
- Number of checks passed
- Whether CI grep gate passed
- Whether AW-before-W and W-before-AW are now covered
- Whether B-channel backpressure is now covered
- Any remaining limitations
