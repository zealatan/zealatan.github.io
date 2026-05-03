# RTL Verification Agent Core Protocol

## 1. Purpose

This document defines the operating protocol for the **RTL Verification Agent** (Agent 4) in the hardware development orchestrator. It governs how the agent approaches any RTL verification task — from reading context through closure documentation.

This is **not a UVM replacement**. It is a lightweight, AI-assisted RTL verification protocol built on:
- Self-checking SystemVerilog testbenches
- Vivado xsim simulation (or equivalent)
- `[PASS]`/`[FAIL]` evidence in simulation logs
- Structured prompt sequences with bounded file scope
- Evidence-based closure documentation

It is intended for simulation-level functional verification of individual RTL modules and small subsystems. It does not replace constraint-driven random verification, formal property checking, or full-chip gate-level simulation.

---

## 2. Common Workflow

Execute these steps in order for every verification prompt:

```
1.  Read CLAUDE.md and ai_context/current_status.md
2.  Save this prompt verbatim to md_files/<NN>_<descriptor>_prompt.md
3.  Identify the DUT category and load the matching DUT profile
4.  Inspect only the files listed in the prompt's scope declaration
5.  Create or update the testbench (within scope)
6.  Create or update the simulation script (within scope)
7.  Run Vivado xsim:
       xvlog → xelab → xsim (or equivalent script)
8.  Inspect simulation logs:
       - grep for [FAIL] / FATAL
       - check check count vs. expected
       - check [DONE] present
9.  Classify any failure (see §7)
10. Patch only allowed files
11. If RTL modification needed: request human approval unless explicitly authorized
12. Re-run simulation if any file was patched; repeat from step 8
13. Update ai_context/current_status.md
14. Update ai_context/verification_matrix.md if new scenarios were added
15. Update ai_context/known_limitations.md if new deferred items were identified
16. Produce final report (see §8)
```

---

## 3. Mandatory Verification Mechanics

Every testbench produced or modified under this protocol must implement all of the following:

### 3.1 Self-Checking Testbench
Every check must compare an observed DUT output against an expected value and print a result. No silent passes.

### 3.2 [PASS]/[FAIL] Log Format
```
[PASS]  <label>  got=<observed_value>
[FAIL]  <label>  got=<observed_value>  exp=<expected_value>
```
The CI gate `grep -qE '\[FAIL\]|FATAL'` must find zero matches on a clean run.

### 3.3 $fatal on Hard Failure
Checks that fail during a transfer (mid-simulation) must call `$fatal` to stop the simulation immediately. Continuing after a hard failure produces misleading logs.

### 3.4 Timeout Guards on All Wait Loops
Every `while(!signal)` or `do...while` loop that waits for a DUT signal must have an integer counter and a `$fatal` on timeout. Example:
```systemverilog
int timeout = 0;
while (!s_arready) begin
    if (++timeout > 200) $fatal(1, "[FATAL] arready timeout");
    @(posedge aclk);
end
```

### 3.5 CI Grep Gate
The simulation script must end with:
```bash
grep -qE '\[FAIL\]|FATAL' logs/<sim>.log && { echo "[ERROR] Failures detected"; exit 1; } || echo "[PASS] No failures detected"
```

### 3.6 AXI Bus Timing Discipline
For AXI-based DUTs:
- Drive master signals on **negedge**
- Sample DUT ready/valid signals on **posedge**
- This prevents TB/DUT race conditions at clock edges

### 3.7 Deterministic and Reproducible Tests
All tests must produce the same result on every run. No `$random` without a fixed seed declared in the prompt. Deterministic smoke iterations are preferred over unbounded random.

### 3.8 Prompt Backup
Every prompt must be saved verbatim to `md_files/<NN>_<descriptor>_prompt.md` before any implementation begins.

### 3.9 Evidence-Based Closure
Closure is not declared based on "the code looks right." It is declared based on:
- Observed check count matching the expected count
- Zero `[FAIL]` or `FATAL` in logs
- CI grep gate exit code 0
- Closure documents complete

---

## 4. Closure Requirements

A verification task is considered **closed** when ALL of the following are true:

| # | Criterion |
|---|-----------|
| 1 | All planned tests pass (`[PASS]` for every check) |
| 2 | CI grep gate exits with code 0 |
| 3 | `ai_context/design_contract.md` (or equivalent) exists for the DUT |
| 4 | `ai_context/verification_matrix.md` is updated with new entries |
| 5 | `ai_context/known_limitations.md` documents all deferred items |
| 6 | `ai_context/verification_closure_criteria.md` lists all criteria and marks them met |
| 7 | `ai_context/final_verification_summary.md` (or equivalent) summarizes the campaign |
| 8 | All deferred items are explicitly named — "not tested" is only acceptable if documented |

---

## 5. Modification Policy

| File Type | Policy |
|-----------|--------|
| Testbench (TB) | May be modified within the prompt's declared scope |
| Simulation script | May be modified within scope; do not delete CI gate logic |
| Documentation (ai_context/, md_files/) | May be created or modified within scope |
| RTL | **Read-only** by default. Modification requires explicit human approval unless the prompt declares RTL modification as in-scope |
| Previously verified TB files | Do not modify; preserve all existing passing tests |
| Other TB/RTL not in scope | Do not read or modify unless listed in the prompt's scope declaration |

**Never rewrite a previously passing test to make a new test pass.** If a new test causes a regression, the new test is wrong.

---

## 6. Scope Declaration

Every prompt must explicitly declare its allowed file scope. Example:

```
Scope:
- You may create or modify only:
  - tb/new_tb.sv
  - scripts/run_new_sim.sh
  - ai_context/current_status.md
- Do not modify: rtl/, previously verified tb/, any files not listed
```

The agent must refuse or flag any action that would require modifying a file outside the declared scope.

---

## 7. Failure Classification

When a simulation or testbench check fails, classify the root cause before patching:

| Class | Description | Action |
|-------|-------------|--------|
| **TB bug** | Testbench drives wrong timing, checks wrong bit, computes wrong expected value | Patch TB within scope |
| **RTL bug** | DUT produces incorrect output; the TB expectation is correct per the design contract | Request RTL modification approval; flag in report |
| **Script/tool bug** | xsim/xelab setup error, wrong source list, missing `settings64.sh` | Fix script within scope |
| **Design contract ambiguity** | The expected behavior is unclear; the DUT and TB have different interpretations | Clarify contract; update design_contract.md |
| **Environment issue** | License error, disk space, tool version mismatch | Report to human; do not guess at workarounds |
| **Out-of-scope limitation** | The scenario is valid but not covered in this phase | Document in known_limitations.md |

Do not classify a TB bug as an RTL bug, or vice versa, without evidence.

---

## 8. Final Report Format

Every prompt must conclude with a report in this format:

```
Files changed:
- <file> — <one-line description>

Prompt backup path:
- md_files/<NN>_<descriptor>_prompt.md

Tests added:
- <Test N>: <short description> (<M> checks)

Check count:
- <module>: <actual>/<expected> PASS

CI gate status: PASS / FAIL

Coverage closed:
- <scenario>: Yes/No

Remaining limitations:
- <item>

Recommended next step:
- <description>
```

---

*Last updated: 2026-05-03*
*Applies to: RTL Verification Agent (Agent 4), DMA/AXI Verification Phase v1 onward*
