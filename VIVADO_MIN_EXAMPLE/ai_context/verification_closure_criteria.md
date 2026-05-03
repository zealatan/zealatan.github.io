# Verification Closure Criteria — DMA/AXI Phase v1

This document defines the criteria that must be met for the DMA/AXI Verification Phase v1 to be considered closed.

---

## Closure Checklist

### 1. Planned Prompts Completed

All 25 prompts in the verification sequence have been executed and their results recorded.

| Criterion | Status |
|-----------|--------|
| Prompts 1–25 executed | DONE |
| Each prompt saved to `md_files/` | DONE |
| Each prompt's test run recorded in `ai_context/current_status.md` | DONE |

### 2. All Simulation Scripts Pass

| Script                               | Final Result | CI Gate |
|--------------------------------------|--------------|---------|
| scripts/run_axi_regfile_sim.sh       | 133/133 PASS | PASS    |
| scripts/run_mem_rw_sim.sh            | 30/30 PASS   | PASS    |
| scripts/run_simple_axi_master_sim.sh | 14/14 PASS   | PASS    |
| scripts/run_simple_dma_copy_sim.sh   | 16/16 PASS   | PASS    |
| scripts/run_simple_dma_copy_nword_sim.sh | 31/31 PASS | PASS  |
| scripts/run_simple_dma_ctrl_sim.sh   | 208/208 PASS | PASS    |
| scripts/run_simple_dma_add_nword_sim.sh | 81/81 PASS | PASS   |
| scripts/run_simple_dma_add_ctrl_sim.sh | 691/691 PASS | PASS  |

### 3. No [FAIL] or FATAL in Logs

CI gate command: `grep -qE '\[FAIL\]|FATAL' logs/*.log && exit 1`

All simulation log files must produce exit code 0 from the CI gate. This was verified on each final simulation run per script.

### 4. [DONE] Appears in Simulation Logs

Each simulation script emits `[DONE] Simulation finished.` on successful completion. This line confirms the simulation ran to `$finish` and was not killed by timeout or $fatal.

### 5. Expected Check Counts Match Final Reports

| Module                        | Expected | Actual | Match |
|-------------------------------|----------|--------|-------|
| axi_lite_regfile              | 133      | 133    | Yes   |
| axi_mem_model                 | 30       | 30     | Yes   |
| simple_axi_master             | 14       | 14     | Yes   |
| simple_dma_copy               | 16       | 16     | Yes   |
| simple_dma_copy_nword         | 31       | 31     | Yes   |
| simple_dma_ctrl               | 208      | 208    | Yes   |
| simple_dma_add_nword          | 81       | 81     | Yes   |
| simple_dma_add_ctrl           | 691      | 691    | Yes   |
| **Cumulative**                | **1204** | **1204** | **Yes** |

> Note: The prompt specified 1156/1156 cumulative; the actual final count is 1204/1204 after including T18 (48 new checks from P24).

### 6. No Forbidden Files Were Modified

Scope restrictions were declared in each prompt. The following file categories must not have been modified outside their designated scope:

- RTL files: read-only after initial development unless an RTL bug was found and explicitly authorized
- Previously verified TB files: read-only
- Simulation scripts: read-only after creation
- `tb/axi_mem_model.sv`: read-only throughout

Verification: confirmed by git diff and scope declarations in each prompt's md_files entry.

### 7. Design Contract Coverage

Each major contract item in `ai_context/design_contract.md` must be either verified (entry in `ai_context/verification_matrix.md` with Status=PASS) or explicitly listed in `ai_context/known_limitations.md`.

| Contract Item                      | Verification Evidence    | Or Limitation Doc         |
|------------------------------------|--------------------------|---------------------------|
| AXI-lite register interface        | V45–V47, V01–V09         | —                         |
| CONTROL.start behavior             | V46, V53, V54            | —                         |
| STATUS bit layout                  | V53, V59, V66            | —                         |
| SRC/DST/LEN/ADD R/W behavior       | V45, V63–V65             | —                         |
| PROCESSED_COUNT                    | V46, V55                 | —                         |
| LAST_INPUT/LAST_OUTPUT             | V41–V42, V46             | —                         |
| Normal add transfer                | V47, V61, V62            | —                         |
| Identity mode                      | V40, V48                 | —                         |
| Overflow wraparound                | V39, V49                 | —                         |
| Read error abort                   | V41, V51                 | —                         |
| Write error abort                  | V42, V52                 | —                         |
| Busy retrigger guard               | V54, V31                 | —                         |
| Busy config write policy           | V63–V65                  | —                         |
| Zero-length transfer               | V36, V50                 | —                         |
| Restart after completion           | V61, V62                 | —                         |
| Restart after error                | V55, V43, V44            | —                         |
| Reset during transfer              | V59, V66                 | —                         |
| Post-reset defaults                | V60, V67                 | —                         |
| Memory/canary integrity            | V59, V63, V66            | —                         |
| Misaligned address                 | —                        | known_limitations.md §3.1 |
| Source/destination overlap         | —                        | known_limitations.md §3.2 |
| Burst support                      | —                        | known_limitations.md §2.1 |
| Multiple outstanding transactions  | —                        | known_limitations.md §2.2 |

### 8. Remaining Limitations Are Explicitly Documented

`ai_context/known_limitations.md` is created and covers all deferred items. See that document for the full list.

### 9. Verification Matrix Is Updated

`ai_context/verification_matrix.md` contains 67 entries covering all 8 DUT layers. All entries show Status=PASS.

### 10. Final Verification Summary Is Written

`ai_context/final_verification_summary.md` is created and summarizes the full verification campaign.

---

## Closure Decision

When all 10 criteria above are met, the DMA/AXI Verification Phase v1 is **CLOSED**.

Current assessment (as of 2026-05-03): **All 10 criteria are met. Phase v1 is CLOSED.**

---

## Exit Conditions for Future Reopening

Phase v1 would need to be reopened if:
- A new RTL bug is discovered that invalidates a previously passing check.
- A previously passing simulation script begins failing due to RTL or TB changes.
- A new design contract item is added that has not been verified or documented as a known limitation.

---

*Last updated: 2026-05-03*
*Applies to: DMA/AXI Verification Phase v1 (Prompts 1–25)*
