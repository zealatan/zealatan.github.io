# 00. AXI-lite Invalid Address Patch Prompt

```text
Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may modify only:
  - rtl/axi_lite_regfile.v
  - tb/axi_lite_regfile_tb.sv
  - ai_context/current_status.md
- Do not modify scripts unless necessary.
- Do not touch rtl/and2.v or tb/and2_tb.sv.

Goal:
Patch the AXI-lite register file so that invalid addresses return SLVERR instead of silently aliasing to reg[0].

Requirements:
1. Valid register addresses are:
   - 0x00
   - 0x04
   - 0x08
   - 0x0C

2. Any address with addr[31:4] != 0 must be treated as invalid.

3. Invalid write behavior:
   - return bresp = 2'b10
   - do not modify any register

4. Invalid read behavior:
   - return rresp = 2'b10
   - return rdata = 32'h00000000

5. Update tb/axi_lite_regfile_tb.sv Test 8:
   - replace soft RTL-limitation checks with hard checks
   - verify invalid write does not modify reg[0]
   - expect bresp/rresp = 2'b10 for address 0x10

6. Keep the existing negedge-drive / posedge-sample testbench style.

7. Keep all timeout guards.

8. Run scripts/run_axi_regfile_sim.sh.

Final report must include:
- Files changed
- Exact RTL change summary
- Exact TB change summary
- Number of checks passed
- Whether the CI grep gate passed
- Any remaining failures
```
