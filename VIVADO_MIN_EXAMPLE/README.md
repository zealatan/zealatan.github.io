# AI-assisted RTL/FPGA Verification Workflow Experiment

## 1. Overview

This document summarizes a small but meaningful experiment using **Claude Code Pro** as an AI-assisted verification agent for a minimal Vivado/RTL project.

The goal was not only to generate code, but to test whether an AI coding agent can participate in a realistic hardware verification loop:

```text
Spec → Code Generation → Simulation → Failure Detection → Debugging → Patch → Re-run → Pass Summary
```

The experiment was performed on the project:

```text
/home/zealatan/AI_ORC/messi/VIVADO_MIN_EXAMPLE
```

Initial project state:

```text
rtl/and2.v
tb/and2_tb.sv
scripts/run_vivado_sim.sh
CLAUDE.md
ai_context/current_status.md
```

The original DUT was a simple combinational AND gate. The experiment extended the project with a minimal AXI-lite register-file example.

---

## 2. Tool Setup

### 2.1 Claude Code Pro

Claude Code was launched from the project directory:

```bash
cd /home/zealatan/AI_ORC/messi/VIVADO_MIN_EXAMPLE
claude
```

Claude Code status showed:

```text
Claude Code v2.1.121
Model: Sonnet 4.6
Login method: Claude Pro account
```

Usage status showed that the current session had used only a small percentage of the available session budget.

Key observation:

```text
Claude Code Pro does not expose a fixed monthly token quota.
It uses a usage/session limit model.
```

---

### 2.2 MCP Usage

MCP was connected, but the key insight was:

```text
MCP is not the agent.
MCP is a tool/server interface used by Claude Code.
```

Current conceptual structure:

```text
Human prompt
  ↓
Claude Code agent
  ↓
Tools:
  - Read
  - Write
  - Bash
  - Monitor
  - MCP filesystem
```

Therefore, the current workflow can be described as:

```text
MCP-enabled Claude Code workflow
```

However, the same local RTL/TB/script workflow is mostly possible with Claude Code CLI alone. MCP becomes more important when external systems such as GitHub, Notion, Jira, Figma, databases, or restricted filesystem servers need to be connected.

---

## 3. Prompt as Control Plane

A major discovery was that the prompt acted like a **control plane**.

Example prompt constraints:

```text
Read CLAUDE.md and ai_context/current_status.md first.
Inspect only rtl/, tb/, sim/, scripts/.
Do not scan the entire repository.
Do not modify files yet.
```

This acted like a permission and execution boundary.

Conceptual mapping:

```text
Prompt             = control plane
Claude Code        = transaction controller / AI agent
Tools / MCP / Bash = execution plane / data plane
```

The workflow resembled a handshake:

```text
Human Prompt
  ↓ intent / constraints / permission
Claude Code
  ↓ tool call request
Read / Write / Bash / MCP
  ↓ file content / execution result / log
Claude Code
  ↓ summary / patch / next step
Human
```

---

## 4. Single-Agent Orchestrator Structure

At this stage, the system was not yet a full multi-agent system.

Actual structure:

```text
Human manager = user
Main AI agent = Claude Code
Tools        = Read / Write / Bash / Monitor / MCP
```

So the number of real agents was:

```text
1 AI agent: Claude Code
```

The workflow can be described as:

```text
Single-agent + human-in-the-loop AI orchestrator
```

Claude Code performed several roles internally:

```text
Planner
RTL code generator
Testbench generator
Simulation runner
Log analyzer
Debug assistant
Patch generator
```

A future multi-agent version could separate these roles:

```text
Orchestrator Agent
RTL Agent
Verification Agent
Simulation Agent
Review Agent
```

---

## 5. Verification Plan Generation

Claude Code first inspected the existing project and generated a verification plan.

The plan proposed a progression:

```text
Smoke test
→ AXI-lite register read/write test
→ Memory write/readback test
→ DMA transfer test
→ Timeout/error handling
→ Waveform checkpoints
→ Pass/fail criteria
```

The generated plan was saved to:

```text
ai_context/verification_plan.md
```

Key proposed verification layers:

| Layer | Purpose |
|---|---|
| Smoke test | Clock/reset sanity check |
| Register read/write test | AXI-lite control register validation |
| Memory read/write test | Data path and memory model validation |
| DMA test | End-to-end source-to-destination transfer |
| Timeout handling | Prevent simulation hangs |
| Waveform checkpoints | Debug visibility |
| Pass/fail criteria | CI-friendly verification result |

