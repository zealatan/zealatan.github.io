Before doing any implementation, save this exact prompt into:

md_files/26_verification_agent_core_and_dut_profiles_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/26_verification_agent_core_and_dut_profiles_prompt.md
  - ai_context/verification_agent_core_protocol.md
  - ai_context/dut_category_taxonomy.md
  - ai_context/dut_profile_axil_dma_accelerator.md
  - ai_context/dut_profile_axistream_block.md
  - ai_context/dut_profile_dsp_pipeline.md
  - ai_context/dut_profile_cdc_fifo.md
  - ai_context/current_status.md

- Do not modify:
  - rtl/
  - tb/
  - scripts/
  - docs/
  - any existing verified RTL/TB/script files

Goal:
Create the reusable RTL Verification Agent Core Protocol and DUT category profiles.

Context:
Verification Phase v1 is closed for the Mini AXI/DMA/Processing Accelerator benchmark.
The next goal is to generalize the verified process into a reusable protocol that can be applied to future DUT categories.

Long-term orchestrator agents:
1. Algorithm Agent
2. Python Modeling Agent
3. RTL Design Agent
4. RTL Verification Agent
5. FPGA Test Agent

This task focuses on Agent 4: RTL Verification Agent.

Requirements for ai_context/verification_agent_core_protocol.md:

1. Define the purpose of the RTL Verification Agent Core Protocol.

2. Clearly state:
   - This is not a UVM replacement.
   - This is a lightweight AI-assisted RTL verification protocol.
   - It is intended for self-checking SystemVerilog testbenches, simulation scripts, evidence collection, and closure documentation.

3. Include the common workflow:
   - read CLAUDE.md and current_status.md first
   - save prompt into md_files/
   - identify DUT category/profile
   - inspect only allowed files
   - create or update testbench
   - create or update simulation script
   - run Vivado xsim
   - inspect logs
   - classify failure as TB bug, RTL bug, script bug, or requirement ambiguity
   - patch only allowed files
   - request approval before RTL modification unless explicitly authorized
   - update current_status.md
   - update verification_matrix.md if applicable
   - update known_limitations.md if applicable
   - produce final report

4. Define mandatory verification mechanics:
   - self-checking testbench
   - [PASS]/[FAIL] log format
   - $fatal on hard failure
   - timeout guards on all wait loops
   - CI grep gate for [FAIL] and FATAL
   - deterministic/reproducible tests
   - prompt backup
   - evidence-based closure

5. Define common closure requirements:
   - all tests pass
   - CI gate clean
   - design contract exists
   - verification matrix exists
   - known limitations documented
   - closure criteria documented
   - final summary exists
   - deferred items explicitly listed

6. Define modification policy:
   - TB/scripts/docs may be modified within scope
   - RTL modification requires approval unless explicitly permitted
   - never rewrite verified files unnecessarily
   - preserve previous passing tests

7. Define failure classification:
   - TB bug
   - RTL bug
   - script/tool setup bug
   - design contract ambiguity
   - environment issue
   - out-of-scope limitation

8. Define final report format:
   - files changed
   - prompt backup path
   - tests added
   - check count
   - CI gate status
   - coverage closed
   - remaining limitations
   - recommended next step

Requirements for ai_context/dut_category_taxonomy.md:

1. Define why DUT categorization is necessary.

2. State:
   - The agent is not fully DUT-agnostic.
   - It is contract-driven.
   - A new DUT requires a DUT category and verification profile.

3. Include at least these categories:
   - AXI-lite peripheral
   - AXI master / DMA
   - AXI-lite controlled DMA accelerator
   - AXI-stream block
   - DSP pipeline
   - CDC / FIFO block
   - OFDM / communications block
   - FPGA board-level test target

4. For each category, summarize:
   - typical interface
   - typical expected behavior
   - required contract items
   - mandatory tests
   - common hazards
   - likely deferred items

5. Include a short decision tree:
   - Is it memory-mapped?
   - Does it initiate AXI transactions?
   - Is it stream-based?
   - Is there a golden model?
   - Is there more than one clock?
   - Is board-level evidence required?

Requirements for ai_context/dut_profile_axil_dma_accelerator.md:

1. Define this as the profile validated by the current benchmark.

2. Include applicable DUTs:
   - AXI-lite controlled DMA
   - memory-mapped processing accelerator
   - DMA add engine
   - future FIR/CFO/complex multiply accelerator

3. Include required contract fields:
   - register map
   - CONTROL/STATUS policy
   - start/done/error/busy behavior
   - source/destination/length semantics
   - processing operation
   - count semantics
   - reset behavior
   - error behavior
   - restart behavior

4. Include mandatory tests:
   - register read/write
   - invalid address SLVERR
   - normal transfer
   - identity mode if applicable
   - overflow/wrap if applicable
   - zero-length
   - invalid source
   - invalid destination
   - busy-state read
   - re-trigger guard
   - restart-after-error
   - reset during transfer
   - repeated normal restart
   - lightweight random valid-transfer smoke
   - AXI-lite AW/W ordering
   - B-channel backpressure
   - R-channel backpressure

5. Include closure evidence:
   - simulation log
   - check count
   - current_status entry
   - verification matrix entry
   - known limitations

Requirements for ai_context/dut_profile_axistream_block.md:

1. Define the profile for AXI-Stream processing blocks.

2. Include required contract fields:
   - tdata width
   - tvalid/tready behavior
   - tlast policy
   - tkeep/tstrb/tuser if used
   - packet/frame boundary
   - latency policy
   - backpressure policy
   - drop/overflow behavior

3. Include mandatory tests:
   - single beat
   - multi-beat packet
   - tlast correctness
   - input backpressure
   - output backpressure
   - random stall
   - packet boundary preservation
   - reset mid-packet
   - invalid/empty packet if applicable

4. Mention need for scoreboard and optional golden model.

Requirements for ai_context/dut_profile_dsp_pipeline.md:

1. Define the profile for DSP/math pipeline DUTs.

2. Include required contract fields:
   - input/output format
   - fixed-point format
   - rounding/saturation policy
   - latency
   - valid/ready or enable behavior
   - frame length
   - coefficient/config behavior
   - reset behavior
   - acceptable numerical error tolerance

3. Include mandatory tests:
   - golden vector comparison
   - impulse input
   - all-zero input
   - max/min values
   - overflow/saturation
   - random vector smoke
   - latency alignment
   - reset during frame
   - coefficient/config update behavior

4. Mention Python Modeling Agent handoff:
   - golden_model.py
   - test_vectors/
   - expected_outputs/
   - tolerance specification

Requirements for ai_context/dut_profile_cdc_fifo.md:

1. Define the profile for FIFO and clock-domain crossing DUTs.

2. Include required contract fields:
   - write clock/read clock
   - reset policy
   - depth
   - data width
   - full/empty behavior
   - almost full/empty if applicable
   - overflow/underflow policy
   - ordering guarantee
   - reset crossing assumptions

3. Include mandatory tests:
   - same-clock smoke if applicable
   - different clock ratios
   - write faster than read
   - read faster than write
   - full condition
   - empty condition
   - pointer wrap
   - reset during non-empty FIFO
   - overflow/underflow attempt behavior

4. State that formal/SVA may be recommended or required for serious CDC confidence.

Requirements for ai_context/current_status.md:

1. Add a short section:
   "Verification Agent Protocol and DUT Profiles"

2. Mention the created files.

3. State that these documents generalize Verification Phase v1 into reusable profiles.

Final report must include:
- Files created
- Prompt backup path
- Summary of each document
- Confirmation that RTL/TB/scripts were untouched
- Recommended next step
