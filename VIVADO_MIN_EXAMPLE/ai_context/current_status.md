# Current Status

This is a minimal Vivado + MCP test project.

Design:
- RTL: rtl/and2.v
- Testbench: tb/and2_tb.sv
- Simulation script: scripts/run_vivado_sim.sh

Goal:
- Check whether Claude Code can read files through MCP.
- Check whether Claude Code can run Vivado xsim.
- Check whether Claude Code can analyze simulation logs.

Expected behavior:
- y = a & b
- All 4 input combinations should pass.
