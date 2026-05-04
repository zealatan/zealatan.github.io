Before doing any implementation, save this exact prompt into:

md_files/verification_agent/32_axis_complex_mult_verification_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/verification_agent/32_axis_complex_mult_verification_prompt.md
  - tb/axis_complex_mult_tb.sv
  - scripts/run_axis_complex_mult_sim.sh
  - ai_context/verification_matrix_axis_complex_mult.md
  - ai_context/final_verification_summary_axis_complex_mult.md
  - ai_context/current_status.md

- You may read:
  - ai_context/verification_handoff_axis_complex_mult.md
  - ai_context/interface_contract_axis_complex_mult.md
  - ai_context/architecture_spec_axis_complex_mult.md
  - ai_context/microarchitecture_report_axis_complex_mult.md
  - ai_context/dut_profile_axistream_block.md
  - ai_context/dut_profile_dsp_pipeline.md
  - rtl/axis_complex_mult.v

- Do not modify:
  - rtl/axis_complex_mult.v
  - any other RTL file
  - existing verified RTL/TB/script files
  - RTL Designer Agent documents unless the verification discovers a real contract ambiguity

Goal:
Verify the AXI-Stream + DSP DUT axis_complex_mult using the RTL Verification Agent Protocol, the AXI-Stream DUT profile, and the DSP pipeline profile.

DUT:
- rtl/axis_complex_mult.v

DUT category:
- Primary: CAT-4 AXI-Stream Processing Block
- Secondary: CAT-5 DSP Pipeline

Verification profiles:
- ai_context/dut_profile_axistream_block.md
- ai_context/dut_profile_dsp_pipeline.md

Handoff:
- ai_context/verification_handoff_axis_complex_mult.md

Expected behavior:
For every accepted A/B input pair:

  a_real = signed16(s_axis_a_tdata[31:16])
  a_imag = signed16(s_axis_a_tdata[15:0])
  b_real = signed16(s_axis_b_tdata[31:16])
  b_imag = signed16(s_axis_b_tdata[15:0])

  full_real = a_real*b_real - a_imag*b_imag
  full_imag = a_real*b_imag + a_imag*b_real

  out_real = signed16(full_real >>> 15)
  out_imag = signed16(full_imag >>> 15)

  expected_output_tdata = {out_real[15:0], out_imag[15:0]}
  expected_output_tlast = accepted_a_tlast | accepted_b_tlast

Output order must match accepted A/B pair order.

Requirements for tb/axis_complex_mult_tb.sv:

1. Instantiate axis_complex_mult with:
   - DATA_WIDTH = 32
   - COMPONENT_WIDTH = 16
   - SHIFT = 15

2. Generate:
   - aclk
   - active-low asynchronous reset aresetn

3. Use self-checking SystemVerilog testbench style.

4. Use [PASS]/[FAIL] log format.

5. Use $fatal on hard failures.

6. Add timeout guards to every wait loop.

7. Use AXI-Stream TB timing rules learned from axis_add_one:
   - drive all AXI-Stream inputs and m_axis_tready on negedge
   - sample DUT outputs on posedge
   - avoid same-edge TB/DUT races
   - avoid unsafe batch-then-drain patterns for low-latency DUTs

8. Implement helper functions/tasks:
   - pack_complex(real16, imag16)
   - signed16 extraction
   - golden_complex_mult(a_data, b_data)
   - send_pair(a_data, a_last, b_data, b_last)
   - expect_output(expected_data, expected_last)
   - send_pair_and_expect(...)
   - optional output backpressure helper

9. Use a scoreboard rule:
   - Push expected output when an A/B input pair is accepted.
   - Pop/check expected output when output beat is accepted.
   - expected data computed by golden_complex_mult.
   - expected tlast = a_last | b_last.
   - Preserve ordering.

