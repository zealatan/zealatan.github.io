Before doing any implementation, save this exact prompt into:

md_files/verification_agent/29_axis_add_one_verification_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/verification_agent/29_axis_add_one_verification_prompt.md
  - tb/axis_add_one_tb.sv
  - scripts/run_axis_add_one_sim.sh
  - ai_context/verification_matrix_axis_add_one.md
  - ai_context/final_verification_summary_axis_add_one.md
  - ai_context/current_status.md

- You may read:
  - ai_context/verification_handoff_axis_add_one.md
  - ai_context/interface_contract_axis_add_one.md
  - ai_context/architecture_spec_axis_add_one.md
  - ai_context/microarch_report_axis_add_one.md
  - ai_context/dut_profile_axistream_block.md
  - rtl/axis_add_one.v

- Do not modify:
  - rtl/axis_add_one.v
  - any other RTL file
  - existing verified RTL/TB/script files
  - RTL Designer Agent documents unless the verification discovers a real contract ambiguity

Goal:
Verify the AXI-Stream DUT axis_add_one using the RTL Verification Agent Protocol and the AXI-Stream DUT profile.

DUT:
- rtl/axis_add_one.v

DUT category:
- AXI-Stream block

Verification profile:
- ai_context/dut_profile_axistream_block.md

Handoff:
- ai_context/verification_handoff_axis_add_one.md

Expected behavior:
For every accepted input beat:

  expected_output_tdata = input_tdata + 1 mod 2^DATA_WIDTH
  expected_output_tlast = input_tlast

Output order must match input acceptance order.

Requirements for tb/axis_add_one_tb.sv:

1. Instantiate axis_add_one with DATA_WIDTH=32.

2. Generate:
   - aclk
   - active-low asynchronous reset aresetn

3. Use self-checking SystemVerilog testbench style.

4. Use [PASS]/[FAIL] log format.

5. Use $fatal on hard failures.

6. Add timeout guards to every wait loop.

7. Implement AXI-Stream driver/monitor tasks:
   - send_beat(data, last)
   - send_packet(data_array, last_index)
   - expect_beat(expected_data, expected_last)
   - optionally send/expect with output backpressure

8. Use a scoreboard rule:
   - accepted input beats are pushed into expected queue
   - output beats are compared against expected queue in order
   - expected data = input data + 1
   - expected tlast = input tlast

9. Tests to implement:

   Test 1 — reset defaults:
   - after reset, verify m_axis_tvalid=0
   - verify m_axis_tdata=0
   - verify m_axis_tlast=0

   Test 2 — single-beat transfer:
   - send one beat with tlast=1
   - expect data+1 and tlast=1

   Test 3 — multi-beat packet:
   - send 4 beats
   - only final beat has tlast=1
   - verify all output data and final tlast

   Test 4 — continuous throughput:
   - keep s_axis_tvalid=1 and m_axis_tready=1
   - send several consecutive beats
   - verify one output per cycle after pipeline latency

   Test 5 — output backpressure:
   - deassert m_axis_tready while output valid is asserted
   - verify m_axis_tvalid remains high
   - verify m_axis_tdata remains stable
   - verify m_axis_tlast remains stable
   - reassert m_axis_tready and verify transfer completes

   Test 6 — input stall:
   - insert idle cycles between input beats
   - verify output order and correctness

   Test 7 — wraparound:
   - input 0xFFFF_FFFF
   - expect 0x0000_0000

   Test 8 — tlast propagation:
   - send packets with different tlast positions
   - verify tlast is preserved beat-by-beat

   Test 9 — reset mid-packet:
   - send part of a packet
   - assert reset before all expected outputs are consumed
   - verify output valid clears
   - after reset, send a fresh packet
   - verify no stale output appears

   Test 10 — lightweight random valid packet smoke:
   - use fixed seed
   - run several small packets, for example 10 packets with length 1 to 8
   - use deterministic pseudo-random data
   - apply occasional input idle cycles and output ready stalls
   - verify all outputs with scoreboard

10. Keep the testbench simple and readable.

11. Do not use UVM.

12. Do not use constrained-random framework.

Requirements for scripts/run_axis_add_one_sim.sh:

1. Run:
   - xvlog
   - xelab
   - xsim

2. Save logs under logs/.

3. Fail if [FAIL] or FATAL appears in the xsim log.

4. Print concise pass/fail summary.

Requirements for ai_context/verification_matrix_axis_add_one.md:

1. Create a matrix mapping:
   - requirement
   - test ID
   - evidence
   - status

2. Mark all implemented tests as PASS only if simulation passes.

Requirements for ai_context/final_verification_summary_axis_add_one.md:

1. Summarize:
   - DUT
   - category
   - profile
   - tests run
   - pass count
   - CI gate result
   - remaining limitations
   - deferred items

2. Mention that this is the first Agent 3 → Agent 4 handoff experiment using an AXI-Stream DUT.

Run:

source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_axis_add_one_sim.sh

If compile or simulation fails:
- inspect the first relevant error
- classify as TB bug, RTL bug, script bug, or contract ambiguity
- do not modify RTL unless clearly necessary and explicitly report why
- prefer TB/script fixes if the RTL matches the handoff contract

Final report must include:
- Files created/changed
- Prompt backup path
- DUT category/profile
- Tests added
- Number of checks passed
- Whether CI grep gate passed
- Whether Agent 3 → Agent 4 handoff succeeded
- Any RTL bugs or contract ambiguities found
- Remaining limitations
