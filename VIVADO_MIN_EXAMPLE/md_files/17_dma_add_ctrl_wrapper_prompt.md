Before doing any implementation, save this exact prompt into:

md_files/17_dma_add_ctrl_wrapper_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/17_dma_add_ctrl_wrapper_prompt.md
  - rtl/simple_dma_add_ctrl.v
  - tb/simple_dma_add_ctrl_tb.sv
  - scripts/run_simple_dma_add_ctrl_sim.sh
  - ai_context/current_status.md

- You may reuse or instantiate:
  - rtl/simple_dma_add_nword.v
  - tb/axi_mem_model.sv

- You may refer to, but must not modify:
  - rtl/simple_dma_ctrl.v
  - tb/simple_dma_ctrl_tb.sv
  - scripts/run_simple_dma_ctrl_sim.sh

- Do not modify existing verified files:
  - rtl/simple_dma_add_nword.v
  - tb/simple_dma_add_nword_tb.sv
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
Create a minimal AXI-lite controlled DMA add accelerator wrapper around simple_dma_add_nword.

The goal is to move from a standalone processing DMA engine to a memory-mapped accelerator peripheral.

Requirements for rtl/simple_dma_add_ctrl.v:

1. Expose an AXI-lite slave control interface.

2. Expose an AXI master memory interface connected internally to simple_dma_add_nword.

3. Implement the following control/status registers:

   - 0x00 CONTROL
     - bit0 = start, write-1-to-start
     - read bit0 may expose busy or 0, but document the chosen behavior

   - 0x04 SRC_ADDR
     - read/write

   - 0x08 DST_ADDR
     - read/write

   - 0x0C LENGTH_WORDS
     - read/write, lower 16 bits used

   - 0x10 ADD_VALUE
     - read/write, 32-bit constant added to each source word

   - 0x14 STATUS
     - bit0 = done
     - bit1 = error
     - bit2 = busy if implemented
     - read-only

   - 0x18 PROCESSED_COUNT
     - read-only

   - 0x1C LAST_INPUT_DATA
     - read-only

   - 0x20 LAST_OUTPUT_DATA
     - read-only

4. Valid AXI-lite addresses should return OKAY.

5. Invalid AXI-lite addresses should return SLVERR.

6. Writing CONTROL.start should launch one processing-DMA transfer if not busy.

7. If CONTROL.start is written while busy:
   - do not restart the active transfer
   - do not corrupt the active transfer
   - return the RTL-defined AXI-lite response, preferably OKAY if that matches the simple_dma_ctrl behavior

8. STATUS.done should become 1 when the DMA add engine finishes.

9. STATUS.error should reflect the DMA add engine error output.

10. PROCESSED_COUNT should reflect words successfully processed and written.

11. LAST_INPUT_DATA and LAST_OUTPUT_DATA should reflect the internal engine outputs after completion.

12. On a new valid start:
   - clear or update previous done/error state according to a simple documented policy
   - latch SRC_ADDR, DST_ADDR, LENGTH_WORDS, and ADD_VALUE into the engine start

13. Keep the AXI-lite write FSM simple:
   - support simultaneous AW+W
   - support AW-before-W
   - support W-before-AW if practical, ideally mirroring simple_dma_ctrl

14. Keep the AXI-lite read FSM simple:
   - return stable rdata/rresp while rvalid=1 and rready=0

15. Do not support AXI bursts or multiple outstanding transactions on the memory master side.

Requirements for tb/simple_dma_add_ctrl_tb.sv:

1. Instantiate simple_dma_add_ctrl and the existing axi_mem_model.

2. Generate clock/reset.

3. Implement or reuse AXI-lite master tasks:
   - axil_write32(addr, data, expected_resp)
   - axil_read32(addr, data, expected_resp)
   - poll_done(timeout_cycles)

4. Use negedge-drive / posedge-sample style.

5. Add timeout guards to every wait loop.

6. Seed source memory and canary values via hierarchical memory access.

7. Print [PASS]/[FAIL] lines.

8. Print [DONE] only after all checks pass.

Tests:

1. Register read/write sanity:
   - Write SRC_ADDR, DST_ADDR, LENGTH_WORDS, ADD_VALUE.
   - Read them back.
   - Verify values.
   - Verify invalid AXI-lite read/write addresses return SLVERR.

2. Normal add transfer, length_words=1:
   - source = 0x0000_0010
   - add_value = 0x0000_0005
   - expected destination = 0x0000_0015
   - verify STATUS.done=1
   - verify STATUS.error=0
   - verify PROCESSED_COUNT=1
   - verify LAST_INPUT_DATA=0x0000_0010
   - verify LAST_OUTPUT_DATA=0x0000_0015

3. Normal add transfer, length_words=4:
   - seed four unique source words
   - use a nonzero ADD_VALUE, for example 0x0000_0100
   - verify all destination words equal source + ADD_VALUE
   - verify PROCESSED_COUNT=4
   - verify LAST_INPUT_DATA and LAST_OUTPUT_DATA for the fourth word

4. Identity mode:
   - ADD_VALUE=0
   - verify destination words equal source words
   - verify error=0
   - verify count is correct

5. Overflow behavior:
   - source = 0xFFFF_FFFF
   - ADD_VALUE = 1
   - verify destination = 0x0000_0000
   - verify no error is generated for arithmetic overflow

6. Zero-length transfer:
   - LENGTH_WORDS=0
   - verify done=1
   - verify error=0
   - verify PROCESSED_COUNT=0
   - verify destination and canary values remain unchanged

7. Invalid source error:
   - choose a source range that becomes out-of-range mid-transfer
   - verify STATUS.error=1
   - verify PROCESSED_COUNT equals the number of successfully processed words before the failed read
   - verify no write was issued for the failed read word
   - verify destination canary after the failed index remains unchanged

8. Invalid destination error:
   - choose a destination range that becomes out-of-range mid-transfer
   - verify STATUS.error=1
   - verify PROCESSED_COUNT excludes the failed write
   - verify in-range destination words before the failure were processed correctly
   - verify source memory remains unchanged

9. Busy-state behavior:
   - start a longer transfer
   - read STATUS while the accelerator is busy if possible
   - verify busy/done/error behavior according to RTL policy
   - attempt a second CONTROL.start while busy
   - verify it does not corrupt or restart the active transfer

10. Restart-after-error:
   - run a transfer that ends with error
   - immediately run a valid transfer
   - verify the second transfer completes normally and does not use stale parameters

Requirements for scripts/run_simple_dma_add_ctrl_sim.sh:

1. Run xvlog, xelab, xsim.

2. Save logs under logs/.

3. Fail if [FAIL] or FATAL appears in the xsim log.

4. Print concise pass/fail summary.

Final report must include:
- Files created
- Prompt backup path
- Register map summary
- DMA add control flow summary
- FSM summary
- Number of checks passed
- Whether CI grep gate passed
- Whether normal add, identity, overflow, zero-length, error, busy, and restart-after-error cases are covered
- Any remaining limitations
