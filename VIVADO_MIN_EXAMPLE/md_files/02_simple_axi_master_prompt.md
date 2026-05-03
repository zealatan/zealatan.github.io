# 02. Simple AXI Master Prompt

```text
Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - rtl/simple_axi_master.v
  - tb/simple_axi_master_tb.sv
  - scripts/run_simple_axi_master_sim.sh
  - ai_context/current_status.md
- You may instantiate the existing tb/axi_mem_model.sv.
- Do not modify:
  - tb/axi_mem_model.sv
  - tb/mem_rw_tb.sv
  - rtl/axi_lite_regfile.v
  - tb/axi_lite_regfile_tb.sv

Goal:
Create a minimal RTL AXI master that writes one 32-bit word to memory, reads it back, and reports done/error.

Requirements for rtl/simple_axi_master.v:
1. Inputs:
   - aclk
   - aresetn
   - start
   - addr[31:0]
   - write_data[31:0]
2. Outputs:
   - read_data[31:0]
   - done
   - error
3. AXI master interface:
   - AW, W, B, AR, R channels
   - 32-bit data
   - single-beat only
4. Behavior:
   - wait for start
   - issue write address/data
   - wait for bresp
   - issue read address
   - wait for rdata/rresp
   - compare read_data with write_data
   - assert done
   - assert error if bresp/rresp is not OKAY or data mismatch
5. Keep FSM simple and readable.
6. No burst support.

Requirements for tb/simple_axi_master_tb.sv:
1. Instantiate simple_axi_master and existing axi_mem_model.
2. Generate clock/reset.
3. Test:
   - one normal write/readback transaction
   - multiple start transactions with different addresses/data
   - optional invalid address case if simple_axi_master supports error output
4. Add timeout guards.
5. Print [PASS]/[FAIL] lines.
6. Print [DONE] only after all checks pass.

Requirements for scripts/run_simple_axi_master_sim.sh:
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
