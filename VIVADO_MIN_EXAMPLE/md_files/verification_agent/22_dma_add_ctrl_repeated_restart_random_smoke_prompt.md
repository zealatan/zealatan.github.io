Before doing any implementation, save this exact prompt into:

md_files/22_dma_add_ctrl_repeated_restart_random_smoke_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/22_dma_add_ctrl_repeated_restart_random_smoke_prompt.md
  - tb/simple_dma_add_ctrl_tb.sv
  - ai_context/current_status.md

- Do not modify RTL unless the new test reveals a real RTL issue.

- Do not modify:
  - rtl/simple_dma_add_ctrl.v
  - rtl/simple_dma_add_nword.v
  - tb/axi_mem_model.sv
  - any previously verified RTL/TB/script files

Goal:
Add repeated normal restart coverage and lightweight random valid-transfer smoke coverage for simple_dma_add_ctrl.

Current status:
- Normal add, identity, overflow, zero-length, error paths, busy-state, re-trigger guard, AXI-lite write ordering, B/R backpressure, and reset-during-transfer are covered.
- However, repeated normal restarts and lightweight randomized valid transfers are not independently covered.

Requirements:

1. Add a repeated normal restart test:
   - Run at least 5 back-to-back valid DMA add transfers.
   - Use different SRC_ADDR, DST_ADDR, LENGTH_WORDS, and ADD_VALUE for each run.
   - After each run:
     - poll STATUS.done
     - verify STATUS.error = 0
     - verify PROCESSED_COUNT = LENGTH_WORDS
     - verify LAST_INPUT_DATA and LAST_OUTPUT_DATA
     - verify all destination words equal source + ADD_VALUE
   - Verify that each run uses the newly programmed parameters, not stale values from the previous run.

2. Add a lightweight random valid-transfer smoke test:
   - Run a small deterministic pseudo-random loop, for example 10 iterations.
   - Use a fixed seed for reproducibility.
   - Generate valid non-overlapping source/destination regions within the memory model range.
   - Generate LENGTH_WORDS in a small range, for example 1 to 8.
   - Generate random ADD_VALUE.
   - Seed source memory with pseudo-random values.
   - Run DMA add transfer.
   - Verify destination memory equals source + ADD_VALUE for every word.
   - Verify STATUS.error = 0.
   - Verify PROCESSED_COUNT = LENGTH_WORDS.
   - Keep all random choices reproducible and print them in compact [INFO] lines.

3. Add canary checks where practical:
   - Place canaries before and after destination regions.
   - Verify they remain unchanged.

4. Keep this as lightweight smoke, not a full constrained-random environment.

5. Keep all existing tests passing.

6. Use existing AXI-lite read/write/polling helpers where possible.

7. Add timeout guards to any new wait loop.

8. Run:

   source /home/zealatan/Vivado/2022.2/settings64.sh && bash scripts/run_simple_dma_add_ctrl_sim.sh

Final report must include:
- Files changed
- Prompt backup path
- New tests added
- Number of checks passed
- Whether CI grep gate passed
- Whether repeated normal restart is covered
- Whether lightweight random valid-transfer smoke is covered
- Any remaining limitations
