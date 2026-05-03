Before doing any implementation, save this exact prompt into:

md_files/verification_agent/30_update_axistream_profile_lessons_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/verification_agent/30_update_axistream_profile_lessons_prompt.md
  - ai_context/dut_profile_axistream_block.md
  - ai_context/verification_agent_core_protocol.md
  - ai_context/current_status.md

- Do not modify:
  - rtl/
  - tb/
  - scripts/
  - docs/
  - RTL Designer Agent files unless absolutely necessary
  - existing verified RTL/TB/script files

Goal:
Update the AXI-Stream DUT profile and RTL Verification Agent protocol with lessons learned from the axis_add_one verification handoff experiment.

Context:
Prompt 29 verified axis_add_one, the first Agent 3 → Agent 4 handoff experiment using the CAT-4 AXI-Stream Processing Block profile.

Result:
- 146/146 checks passed
- CI grep gate passed
- No RTL bugs found
- No contract ambiguities found
- Three testbench/script issues were discovered and fixed:
  1. xelab timescale issue
  2. batch-then-drain scoreboard issue
  3. m_axis_tready posedge race condition

Requirements for ai_context/dut_profile_axistream_block.md:

1. Add a section:
   "Lessons Learned from axis_add_one Verification"

2. Document the following AXI-Stream testbench rules:

   Rule 1 — Timescale / simulation setup:
   - If RTL lacks `timescale`, the simulation script should provide a default xelab timescale, for example:
     -timescale 1ns/1ps
   - This avoids timing ambiguity in small standalone RTL modules.

   Rule 2 — Drive on negedge, sample on posedge:
   - AXI-Stream testbench drivers should drive s_axis_tvalid, s_axis_tdata, s_axis_tlast, and m_axis_tready on negedge.
   - Testbench monitors should sample DUT outputs on posedge.
   - Do not change m_axis_tready in the same posedge active region where the DUT samples it.
   - This avoids TB/DUT race conditions.

   Rule 3 — Avoid unsafe batch-then-drain patterns:
   - For single-stage or low-latency streaming DUTs, outputs may be produced while inputs are still being driven.
   - The testbench should either:
     - monitor outputs concurrently, or
     - interleave send and expect operations when appropriate.
   - Do not assume outputs can always be drained after all inputs are sent.

   Rule 4 — Scoreboard policy:
   - Push expected output when an input beat is accepted:
     s_axis_tvalid && s_axis_tready
   - Pop/check expected output when output beat is accepted:
     m_axis_tvalid && m_axis_tready
   - Preserve ordering.
   - Compare tlast with the corresponding beat.

3. Add or refine mandatory CAT-4 tests:
   - reset defaults
   - single-beat transfer
   - multi-beat packet
   - continuous throughput
   - output backpressure
   - input idle/stall
   - tlast propagation
   - wraparound or data-boundary case if arithmetic is involved
   - reset mid-packet
   - deterministic random packet smoke

4. Add a section:
   "Recommended AXI-Stream TB Architecture"

   Include:
   - driver
   - monitor
   - scoreboard queue
   - timeout guard
   - optional concurrent output monitor
   - deterministic random smoke loop

5. Add a section:
   "Common Failure Modes"

   Include:
   - tready/tvalid race
   - lost output due to late monitor/drain
   - tlast misalignment
   - scoreboard underflow/overflow
   - unstable output under backpressure
   - reset leaving stale valid/data
   - simulation timescale mismatch

Requirements for ai_context/verification_agent_core_protocol.md:

1. Add a short subsection under mandatory mechanics or testbench discipline:
   "Interface-specific TB timing rules"

2. Mention:
   - AXI-lite and AXI-Stream drivers should avoid same-edge TB/DUT races.
   - Prefer negedge-drive / posedge-sample discipline for simple simulation testbenches.
   - Interface-specific profiles may override or refine this rule.

3. Do not rewrite the whole file.
4. Keep the update concise.

Requirements for ai_context/current_status.md:

1. Add a short note:
   "AXI-Stream profile updated after axis_add_one handoff experiment."

2. Mention:
   - 146/146 PASS
   - no RTL bugs
   - profile updated with testbench timing and scoreboard lessons

Final report must include:
- Files changed
- Prompt backup path
- Summary of AXI-Stream profile updates
- Confirmation that RTL/TB/scripts were untouched
- Recommended next step
