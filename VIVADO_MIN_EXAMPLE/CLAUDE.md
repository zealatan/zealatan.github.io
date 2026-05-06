# Claude Code Instructions

This is a minimal Vivado simulation example.

Rules:
- Read this file first.
- Do not modify RTL unless explicitly asked.
- Use scripts/run_vivado_sim.sh to run simulation.
- Put simulation logs under logs/.
- Put temporary Vivado/xsim outputs under build/.
- After modifying files, summarize the changes.

## Prompt Archive Policy

Every major task prompt must be saved under `md_files/` before or during execution.

- Use filename format: `NN_descriptive_step_name_prompt.md`
- Never rely only on chat history for prompts.
- If the user provides a prompt in chat, first save or reconstruct it under `md_files/`.
- At the end of each step, report the prompt archive file path.
- Do not overwrite existing prompt archives unless the user explicitly requests it.
- If a prompt is revised, create a new version with suffix `_v2`, `_v3`, etc.
- Prompt files are part of the experiment record and must be committed to git.