---

## 6. AXI-lite Register File Example

Next, Claude Code was asked to create the smallest possible AXI-lite register-file example.

Generated files:

```text
rtl/axi_lite_regfile.v
tb/axi_lite_regfile_tb.sv
scripts/run_axi_regfile_sim.sh
```

Requirements:

```text
1. 4 registers, each 32-bit
2. AXI-lite write/read handshake
3. Clock and active-low reset
4. Testbench tasks: axi_write() and axi_read()
5. Self-checking readback test
6. Use $fatal on failure
7. Save logs under logs/
8. Run Vivado xsim and summarize the result
```

Important constraint:

```text
Do not touch rtl/and2.v or tb/and2_tb.sv.
```

---

## 7. First Simulation Failure

Claude Code generated the RTL, testbench, and run script, then executed the simulation.

Result:

```text
xvlog passed
xelab passed
xsim started
simulation hung during Test 1
xsim consumed high CPU
```

The simulation got stuck in the first reset-default readback test.

Observed behavior:

```text
Test 1: reset defaults
→ axi_read() waited forever
→ no timeout was present
→ xsim appeared to hang
```

This was a realistic verification failure.

---

## 8. Root Cause: Testbench Race Condition

The likely issue was identified as a SystemVerilog simulation race.

Original testbench behavior:

```systemverilog
araddr  = addr;
arvalid = 1'b1;

@(posedge aclk);
while (!arready) @(posedge aclk);

arvalid = 1'b0;
rready  = 1'b1;
```

Problem:

```text
The testbench drove and deasserted AXI signals on the same posedge where the DUT sampled them.
```

This can create an active-region race between:

```text
TB initial block
DUT always @(posedge aclk)
```

Potential outcome:

```text
DUT misses or inconsistently observes arvalid/awvalid.
TB waits for rvalid/bvalid forever.
Simulation hangs.
```

This is a classic HDL verification issue.

---

## 9. Fix: Race-Free AXI-lite Testbench

The fix was to apply a safer timing discipline:

```text
Testbench drives master signals on negedge aclk.
DUT samples signals on posedge aclk.
Testbench samples ready/valid on posedge aclk.
```

New rule:

```text
Drive on negedge.
Sample on posedge.
Every wait loop must have a timeout.
```

The modified testbench added:

```text
1. negedge-drive / posedge-sample handshake
2. timeout counters in axi_write()
3. timeout counters in axi_read()
4. $fatal on timeout
5. [DONE] marker only after all tests pass
```

Example concept:

```systemverilog
@(negedge aclk);
araddr  = addr;
arvalid = 1'b1;

@(posedge aclk);
while (!arready) begin
    if (++timeout > 100)
        $fatal(1, "axi_read timeout");
    @(posedge aclk);
end

@(negedge aclk);
arvalid = 1'b0;
rready  = 1'b1;
```

---

## 10. Final Simulation Result

After patching the testbench and rerunning the simulation:

```text
16/16 checks passed
Simulation completed around 930 ns
[DONE] marker printed
Hang was fixed
```

Result summary:

```text
Before:
- Simulation hung in Test 1
- No timeout
- xsim consumed high CPU
- Debug required manual intervention

After:
- Race-free testbench
- Timeout-protected AXI tasks
- $fatal on failure
- [DONE] marker on success
- 16/16 checks passed
```

This completed one full AI-assisted verification loop.

---

## 11. What This Experiment Demonstrated

This experiment demonstrated that Claude Code can already perform a meaningful subset of an RTL verification workflow:

```text
Read project context
Generate verification plan
Create RTL/TB/script files
Run xsim
Detect hang/failure
Modify testbench
Re-run simulation
Summarize result
```

However, it also showed the current limitation:

```text
AI can generate structurally reasonable HDL/TB code,
but it can still make subtle simulation-timing and protocol mistakes.
```

The human user acted as the senior verification engineer:

```text
- constrained the task
- prevented premature RTL modification
- identified likely TB race
- instructed Claude to fix TB first
- required timeout guards
```

This is a realistic human-in-the-loop verification pattern.

---

## 12. Automation Insight

The current workflow still required human intervention.

Current level:

