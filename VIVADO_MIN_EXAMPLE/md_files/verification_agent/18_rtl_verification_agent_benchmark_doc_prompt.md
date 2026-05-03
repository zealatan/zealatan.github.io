Before doing any implementation, save this exact prompt into:

md_files/18_rtl_verification_agent_benchmark_doc_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/18_rtl_verification_agent_benchmark_doc_prompt.md
  - docs/rtl_verification_agent_benchmark.md
  - docs/rtl_verification_workflow_summary.md
  - README.md
  - ai_context/current_status.md

- Do not modify any RTL, testbench, or simulation script files.

- Do not modify:
  - rtl/
  - tb/
  - scripts/

Goal:
Document the current project as an RTL Verification Agent benchmark and AI-assisted verification workflow case study.

This documentation should summarize what has been built, what has been verified, and how this fits into a future multi-agent hardware development orchestrator.

Context:
The long-term orchestrator architecture is expected to have these agents:

1. Algorithm Agent
2. Python Modeling Agent
3. RTL Design Agent
4. RTL Verification Agent
5. FPGA Test Agent

This project is currently focused on building and validating Agent 4: the RTL Verification Agent.

Requirements for docs/rtl_verification_agent_benchmark.md:

1. Title:
   RTL Verification Agent Benchmark — Mini AXI/DMA Verification Stack

2. Explain the purpose:
   - This is not primarily a production RTL design.
   - It is a benchmark suite for testing whether an AI agent can perform RTL verification tasks.
   - The DUTs are intentionally small but incrementally structured.

3. Include the current verified layers:

   - AXI-lite register file: 133/133 PASS
   - AXI4 memory model: 30/30 PASS
   - Simple AXI4 master: 14/14 PASS
   - 1-word DMA copy engine: 16/16 PASS
   - N-word DMA copy engine: 31/31 PASS
   - AXI-lite controlled DMA copy wrapper: 208/208 PASS, plus extended control-plane tests up to 208+ if current_status includes more
   - N-word DMA add/processing engine: 81/81 PASS
   - AXI-lite controlled DMA add accelerator: 151/151 PASS

   Use the exact latest numbers from ai_context/current_status.md if they differ.

4. For each layer, summarize:
   - Files
   - Purpose
   - Main verification features
   - Check count
   - Remaining limitations

5. Explain the verification patterns used:
   - negedge-drive / posedge-sample
   - timeout guards
   - [PASS]/[FAIL] log format
   - CI grep gate for [FAIL] or FATAL
   - prompt backup into md_files/
   - current_status.md as persistent project memory
   - approval gate before RTL modification
   - targeted coverage-gap closure

6. Explain what the RTL Verification Agent is expected to do:
   - read context
   - inspect allowed files only
   - create/update testbenches
   - create/update simulation scripts
   - run Vivado xsim
   - detect failures
   - distinguish TB bug vs RTL bug
   - patch TB/scripts automatically when allowed
   - request approval before RTL changes
   - update current_status.md
   - save prompt history

7. Include a section:
   "Why this benchmark matters"

   Mention:
   - It tests the AI agent's ability to operate in a realistic simulation-feedback loop.
   - It gradually increases complexity from AXI-lite to DMA and processing DMA.
   - It prepares the foundation for future OFDM/DSP accelerator verification.
   - It can later be extended to FPGA board testing, UART logs, DMA buffers, ILA captures, and RF front-end experiments.

8. Include a section:
   "Not yet covered"

   Mention:
   - formal verification
   - randomized regression
   - functional coverage metrics
   - full AXI4 burst support
   - board-level FPGA execution
   - RF/OFDM experiment automation

Requirements for docs/rtl_verification_workflow_summary.md:

1. Keep this file shorter than the benchmark document.

2. Summarize the workflow in a compact way:

   Human prompt / policy
     ↓
   Claude Code RTL Verification Agent
     ↓
   RTL/TB/script modification
     ↓
   Vivado xsim
     ↓
   log parsing
     ↓
   patch / rerun / status update

3. Include a compact table of completed layers and pass counts.

4. Include a short section on the future multi-agent orchestrator:

   Algorithm Agent
   Python Modeling Agent
   RTL Design Agent
   RTL Verification Agent
   FPGA Test Agent

5. Clearly state:
   This project is currently building the RTL Verification Agent component.

Requirements for README.md:

1. Keep README.md concise.
2. Add or update a section:
   "AI-assisted RTL Verification Benchmark"
3. Link to:
   - docs/rtl_verification_agent_benchmark.md
   - docs/rtl_verification_workflow_summary.md
4. Include a compact current status table.
5. Do not make README.md too long.

Requirements for ai_context/current_status.md:

1. Only update if needed.
2. Do not rewrite it completely unless necessary.
3. Add a short documentation status section mentioning the new docs.

Final report must include:
- Files created/changed
- Prompt backup path
- Summary of documentation added
- Whether any RTL/TB/scripts were left untouched
- Any recommended next documentation or verification step
