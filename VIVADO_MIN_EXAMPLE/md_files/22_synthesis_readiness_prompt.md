# Step 22 Prompt — Phase-1 Synthesis-Readiness and Vivado Resource/Timing Check

## Working Directory

```
/home/zealatan/AI_ORC/messi/VIVADO_MIN_EXAMPLE
```

## Phase-1 Context

Phase-1 is a frame-buffered OFDM synchronizer. It is NOT a 1-sample/clock streaming pipeline.
`frac_cfo_frame_corrector_top` is a self-contained Phase-1 block. It discards `cfg_timing_offset`
samples while the 16-bit phase accumulator tracks them, then outputs `cfg_frame_len` Q1.15-rotated
samples via a one-entry AXI-Stream registered output buffer.

## Completed Step 20 Summary

RTL created: `rtl/frac_cfo_frame_corrector_top.v`. Simulation: PASS 39, FAIL 0. CI gate: PASSED.
Architecture: 256-entry Q1.15 sin/cos LUT (initial block, `$cos`/`$sin`/`$rtoi`), 16-bit phase
accumulator, full complex multiply (33-bit accumulation), one-entry output buffer with backpressure.

## Completed Step 21 Summary

Randomized verification campaign completed.

**Step 21 result: PASS 176, FAIL 0, randomized trials 57, CI gate PASSED, RTL bugs found 0.**

Test groups: R1 timing offset sweep (32 checks), R2 CFO sweep (16), R3 randomized frame placement
(40), R4 amplitude scaling (10), R5 backpressure patterns (12), R6 reset robustness (9),
R7 no-frame rejection (6), R8 buffer boundary stress (12). Two testbench bugs found and fixed
(run_frame buffer leak, recv_bp m_tlast NBA race). RTL not modified.

## Goal

Perform a Phase-1 synthesis-readiness audit and Vivado out-of-context resource/timing check for
`frac_cfo_frame_corrector_top`. Determine whether the RTL is synthesizable as-is, collect
utilization and timing data, and produce a go/no-go FPGA-readiness conclusion.

## Target Board and Part

| Property | Value |
|----------|-------|
| Board | ZCU102 Evaluation Kit |
| Part | xczu9eg-ffvb1156-2-e |
| Technology | Zynq UltraScale+ ZU9EG, 16nm FinFET |

**Do NOT use `xc7z020clg400-1` (Zynq-7000 series) for the ZCU102 target.**

If the exact `xczu9eg-ffvb1156-2-e` license is unavailable in the local Vivado installation,
document the license blocker and note that any UltraScale+ substitute synthesis used is
provisional evidence only — not a ZCU102 confirmation.

## Target Clock

| Property | Value |
|----------|-------|
| Clock port | `aclk` |
| Period | 10.000 ns |
| Frequency | 100 MHz |
| Constraint | `create_clock -period 10.000 [get_ports aclk]` |

**Do NOT use `[get_ports clk]`. The RTL top-level clock port is `aclk`, not `clk`.**

## Constraints

- Do **not** add an AXI-Lite control interface in this step.
- Do **not** redesign for 1 sample/clock streaming.
- Do **not** start Phase 2 work.
- Do **not** modify RTL unless a trivial fix is required to unblock synthesis.
- Do **not** hide failures — report all errors, critical warnings, and DRC issues.
- Synthesis mode: out-of-context (`-mode out_of_context`). No board pin constraints needed.
- This is synthesis/resource/timing readiness only, not board implementation.

## Required Files

### Create

```
scripts/step22_synth_check.tcl
```

Vivado TCL script:
- `create_project -in_memory`
- `set_part xczu9eg-ffvb1156-2-e`
- `read_verilog rtl/frac_cfo_frame_corrector_top.v`
- `synth_design -top frac_cfo_frame_corrector_top -part xczu9eg-ffvb1156-2-e -mode out_of_context -flatten_hierarchy rebuilt`
- `create_clock -period 10.000 [get_ports aclk]`
- `report_utilization` → `reports/step22_synth_utilization.rpt`
- `report_timing_summary` → `reports/step22_timing_summary.rpt`
- `report_drc` → `reports/step22_drc.rpt`
- Log via `tee` proc to `reports/step22_synth_messages.log`
- `catch` on `synth_design`; exit 1 on failure with error text