```text
Human-in-the-loop
```

Desired future level:

```text
Human-on-the-loop
```

Current structure:

```text
Human = control plane
Claude Code = execution agent
Tools = execution plane
```

Desired structure:

```text
Human defines policy, goal, and boundaries once.
AI orchestrator executes the loop automatically.
Human intervenes only at approval gates.
```

Recommended policy style:

```markdown
## Autonomous Verification Policy

The agent may:
- Modify files under tb/
- Modify files under scripts/
- Run xsim simulations
- Add timeout checks
- Add self-checking assertions
- Re-run failed simulations up to 3 times

The agent must not:
- Modify RTL unless explicitly authorized
- Change DUT interfaces without approval
- Delete existing tests
- Run full repository scans
- Print full logs longer than 200 lines

Failure handling:
1. If compile fails, inspect the first error and patch the related file.
2. If simulation hangs, terminate it, add timeout guards, and rerun.
3. If a self-check fails, classify as TB bug or RTL bug.
4. If RTL bug is suspected, stop and propose a minimal RTL patch.
5. Final response must include pass/fail summary and changed files.
```

This would move the control plane from repeated human prompts into persistent project policy files such as:

```text
CLAUDE.md
ai_context/current_status.md
ai_context/verification_plan.md
ai_context/autonomous_policy.md
```

---

## 13. AI Orchestrator Interpretation

This experiment can be classified as:

```text
Level 2–3 AI-assisted verification workflow
```

Possible maturity model:

| Level | Description |
|---|---|
| Level 0 | Ask ChatGPT for code snippets |
| Level 1 | Claude Code edits files |
| Level 2 | Claude Code runs simulations and reads logs |
| Level 3 | Claude Code detects failures and patches TB/scripts |
| Level 4 | Policy-based autonomous verification loop with approval gates |
| Level 5 | FPGA board test, ILA, UART, DMA logs, and hardware feedback included |

The current experiment reached approximately:

```text
Level 2.5 to Level 3
```

---

## 14. Next Recommended Steps

### 14.1 Extend AXI-lite Verification

Next tests to add:

```text
1. Partial WSTRB byte-lane writes
2. AW-before-W transaction
3. W-before-AW transaction
4. Invalid address read/write at 0x10
5. bresp/rresp checking
6. Random backpressure
7. Address aliasing detection
```

Important expected RTL limitation:

```text
Current RTL likely decodes only awaddr[3:2] / araddr[3:2].
Therefore, address 0x10 may alias back to register 0.
```

This should be detected by the next testbench extension before patching the RTL.

---

### 14.2 Add Approval-Gated Autonomy

Create a policy file such as:

```text
ai_context/autonomous_policy.md
```

Then instruct Claude Code:

```text
Follow ai_context/autonomous_policy.md.
You may automatically modify TB and scripts.
You may run up to 3 compile/sim/patch iterations.
Stop and ask for approval before modifying RTL.
```

This moves the workflow closer to a real AI orchestrator.

---

### 14.3 Create a Verification Case Study README

This experiment can become a GitHub case study:

```text
docs/ai_assisted_verification_case_study.md
```

Suggested title:

```text
AI-assisted AXI-lite Verification: From Code Generation to Simulation Debugging
```

Suggested sections:

```text
Motivation
Project setup
Generated files
Failure case
Root cause
Patch
Final result
Lessons learned
Next steps
```

---

## 15. Key Takeaways

1. Claude Code CLI alone can perform most local RTL/TB/script workflows.
2. MCP is useful, but not strictly required for local Vivado/xsim automation.
3. MCP should be understood as a tool interface, not as an agent.
4. The current workflow used one main AI agent: Claude Code.
5. Prompting acted as the control plane.
6. Read/Write/Bash/MCP acted as the execution plane.
7. Human intervention was still required for debugging direction.
8. The next goal is policy-based autonomy with approval gates.
9. The AXI-lite hang was a realistic verification bug caused by TB/DUT clock-edge race.
10. The successful rerun demonstrated a complete AI-assisted verification loop.

---

## 16. One-Line Summary

This experiment showed that a single Claude Code agent, guided by structured prompts and project policy files, can already execute a meaningful RTL verification loop: generate AXI-lite RTL/TB/scripts, run Vivado xsim, detect a simulation hang, fix the testbench race condition, rerun the simulation, and produce a passing result.
