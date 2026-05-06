# AI-assisted RTL/FPGA Verification Prompts

This directory archives all major prompts used for the AI-assisted RTL/FPGA verification workflow.
Each step prompt must be saved before or during execution.

## Naming Convention

```
NN_short_step_name_prompt.md
```

- `NN` is a zero-padded step number (20, 21, 22, …)
- Use lowercase with underscores
- Do not delete old prompt files — they are part of the experiment record
- If a prompt is revised, create a new version with suffix `_v2`, `_v3`, etc.
- Prompt files should be committed to git

## Subdirectories

| Subdirectory | Contents |
|---|---|
| `verification_agent/` | Prompts 00–32: DMA/AXI layer verification campaign (P01–P35) |
| `rtl_designer/` | Prompts 27–28: RTL Designer Agent Protocol and AXI-Stream designs |

## Top-Level Prompt Files

### DMA/AXI Verification Campaign (legacy numbering, now in verification_agent/)

1. `00_axi_lite_invalid_address_patch_prompt.md`
2. `01_axi_memory_model_prompt.md`
3. `02_simple_axi_master_prompt.md`
4. `03_simple_dma_copy_1word_prompt.md`
5. `04_simple_dma_copy_read_error_abort_prompt.md`
6. `05_simple_dma_copy_invalid_dst_strengthen_prompt.md`
7. `06_simple_dma_copy_nword_prompt.md`
8. `07_next_axi_lite_controlled_dma_wrapper_prompt.md`

### frac_cfo_frame_corrector_top Campaign (Step 20+)

| File | Step | Description |
|------|------|-------------|
| `20_frac_cfo_frame_corrector_top_prompt.md` | 20 | RTL integration of Phase-1 CFO corrector + frame extractor |
| `21_frac_cfo_frame_corrector_randomized_verification_prompt.md` | 21 | Randomized verification campaign (176 checks) |
| `22_synthesis_readiness_prompt.md` | 22 | ZCU102 synthesis-readiness audit (xczu9eg-ffvb1156-2-e, aclk 100 MHz) |

### Next Required

| File | Step | Description |
|------|------|-------------|
| `23_axi_lite_debug_config_wrapper_prompt.md` | 23 | AXI-Lite debug/config wrapper for Phase-1 FPGA bring-up |
