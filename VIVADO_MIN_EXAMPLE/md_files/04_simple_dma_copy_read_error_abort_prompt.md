# 04. Simple DMA Copy Read-error Abort Prompt

```text
Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may modify only:
  - rtl/simple_dma_copy.v
  - tb/simple_dma_copy_tb.sv
  - scripts/run_simple_dma_copy_sim.sh
  - ai_context/current_status.md
- Do not modify:
  - tb/axi_mem_model.sv
  - tb/mem_rw_tb.sv
  - rtl/simple_axi_master.v
  - tb/simple_axi_master_tb.sv
  - rtl/axi_lite_regfile.v
  - tb/axi_lite_regfile_tb.sv

Goal:
Improve simple_dma_copy error handling so that a read error aborts the copy before the write phase.

Requirements:
1. Current behavior:
   - The DMA performs read first, then write.
   - Even if read returns SLVERR, the write phase still executes.
2. New behavior:
   - If rresp != 2'b00 during RD_DATA, assert error and go directly to DONE.
   - Do not issue AW/W for the destination write.
   - Destination memory must remain unchanged on read error.
3. Keep existing normal-copy behavior unchanged.
4. Keep single-beat only.
5. Keep wstrb=4'hF.
6. Update tb/simple_dma_copy_tb.sv:
   - Add or update a test for invalid source address.
   - Verify done=1 and error=1.
   - Verify destination memory was not modified.
7. Keep timeout guards.
8. Run scripts/run_simple_dma_copy_sim.sh.

Final report must include:
- Files changed
- FSM change summary
- Number of checks passed
- Whether CI grep gate passed
- Any remaining limitations
```
