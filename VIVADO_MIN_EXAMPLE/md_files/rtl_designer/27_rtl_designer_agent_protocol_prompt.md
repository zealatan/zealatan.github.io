Before doing any implementation, save this exact prompt into:

md_files/rtl_designer/27_rtl_designer_agent_protocol_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/rtl_designer/27_rtl_designer_agent_protocol_prompt.md
  - ai_context/rtl_designer_core_protocol.md
  - ai_context/architecture_spec_template.md
  - ai_context/interface_contract_template.md
  - ai_context/microarchitecture_report_template.md
  - ai_context/verification_handoff_template.md
  - ai_context/current_status.md

- You may create the directory:
  - md_files/rtl_designer/

- Do not modify:
  - rtl/
  - tb/
  - scripts/
  - docs/
  - md_files/verification_agent/
  - existing verified RTL/TB/script files
  - existing verification agent profile files unless absolutely necessary

Goal:
Create RTL Designer Agent Protocol v1 and the design-to-verification handoff templates.

Context:
RTL Verification Agent v1 is already closed and documented.
The next goal is to define Agent 3: RTL Designer Agent.

Long-term orchestrator agents:
1. Algorithm Agent
2. Python Modeling Agent
3. RTL Designer Agent
4. RTL Verification Agent
5. FPGA Test Agent

This task focuses on Agent 3 and the handoff from Agent 3 to Agent 4.

Requirements for ai_context/rtl_designer_core_protocol.md:

1. Define the purpose of the RTL Designer Agent.

2. Clearly state:
   - RTL Designer Agent is responsible for producing verification-ready RTL.
   - It must not only write Verilog/SystemVerilog code.
   - It must also provide design intent, interface contract, reset behavior, error behavior, assumptions, and verification handoff notes.

3. Define the common RTL design workflow:
   - read CLAUDE.md and current_status.md first
   - save prompt into md_files/rtl_designer/
   - read relevant design requirements
   - classify target DUT category using dut_category_taxonomy.md
   - select or reference appropriate DUT profile
   - create architecture specification before RTL
   - create interface contract before RTL
   - create microarchitecture report after RTL
   - create verification handoff document after RTL
   - do not modify verification files unless explicitly requested
   - preserve previously verified RTL unless explicitly allowed

4. Define mandatory design artifacts:
   - architecture_spec.md
   - interface_contract.md
   - microarchitecture_report.md
   - verification_handoff.md
   - RTL source file
   - optional block diagram text/ASCII diagram

5. Define design quality requirements:
   - simple readable FSMs
   - explicit reset behavior
   - registered outputs unless documented otherwise
   - clear valid/ready or AXI behavior
   - no hidden side effects
   - no ambiguous start/done behavior
   - no unexplained magic constants
   - no interface changes after handoff unless documented
   - parameterization only when useful

6. Define RTL modification policy:
   - Designer Agent may create new RTL files within scope.
   - Designer Agent must not rewrite previously verified RTL unless explicitly authorized.
   - If a verification failure is reported, Designer Agent should make minimal targeted patches.
   - Designer Agent must update microarchitecture_report.md after RTL changes.

7. Define interaction with RTL Verification Agent:
   - Designer Agent outputs verification_handoff.md.
   - Verification Agent reads verification_handoff.md.
   - Verification Agent classifies DUT category/profile.
   - Verification Agent creates verification matrix and testbench.
   - If RTL bug is found, Verification Agent returns a bug report.
   - Designer Agent patches RTL only after approval.

8. Define final report format:
   - files created/changed
   - prompt backup path
   - DUT category
   - architecture summary
   - interface summary
   - FSM/datapath summary
   - assumptions
   - verification handoff summary
   - known design limitations

Requirements for ai_context/architecture_spec_template.md:

1. Create a reusable template with sections:
   - DUT name
   - Purpose
   - DUT category
   - High-level behavior
   - Inputs/outputs summary
   - Internal blocks
   - State machine overview
   - Datapath overview
   - Configuration/registers if applicable
   - Error policy
   - Reset policy
   - Assumptions
   - Known limitations
   - Expected verification profile

2. Keep it concise but complete.

Requirements for ai_context/interface_contract_template.md:

1. Create a reusable template with sections:
   - Clock/reset
   - Input ports
   - Output ports
   - AXI-lite interface if applicable
   - AXI master interface if applicable
   - AXI-stream interface if applicable
   - valid/ready semantics
   - timing assumptions
   - reset values
   - error/response behavior
   - unsupported behavior

2. Include notes that this file is the contract used by the Verification Agent.

Requirements for ai_context/microarchitecture_report_template.md:

1. Create a reusable template with sections:
   - Implemented RTL file
   - FSM states
   - Datapath registers
   - Control registers
   - Output behavior
   - Reset behavior
   - Error handling
   - Latency
   - Resource/complexity notes
   - Deviations from architecture_spec.md
   - Known limitations

Requirements for ai_context/verification_handoff_template.md:

1. Create a reusable template with sections:
   - DUT name
   - RTL file path
   - DUT category
   - Recommended verification profile
   - Required tests
   - Expected normal behavior
   - Expected error behavior
   - Reset behavior to verify
   - Corner cases to verify
   - Suggested scoreboard rule
   - Suggested evidence
   - Deferred verification items

2. Include a clear note:
   This document is the primary handoff from RTL Designer Agent to RTL Verification Agent.

Requirements for ai_context/current_status.md:

1. Add a short section:
   "RTL Designer Agent Protocol"

2. Mention the created files.

3. State that these documents define Agent 3 and the Agent 3 → Agent 4 handoff.

Final report must include:
- Files created
- Prompt backup path
- Summary of each document
- Confirmation that RTL/TB/scripts were untouched
- Confirmation that md_files/rtl_designer/ was used for prompt backup
- Recommended next step
