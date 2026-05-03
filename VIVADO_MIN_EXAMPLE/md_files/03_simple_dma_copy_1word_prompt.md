# 03. Simple DMA Copy 1-word Prompt

```text
Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - rtl/simple_dma_copy.v
  - tb/simple_dma_copy_tb.sv
  - scripts/run_simple_dma_copy_sim.sh
  - ai_context/current_status.md
- You may instantiate the existing tb/axi_mem_model.sv.
- Do not modify:
  - tb/axi_mem_model.sv
  - tb/mem_rw_tb.sv
  - rtl/simple_axi_master.v
  - tb/simple_axi_master_tb.sv
  - rtl/axi_lite_regfile.v
  - tb/axi_lite_regfile_tb.sv

Goal:
Create a minimal simple DMA copy engine that copies one 32-bit word from a source address to a destination address through AXI.

Requirements for rtl/simple_dma_copy.v:
1. Inputs:
   - aclk
   - aresetn
   - start
   - src_addr[31:0]
   - dst_addr[31:0]
2. Outputs:
   - done
   - error
   - copied_data[31:0]
3. AXI master interface:
   - AW, W, B, AR, R channels
   - 32-bit data
   - single-beat only
4. Behavior:
   - wait for start
   - issue AXI read from src_addr
   - wait for rvalid/rresp
   - latch read data into copied_data
   - issue AXI write to dst_addr with that data
   - wait for bvalid/bresp
   - assert done for one cycle
   - assert error if rresp or bresp is not OKAY
5. Use wstrb=4'hF.
6. Keep the FSM simple and readable.
7. No burst support.
8. No multiple outstanding transactions.

Requirements for tb/simple_dma_copy_tb.sv:
1. Instantiate simple_dma_copy and existing axi_mem_model.
2. Generate clock/reset.
3. Use direct hierarchical initialization of memory if needed to seed source data.
4. Test:
   - copy one word from 0x00 to 0x10
   - copy one word from 0x04 to 0x20
   - verify destination data by reading memory or directly checking memory model contents
   - invalid source address should set error
   - invalid destination address should set error
5. Add timeout guards.
6. Print [PASS]/[FAIL] lines.
7. Print [DONE] only after all checks pass.

Requirements for scripts/run_simple_dma_copy_sim.sh:
1. Run xvlog, xelab, xsim.
2. Save logs under logs/.
3. Fail if [FAIL] or FATAL appears in the xsim log.
4. Print concise pass/fail summary.

Final report must include:
- Files created
- FSM summary
- Number of checks passed
- Whether CI grep gate passed
- Any limitations
```
