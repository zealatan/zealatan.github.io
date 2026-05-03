Before doing any implementation, save this exact prompt into:

md_files/08_dma_ctrl_write_ordering_coverage_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/08_dma_ctrl_write_ordering_coverage_prompt.md
  - tb/simple_dma_ctrl_tb.sv
  - ai_context/current_status.md

- Do not modify RTL unless the new tests reveal a real RTL issue.

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
Close the AXI-lite write-ordering coverage gap in simple_dma_ctrl_tb.

Current limitation:
- simple_dma_ctrl implements W_IDLE, W_WAIT_W, and W_WAIT_A write FSM paths.
- The current testbench only exercises simultaneous AW+W writes.
- W_WAIT_W and W_WAIT_A paths are implemented but not yet exercised by the testbench.

Requirements:

1. Add AXI-lite master tasks:
   - axil_write_aw_first(addr, data, expected_resp)
   - axil_write_w_first(addr, data, expected_resp)

2. Use the existing negedge-drive / posedge-sample style.

3. Add timeout guards to every wait loop.

4. Add tests that explicitly exercise:
   - AW-before-W write to SRC_ADDR
   - W-before-AW write to DST_ADDR
   - AW-before-W write to LENGTH_WORDS
   - W-before-AW write to CONTROL.start
   - invalid address with AW-before-W returns SLVERR
   - invalid address with W-before-AW returns SLVERR

5. After programming registers using mixed write ordering:
   - start a DMA transfer
   - poll STATUS.done
   - verify STATUS.error = 0
   - verify COPIED_COUNT
   - verify destination memory contents

6. Keep all existing tests passing.

7. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether the CI grep gate passed
- Whether W_WAIT_W and W_WAIT_A are now covered
- Any remaining limitations
