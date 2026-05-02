# Autonomous RTL Verification Loop Policy

## 1. Allowed Actions

- Inspect any files under `rtl/`, `tb/`, `scripts/`, `sim/`, `logs/`
- Modify files under `tb/` (testbench sources)
- Modify files under `scripts/` (simulation scripts)
- Add new verification documents under `ai_context/`
- Run Vivado xsim via `scripts/run_vivado_sim.sh`
- Inspect simulation logs under `logs/`
- Add timeout guards to testbenches or scripts
- Add self-checking assertions (`$error`, `$fatal`, checker blocks)
- Add waveform dumping (e.g., `$dumpfile`/`$dumpvars` or Vivado `.wcfg`) when useful for diagnosis

## 2. Forbidden Actions

- **Do not modify RTL** (`rtl/`) without explicit user approval
- **Do not change DUT interfaces** (port names, widths, directions) without explicit user approval
- **Do not delete existing tests** — only add or extend
- **Do not scan directories unrelated to this project**
- **Do not run long or unbounded simulations** — all simulations must have a defined timeout
- **Do not print full logs longer than 200 lines** — truncate and summarize instead

## 3. Failure Handling Policy

### Compile failure
- Inspect the first meaningful error (not warnings).
- Patch only the TB or script file directly related to that error.
- Do not modify RTL to fix a compile error.

### Simulation hang
- Terminate the simulation.
- Add a `$finish`-based timeout guard to the TB (or increase the existing one if too short).
- Rerun.

### Self-check failure
Classify the failure as one of:
- **TB bug** — wrong expected value, missing initialization, race condition in TB logic
- **Script bug** — incorrect elaboration flags, missing source file, wrong top-level name
- **RTL bug** — DUT output does not match the specification when TB and script are verified correct

### RTL bug suspected
- **Stop immediately.**
- Describe the failing case (inputs, expected output, actual output).
- Propose a minimal RTL patch in a fenced code block.
- **Do not apply the patch.** Wait for explicit user approval.

### Retry limit
- Rerun a failed simulation up to **3 times** after applying a fix.
- If still failing after 3 attempts, stop and file a report (see §4).

## 4. Final Report Format

Each autonomous loop iteration must conclude with a report in the following structure:

```
## Verification Run Report

### Changed Files
- <path>: <one-line description of change>

### Commands Executed
1. <command>

### Result
PASS | FAIL

### Failure Classification (if FAIL)
- Category: TB bug | Script bug | RTL bug | Unknown
- Evidence: <brief description>

### RTL Modification Required
Yes — <proposed patch summary> | No

### Next Recommended Test
<description of the next test case or scenario to verify>
```