```
scripts/run_frac_cfo_frame_corrector_top_synth.sh
```

Shell driver:
- `vivado -mode batch -source scripts/step22_synth_check.tcl -nojournal -nolog`
- Tee to `reports/step22_synth_messages.log`
- Grep utilization report for LUT/FF/BRAM/DSP
- Grep timing report for WNS/TNS
- Exit 1 if `SYNTHESIS FAILED` or `ERROR:` found
- Print `[STEP22] CI GATE: PASSED` on success

```
docs/step22_synthesis_readiness_report.md
```

Full synthesis readiness report. Must include:
- Step 22 goal
- Phase-1 context and architecture classification
- Files audited
- Synthesis script description
- Target FPGA part and target clock
- Synthesis result (PASSED/FAILED)
- Utilization summary (LUT, FF, BRAM, DSP)
- Timing summary (WNS, TNS, hold slack, unconstrained paths)
- DRC summary
- Critical warnings and errors
- Unsynthesizable construct audit table
- FPGA-readiness conclusion
- Required fixes before FPGA deployment
- Recommended Step 23

```
reports/step22_synth_utilization.rpt
reports/step22_timing_summary.rpt
reports/step22_drc.rpt
reports/step22_synth_messages.log
```

### Update

```
ai_context/current_status.md
```

Add Step 22 section: synthesis pass/fail, utilization, timing, blockers, FPGA-readiness conclusion,
recommended Step 23.

## RTL Audit Requirements

Audit `rtl/frac_cfo_frame_corrector_top.v` for the following unsynthesizable or risky constructs:

| Construct | Risk | Expected finding |
|-----------|------|-----------------|
| `real` / `shortreal` | Not synthesizable in most tools | Present in initial block (expected) |
| `$sin` / `$cos` / `$atan` / `$atan2` / `$sqrt` / `$ln` | Simulation functions | Present in initial block (expected) |
| `$rtoi` | Simulation function | Present in initial block (expected) |
| `#delay` statements | Not synthesizable | Should not be present in RTL proper |
| File I/O (`$fopen`, `$fread`, `$readmemh` at runtime) | Simulation-only | Should not be present |
| Latches (incomplete `if`/`case`) | Inferred latch risk | Check all combinatorial always blocks |
| Combinatorial loops | Timing issue | Verify no loops in `assign` chain |
| Multi-driven nets | Synthesis error | Verify no duplicated drivers |

If `real`/`$sin`/`$cos`/`$rtoi` appear only inside a power-on `initial` block driving a ROM array,
note that Vivado 2022.2 evaluates them at elaboration time as constants and infers distributed ROM.
This is Vivado-specific — not portable to Synplify/Design Compiler.

## License Blocker Documentation

If synthesis of `xczu9eg-ffvb1156-2-e` fails due to missing license:

- Document the exact error message
- State that the `XCZU9EG` INCREMENT license requires the `xilinxd` daemon running on a host
  with HostID matching the license file (MAC `8cf8c5f1b9cc` = Windows physical NIC)
- State that WSL2 presents a different HostID (`00155dca8270`)
- State that ZU3EG synthesis succeeds via the embedded Vivado Design Edition entitlement
  and may serve as provisional evidence for the same UltraScale+ fabric
- State that the synthesis script is correct and will succeed once the Windows Vivado
  License Manager (lmgrd + xilinxd) is running at port 2100 on the Windows host

## Expected Final Report Fields

```
Synthesis result: PASSED (or: BLOCKED — license; provisional ZU3EG results shown)
First blocking error: None (or license error text)
Critical warnings: 0
DRC: clean (no critical violations)
Target: xczu9eg-ffvb1156-2-e  Clock: aclk 100 MHz
Utilization: LUT ~203 (0.29%), FF ~45 (0.03%), BRAM 0, DSP48E2 4 (1.11%)
Timing: WNS ~5.9 ns (PASS), TNS 0.000 ns, hold slack ~0.078 ns
Unconstrained paths: 0 (when aclk constraint correctly applied to [get_ports aclk])
FPGA-readiness conclusion: FPGA-READY for Phase-1 deployment at block level
RTL modified: No
Recommended Step 23: AXI-Lite debug/config wrapper for Phase-1 FPGA bring-up
```
