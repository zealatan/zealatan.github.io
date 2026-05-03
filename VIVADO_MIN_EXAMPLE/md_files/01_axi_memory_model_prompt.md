# 01. AXI Memory Model Prompt

```text
Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - tb/axi_mem_model.sv
  - tb/mem_rw_tb.sv
  - scripts/run_mem_rw_sim.sh
  - ai_context/current_status.md
- Do not modify existing RTL.
- Do not touch rtl/axi_lite_regfile.v or tb/axi_lite_regfile_tb.sv.

Goal:
Create a minimal reusable AXI4 memory model and a standalone memory read/write testbench.

Requirements for tb/axi_mem_model.sv:
1. Implement a simple AXI4 slave memory model.
2. Support 32-bit data width.
3. Support write address, write data, write response, read address, and read data channels.
4. Support byte write strobes.
5. Support single-beat transactions first.
6. Use OKAY response for valid accesses.
7. Add simple address range checking if practical.
8. Keep the code simple and readable.

Requirements for tb/mem_rw_tb.sv:
1. Instantiate axi_mem_model.
2. Generate clock/reset.
3. Implement AXI master tasks:
   - axi_write32(addr, data, strb)
   - axi_read32(addr, data)
4. Test:
   - full word write/readback
   - multiple addresses
   - byte-lane WSTRB writes
   - read default zero from unwritten address
5. Add timeout guards to every wait loop.
6. Use negedge-drive / posedge-sample style.
7. Print [PASS]/[FAIL] lines.
8. Print [DONE] only after all checks pass.

Requirements for scripts/run_mem_rw_sim.sh:
1. Run xvlog, xelab, xsim.
2. Save logs under logs/.
3. Fail if [FAIL] or FATAL appears in the xsim log.
4. Print a concise pass/fail summary.

Final report must include:
- Files created
- Number of checks passed
- Whether the CI grep gate passed
- Any limitations of the memory model
```
