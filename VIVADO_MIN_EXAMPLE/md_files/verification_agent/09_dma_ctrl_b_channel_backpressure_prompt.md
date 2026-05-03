Before doing any implementation, save this exact prompt into:

md_files/09_dma_ctrl_b_channel_backpressure_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/09_dma_ctrl_b_channel_backpressure_prompt.md
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
Close the AXI-lite B-channel backpressure coverage gap in simple_dma_ctrl_tb.

Current limitation:
- The RTL's W_BRESP path is exercised.
- However, the testbench does not deliberately delay bready.
- Therefore, B-channel backpressure behavior is not independently verified.

Requirements:

1. Add an AXI-lite master task that deliberately delays bready:
   - axil_write_bready_delay(addr, data, expected_resp, delay_cycles)

2. The task should:
   - use the existing negedge-drive / posedge-sample style
   - complete AW/W handshake normally
   - keep bready=0 for delay_cycles after the write handshake
   - verify bvalid remains asserted while bready=0
   - assert bready after the delay
   - capture bresp and compare it with expected_resp
   - include timeout guards for every wait loop

3. Add tests that explicitly exercise:
   - valid write to SRC_ADDR with delayed bready
   - valid write to DST_ADDR with delayed bready
   - valid write to LENGTH_WORDS with delayed bready
   - invalid address write with delayed bready returning SLVERR

4. After programming registers using delayed-bready writes:
   - start a DMA transfer
   - poll STATUS.done
   - verify STATUS.error = 0
   - verify COPIED_COUNT
   - verify destination memory contents

5. Keep all existing tests passing.

6. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether the CI grep gate passed
- Whether B-channel backpressure is now covered
- Any remaining limitations