10. Tests to implement:

   Test 1 — reset defaults:
   - after reset, verify m_axis_tvalid=0
   - verify m_axis_tdata=0
   - verify m_axis_tlast=0

   Test 2 — single A/B pair transfer:
   - use a simple known vector
   - verify output data and tlast

   Test 3 — worked handoff vectors:
   - include the worked examples from verification_handoff_axis_complex_mult.md if present
   - verify exact expected results

   Test 4 — multi-pair packet:
   - send several A/B pairs
   - use different tlast positions
   - verify output order and tlast OR policy

   Test 5 — continuous throughput:
   - keep both input streams valid and output ready
   - verify one accepted pair per cycle when ready
   - verify output sequence

   Test 6 — output backpressure:
   - deassert m_axis_tready while m_axis_tvalid=1
   - verify m_axis_tvalid remains high
   - verify m_axis_tdata remains stable
   - verify m_axis_tlast remains stable
   - reassert m_axis_tready and verify transfer completes

   Test 7 — A-valid-only stall:
   - assert A valid while B valid is low
   - verify no pair is accepted
   - verify no output is generated
   - then assert B valid and verify correct output

   Test 8 — B-valid-only stall:
   - assert B valid while A valid is low
   - verify no pair is accepted
   - verify no output is generated
   - then assert A valid and verify correct output

   Test 9 — zero input:
   - one or both inputs zero
   - verify output zero

   Test 10 — identity-like multiply:
   - multiply by approximately 1.0 using Q1.15 value 0x7FFF + j0
   - document expected quantization behavior
   - verify against golden model, not ideal real-number math

   Test 11 — negative values:
   - include signed negative real/imag components
   - verify golden result

   Test 12 — overflow/truncation/wrap behavior:
   - use large positive/negative components
   - verify exact 16-bit wrapped/truncated output from golden model

   Test 13 — TLAST propagation:
   - test A_last only
   - test B_last only
   - test both last
   - verify output_tlast = A_last | B_last

   Test 14 — reset mid-packet:
   - send one or more pairs
   - assert reset before all expected outputs are consumed
   - verify output valid clears
   - after reset, send a fresh pair/packet
   - verify no stale output appears

   Test 15 — deterministic random valid-pair smoke:
   - use fixed seed
   - run several small packets or at least 20 random A/B pairs
   - include occasional A-only stalls, B-only stalls, and output ready stalls if practical
   - verify all outputs with the golden model scoreboard

11. Keep the testbench simple and readable.

12. Do not use UVM.

13. Do not use a constrained-random framework.

Requirements for scripts/run_axis_complex_mult_sim.sh:

1. Run:
   - xvlog
   - xelab
   - xsim

2. Save logs under logs/.

3. Use an explicit simulation timescale if needed, for example:
   -timescale 1ns/1ps

4. Fail if [FAIL] or FATAL appears in the xsim log.

5. Print concise pass/fail summary.

Requirements for ai_context/verification_matrix_axis_complex_mult.md:

1. Create a matrix mapping:
   - requirement
   - test ID
   - evidence
   - status

2. Mark all implemented tests as PASS only if simulation passes.

Requirements for ai_context/final_verification_summary_axis_complex_mult.md:

1. Summarize:
   - DUT
   - category
   - profiles
   - tests run
   - pass count
   - CI gate result
   - RTL bugs found, if any
   - contract ambiguities found, if any
   - remaining limitations
   - deferred items

2. Mention that this is the second Agent 3 → Agent 4 handoff experiment and the first combined AXI-Stream + DSP pipeline DUT.

Run:

source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_axis_complex_mult_sim.sh

If compile or simulation fails:
- inspect the first relevant error
- classify as TB bug, RTL bug, script bug, or contract ambiguity
- do not modify RTL unless clearly necessary and explicitly report why
- prefer TB/script fixes if the RTL matches the handoff contract

Final report must include:
- Files created/changed
- Prompt backup path
- DUT category/profiles
- Tests added
- Number of checks passed
- Whether CI grep gate passed
- Whether Agent 3 → Agent 4 handoff succeeded
- Whether AXI-Stream + DSP profile combination succeeded
- Any RTL bugs or contract ambiguities found
- Remaining limitations
