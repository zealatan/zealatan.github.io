# 05. Simple DMA Copy Invalid Destination Strengthening Prompt

```text
Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may modify only:
  - tb/simple_dma_copy_tb.sv
  - ai_context/current_status.md
- Do not modify RTL unless the test reveals a real RTL issue.
- Do not modify:
  - tb/axi_mem_model.sv
  - tb/mem_rw_tb.sv
  - rtl/simple_axi_master.v
  - tb/simple_axi_master_tb.sv
  - rtl/axi_lite_regfile.v
  - tb/axi_lite_regfile_tb.sv

Goal:
Strengthen invalid-destination verification for simple_dma_copy.

Requirements:
1. Keep the current RTL behavior:
   - Source read succeeds.
   - Destination write is attempted.
   - Destination bresp returns SLVERR.
   - done=1 and error=1.
2. Add or strengthen Test 4:
   - Seed a valid source address with known data.
   - Start DMA with valid src_addr and invalid dst_addr.
   - Verify done=1.
   - Verify error=1.
   - Verify copied_data equals the source data.
   - Verify source memory remains unchanged.
   - If possible, verify no in-range memory word was accidentally modified.
3. Keep timeout guards.
4. Run scripts/run_simple_dma_copy_sim.sh.

Final report must include:
- Files changed
- Number of checks passed
- Whether CI grep gate passed
- Any remaining limitations
```
