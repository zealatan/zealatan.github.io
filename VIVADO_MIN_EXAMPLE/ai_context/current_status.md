# Current Status

## AXI-Lite Register File

Design:
- RTL: rtl/axi_lite_regfile.v
- Testbench: tb/axi_lite_regfile_tb.sv
- Simulation script: scripts/run_axi_regfile_sim.sh

### Implementation

4 × 32-bit registers at byte offsets 0x00, 0x04, 0x08, 0x0C.

Invalid-address detection (addr[31:4] != 0):
- Write path: bresp=SLVERR (2'b10), no register modified — handled in all 3 FSM states (W_IDLE, W_WAIT_W, W_WAIT_A)
- Read path: rresp=SLVERR (2'b10), rdata=0x00000000

### Verification Status (last run: 2026-05-01)

133/133 checks passed. 0 failures. CI gate exit code: 0.

Tests:
- Test 1: reset defaults (8 checks)
- Test 2: write all-ones + bresp/rresp (12 checks)
- Test 3: unique values (12 checks)
- Test 4: write all-zeros (12 checks)
- Test 5: partial WSTRB byte-lane writes (10 checks)
- Test 5b: individual byte-lane isolation (12 checks)
- Test 6: AW-before-W (W_WAIT_W path) (4 checks)
- Test 7: W-before-AW (W_WAIT_A path) (4 checks)
- Test 8: invalid address 0x10 — hard SLVERR checks, no alias (5 checks)
- Test 9: simultaneous AW+W same-cycle (4 checks)
- Test 10: B-channel backpressure (8 checks)
- Test 11: R-channel backpressure (8 checks)
- Test 12: invalid-address sweep W_IDLE path (15 checks)
- Test 13: AW-before-W invalid addresses W_WAIT_W path (9 checks)
- Test 14: W-before-AW invalid addresses W_WAIT_A path (9 checks)

## Legacy and2 Example

- RTL: rtl/and2.v
- Testbench: tb/and2_tb.sv
- Simulation script: scripts/run_vivado_sim.sh
