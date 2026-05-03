# 07. Next Prompt — AXI-lite Controlled DMA Wrapper

```text
Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - rtl/simple_dma_ctrl.v
  - tb/simple_dma_ctrl_tb.sv
  - scripts/run_simple_dma_ctrl_sim.sh
  - ai_context/current_status.md
- You may reuse or instantiate:
  - rtl/simple_dma_copy_nword.v
  - tb/axi_mem_model.sv
- Do not modify existing verified files unless absolutely necessary.

Goal:
Create a minimal AXI-lite controlled DMA wrapper around simple_dma_copy_nword.

Requirements for rtl/simple_dma_ctrl.v:
1. Expose an AXI-lite slave control interface.
2. Expose an AXI master memory interface connected internally to simple_dma_copy_nword.
3. Implement control/status registers:
   - 0x00 CONTROL: bit0=start, write-1-to-start
   - 0x04 SRC_ADDR
   - 0x08 DST_ADDR
   - 0x0C LENGTH_WORDS
   - 0x10 STATUS: bit0=done, bit1=error, read-only
   - 0x14 COPIED_COUNT: read-only
4. Valid AXI-lite addresses should return OKAY.
5. Invalid AXI-lite addresses should return SLVERR.
6. Writing CONTROL.start should launch one DMA transfer if not busy.
7. STATUS.done should become 1 when the DMA finishes.
8. STATUS.error should reflect DMA error.
9. COPIED_COUNT should reflect words successfully copied.
10. Keep the FSM simple and readable.

Requirements for tb/simple_dma_ctrl_tb.sv:
1. Instantiate simple_dma_ctrl and axi_mem_model.
2. Generate clock/reset.
3. Implement AXI-lite master tasks:
   - axil_write32(addr, data, expected_resp)
   - axil_read32(addr, data, expected_resp)
4. Seed source memory via hierarchical access.
5. Test:
   - program SRC_ADDR, DST_ADDR, LENGTH_WORDS
   - write CONTROL.start
   - poll STATUS.done with timeout
   - verify STATUS.error=0
   - verify COPIED_COUNT
   - verify destination memory contents
   - invalid AXI-lite address returns SLVERR
   - invalid source or destination causes STATUS.error=1 and partial copied_count as expected
6. Use negedge-drive / posedge-sample style for AXI-lite tasks.
7. Add timeout guards.
8. Print [PASS]/[FAIL] lines.
9. Print [DONE] only after all checks pass.

Requirements for scripts/run_simple_dma_ctrl_sim.sh:
1. Run xvlog, xelab, xsim.
2. Save logs under logs/.
3. Fail if [FAIL] or FATAL appears in the xsim log.
4. Print concise pass/fail summary.

Final report must include:
- Files created
- Register map summary
- DMA control flow summary
- Number of checks passed
- Whether CI grep gate passed
- Any limitations
```
