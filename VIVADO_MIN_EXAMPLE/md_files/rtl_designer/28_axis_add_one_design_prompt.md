Before doing any implementation, save this exact prompt into:

md_files/rtl_designer/28_axis_add_one_design_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/rtl_designer/28_axis_add_one_design_prompt.md
  - ai_context/architecture_spec_axis_add_one.md
  - ai_context/interface_contract_axis_add_one.md
  - rtl/axis_add_one.v
  - ai_context/microarchitecture_report_axis_add_one.md
  - ai_context/verification_handoff_axis_add_one.md
  - ai_context/current_status.md

- Do not modify:
  - tb/
  - scripts/
  - docs/
  - existing verified RTL files
  - existing verification agent files
  - existing RTL designer template files unless absolutely necessary

Goal:
Use RTL Designer Agent Protocol v1 to design a small AXI-Stream DUT called axis_add_one.

This is the first Agent 3 → Agent 4 handoff experiment using the AXI-Stream DUT category.

The goal is not to verify the DUT in this prompt.
The goal is to produce verification-ready RTL and the required handoff artifacts.

Context:
RTL Verification Agent v1 is already closed.
RTL Designer Agent Protocol v1 has been created.
This task should follow:
- ai_context/rtl_designer_core_protocol.md
- ai_context/architecture_spec_template.md
- ai_context/interface_contract_template.md
- ai_context/microarchitecture_report_template.md
- ai_context/verification_handoff_template.md
- ai_context/dut_category_taxonomy.md
- ai_context/dut_profile_axistream_block.md

DUT:
axis_add_one

DUT category:
AXI-Stream block

High-level behavior:
The DUT receives AXI-Stream words on the slave input interface, adds 1 to each input word, and sends the result on the master output interface.

Functional rule:
m_axis_tdata = s_axis_tdata + 1

Requirements for rtl/axis_add_one.v:

1. Module name:
   - axis_add_one

2. Parameters:
   - DATA_WIDTH = 32

3. Ports:
   - input  wire                  aclk
   - input  wire                  aresetn

   AXI-Stream slave input:
   - input  wire [DATA_WIDTH-1:0] s_axis_tdata
   - input  wire                  s_axis_tvalid
   - output wire                  s_axis_tready
   - input  wire                  s_axis_tlast

   AXI-Stream master output:
   - output reg  [DATA_WIDTH-1:0] m_axis_tdata
   - output reg                   m_axis_tvalid
   - input  wire                  m_axis_tready
   - output reg                   m_axis_tlast

4. Behavior:
   - Accept input when s_axis_tvalid && s_axis_tready.
   - Output one word for each accepted input word.
   - Output data equals input data + 1 with natural DATA_WIDTH wraparound.
   - Propagate s_axis_tlast to m_axis_tlast for the corresponding word.
   - Preserve word ordering.
   - Support output backpressure.
   - Do not drop data when m_axis_tready is low.
   - Use a simple one-entry buffer/skid-register style implementation.
   - No packet-level transformation except tlast propagation.
   - No tkeep/tstrb/tuser support in v1.

5. Reset behavior:
   - Active-low asynchronous reset.
   - On reset:
     - m_axis_tvalid = 0
     - m_axis_tdata = 0
     - m_axis_tlast = 0
   - No pending word should remain after reset.

6. Flow-control policy:
   - s_axis_tready should be high when the internal output buffer is empty or when the current output word is being accepted by m_axis_tready.
   - The DUT must support continuous throughput of one word per cycle when both input and output are ready.

7. Implementation constraints:
   - Keep RTL simple and readable.
   - Use registered output signals.
   - No hidden state beyond the one-entry output buffer.
   - No combinational loop between ready/valid.
   - No external dependencies.
   - Do not include testbench code in RTL.

Requirements for ai_context/architecture_spec_axis_add_one.md:

1. Use the architecture spec template structure.
2. Include:
   - DUT name
   - purpose
   - DUT category = AXI-Stream block
   - high-level behavior
   - input/output summary
   - internal one-entry buffer description
   - datapath rule: output = input + 1
   - tlast propagation policy
   - reset policy
   - assumptions
   - known limitations
   - expected verification profile = dut_profile_axistream_block.md

Requirements for ai_context/interface_contract_axis_add_one.md:

1. Use the interface contract template structure.
2. Define:
   - clock/reset
   - AXI-Stream slave interface
   - AXI-Stream master interface
   - tvalid/tready handshake semantics
   - tlast semantics
   - backpressure behavior
   - reset values
   - unsupported signals: tkeep, tstrb, tuser
   - wraparound behavior for DATA_WIDTH overflow

Requirements for ai_context/microarchitecture_report_axis_add_one.md:

1. Use the microarchitecture report template structure.
2. Describe:
   - RTL file path
   - internal valid/data/last registers
   - s_axis_tready generation
   - output register update conditions
   - reset behavior
   - latency
   - throughput
   - known limitations
   - deviations from architecture spec, if any

Requirements for ai_context/verification_handoff_axis_add_one.md:

1. Use the verification handoff template structure.
2. State:
   - DUT category = AXI-Stream block
   - recommended profile = ai_context/dut_profile_axistream_block.md
   - RTL file = rtl/axis_add_one.v

3. Required tests for the Verification Agent:
   - reset defaults
   - single-beat transfer
   - multi-beat packet
   - tlast propagation
   - output backpressure
   - input stall
   - continuous throughput
   - wraparound case: 0xFFFF_FFFF + 1 = 0x0000_0000
   - reset mid-packet
   - random valid packet smoke

4. Suggested scoreboard rule:
   - For every accepted input beat, expected output beat is:
     output_data = input_data + 1
     output_tlast = input_tlast
   - Output order must match input acceptance order.

5. Deferred items:
   - tkeep/tstrb/tuser
   - multi-clock operation
   - formal verification
   - UVM/constrained-random
   - synthesis/timing closure
   - FPGA board validation

Requirements for ai_context/current_status.md:

1. Add a short section:
   "AXI-Stream add-one RTL Design"

2. Mention:
   - architecture spec created
   - interface contract created
   - RTL created
   - microarchitecture report created
   - verification handoff created
   - verification not yet run

Final report must include:
- Files created
- Prompt backup path
- DUT category
- Architecture summary
- Interface summary
- Microarchitecture summary
- Verification handoff summary
- Confirmation that TB/scripts were untouched
- Recommended next step for RTL Verification Agent
