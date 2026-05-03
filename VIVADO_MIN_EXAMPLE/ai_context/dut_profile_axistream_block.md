# DUT Profile: AXI-Stream Block

**Category:** CAT-4 (AXI-Stream Block)
**Validation status:** Validated — exercised against `axis_add_one` (P29, 2026-05-03); 146/146 PASS
**Example DUTs:** Packet router, stream FIFO, FIR filter with AXI-S I/O, deserializer, packetizer, `axis_add_one`

---

## 1. Profile Purpose

This profile applies to DUTs that process data as a continuous stream of beats using the AXI-Stream protocol (`tvalid`/`tready`/`tdata`/`tlast`). The DUT may be a pure datapath (no config interface) or may have an AXI-lite config slave in addition to AXI-Stream ports.

**Applicable DUTs:**
- Stream FIFO / flow-control buffer
- Fixed-latency filter (FIR, IIR) with AXI-S I/O
- Packet router or splitter
- Serializer / deserializer
- Checksum engine
- AXI-Stream width converter

---

## 2. Required Design Contract Fields

| Field | Description |
|-------|-------------|
| tdata width | Bits per beat |
| tvalid / tready handshake | Does output stall propagate to input? Is the DUT allowed to assert tvalid without first receiving tvalid from upstream? |
| tlast policy | tlast marks last beat of packet/frame; is it required; what happens on missing tlast |
| tkeep / tstrb | Used or not; semantics if used |
| tuser | Used or not; semantics if used |
| Packet/frame boundary | What defines a complete packet; can partial packets appear |
| Latency | Fixed cycles from input valid to output valid; registered or combinatorial output |
| Backpressure propagation | Does asserting m_tready=0 cause s_tready=0 (and after how many cycles)? |
| Drop / overflow policy | What happens when output backpressure cannot be absorbed: drop, assert error, block |
| Reset behavior | Does reset flush in-flight data? Does tvalid go low on reset? |
| FIFO depth (if internal buffering) | Number of beats that can be buffered before backpressure is asserted |

---

## 3. Mandatory Test List

| # | Scenario | Key Checks |
|---|----------|------------|
| T-RST | Reset defaults | m_tvalid=0, m_tdata=0, m_tlast=0 after reset |
| T-SINGLE | Single-beat packet | tdata correct; tlast on single beat; tready/tvalid handshake correct |
| T-MULTI | Multi-beat packet | All beats delivered in order; tlast only on last beat |
| T-THRPT | Continuous throughput | m_tready=1 always; no bubble cycles between output beats; 1 word/cycle verified |
| T-TLAST | tlast correctness | tlast not asserted early; tlast not missed on final beat; multiple packet shapes |
| T-IN-BP | Input idle/stall | Insert idle cycles (s_tvalid=0) mid-packet; verify DUT waits and resumes correctly |
| T-OUT-BP | Output backpressure | Hold m_tready=0; verify DUT holds m_tvalid stable; no beats lost |
| T-WRAP | Wraparound / data boundary | Arithmetic overflow or max-value input; expected output wraps correctly |
| T-RST-PKT | Reset mid-packet | Assert reset during multi-beat packet; verify clean state after release; next packet processes correctly |
| T-SMOKE | Deterministic random packet smoke | Fixed LFSR seed; variable-length packets; all beats verified via scoreboard |

---

## 4. Scoreboard and Golden Model

**A scoreboard is required** for non-trivial AXI-Stream DUTs. The scoreboard:
- Captures input beats in order
- Applies the expected transformation
- Compares each output beat against the expected result

**Scoreboard push/pop discipline (from axis_add_one experiment):**
- **Push** an expected entry when an input beat is accepted: `s_tvalid && s_tready` at posedge.
- **Pop and compare** when an output beat is accepted: `m_tvalid && m_tready` at posedge.
- Preserve strict ordering. Compare both `tdata` and `tlast` per beat.
- On scoreboard underflow (pop with empty queue): report `[FAIL]` immediately.

For pure routing or FIFO DUTs, direct comparison of input vs. output beats is sufficient.

For processing DUTs (filters, transforms), a **golden model** is required:
- Inline reference function in the testbench (acceptable for simple operations)
- External Python golden model from the Python Modeling Agent (required for FIR, FFT, complex arithmetic)

The golden model handoff format mirrors the DSP pipeline profile (`dut_profile_dsp_pipeline.md`): `golden_model.py`, `test_vectors/`, `expected_outputs/`, and a tolerance specification.

---

## 5. Testbench Structure Conventions

```systemverilog
module <dut>_tb;
    // ---- Clock ----
    logic aclk = 1'b0;
    logic aresetn;
    always #5 aclk = ~aclk;  // 100 MHz

    // ---- AXI-Stream signals ----
    logic         s_axis_tvalid, s_axis_tlast;
    logic [W-1:0] s_axis_tdata;
    wire          s_axis_tready;
    wire          m_axis_tvalid, m_axis_tlast;
    wire  [W-1:0] m_axis_tdata;
    logic         m_axis_tready;

    // ---- DUT ----
    <dut> #(.DATA_WIDTH(W)) dut ( ... );

    // ---- Tasks ----
    // send_beat(data, last): drive on negedge, wait for handshake on posedge, push scoreboard
    // wait_output_beat(idx): wait for m_tvalid, pop+compare scoreboard
    // do_reset(): assert/deassert aresetn; clear scoreboard

    // ---- Scoreboard ----
    // logic [W-1:0] sb_data[0:255]; logic sb_last[0:255];
    // integer sb_wr=0, sb_rd=0;
    // sb_push(data+1, last) on input acceptance
    // sb_check_beat(idx) on output acceptance

    initial begin
        do_reset();
        // T-RST, T-SINGLE, T-MULTI, T-THRPT, T-TLAST, T-IN-BP,
        // T-OUT-BP, T-WRAP, T-RST-PKT, T-SMOKE
        $display("[INFO] Total checks: %0d", check_count);
        $finish;
    end
endmodule
```

**Timing rule:** Drive `s_axis_tvalid`, `s_axis_tdata`, `s_axis_tlast`, and `m_axis_tready` on **negedge aclk**. Sample all DUT outputs (`s_axis_tready`, `m_axis_tvalid`, `m_axis_tdata`, `m_axis_tlast`) on **posedge aclk**. See §9 for the full timing rationale.

---

## 6. Known Gaps at Profile Creation

~~This profile has not been exercised against a real DUT in this project.~~ *(Resolved — see §9)*

Remaining gaps (validated as still open after axis_add_one experiment):

- Scoreboard implementation pattern with multi-cycle pipeline latency (N>1)
- Interaction between AXI-lite config and stream reset
- tkeep / tstrb field handling
- tuser sideband propagation

---

## 7. Common Failure Modes

| Failure | Root cause | Fix |
|---------|-----------|-----|
| `tready`/`tvalid` race | TB drives `m_tready` at posedge active region; DUT samples same edge | Always drive `m_tready` at negedge (see §9 Rule 2) |
| Lost output beat (scoreboard mismatch) | Batch-then-drain: TB drains scoreboard after all sends; output window expired | Interleave `send_beat` + `wait_output_beat`; or use concurrent monitor |
| tlast misalignment | TB marks `tlast` at wrong beat index; or DUT shifts tlast by latency | Verify tlast per beat in scoreboard; test odd and even packet lengths |
| Scoreboard underflow | Output beat appears after scoreboard cleared (e.g., post-reset) | Clear scoreboard explicitly (`sb_rd = sb_wr`) before reset or discard operations |
| Scoreboard overflow | Inputs sent faster than outputs consumed, exceeding queue array size | Use power-of-2 array with modulo index; size queue ≥ maximum in-flight beats |
| Unstable output under backpressure | DUT clears `m_tvalid` before `m_tready=1` | Check design contract; verify `m_tvalid` held stable for N cycles while `m_tready=0` |
| Reset leaving stale valid/data | DUT does not deassert `m_tvalid` on reset | Check `m_tvalid=0` immediately after reset deasserts; do not skip T-RST |
| Simulation timescale mismatch | RTL has no `` `timescale``; testbench has one | Pass `-timescale 1ns/1ps` to `xelab` in the simulation script |

---

## 8. Likely Deferred Items

- Constrained-random packet generation
- AXI-Stream protocol checker (Synopsys/ARM VIP)
- Simultaneous multiple in-flight packets
- tuser/tkeep error injection
- CDC between stream clock and config clock

---

## 9. Lessons Learned from axis_add_one Verification

**Experiment:** `axis_add_one` (P29, 2026-05-03) — CAT-4 AXI-Stream, 1-cycle registered latency, combinatorial `s_tready`, `DATA_WIDTH=32`. Result: 146/146 PASS, CI gate PASS. No RTL bugs. No contract ambiguities. Three TB/script bugs found and fixed.

---

### Rule 1 — Timescale / Simulation Setup

If RTL lacks a `` `timescale`` directive, xelab will error with a "no timescale" warning when the testbench has one. **Fix:** pass `-timescale 1ns/1ps` to `xelab`:

```bash
xelab <top> -debug typical -s <snapshot> -timescale 1ns/1ps
```

This avoids timing ambiguity without modifying the RTL file.

---

### Rule 2 — Drive on negedge, sample on posedge (ALL AXI-S signals)

**All** AXI-Stream testbench driver signals must be changed at negedge, not in a posedge active region:

```
Drive at negedge:  s_axis_tvalid, s_axis_tdata, s_axis_tlast
Drive at negedge:  m_axis_tready   ← critical; see Race Condition note below
Sample at posedge: s_axis_tready, m_axis_tvalid, m_axis_tdata, m_axis_tlast
```

**Race Condition (discovered in axis_add_one T5/T9):**

Setting `m_axis_tready = 1'b0` in the posedge active region (e.g., immediately after a `@(posedge aclk)` check) can race with the DUT's `always @(posedge aclk)` evaluation. Depending on simulator scheduling, the DUT may see `m_tready=0` before it can fire branch 3 to clear `m_tvalid`. This leaves `m_tvalid` stuck at 1. With `m_tready=0`, `s_tready = !1 || 0 = 0`, and any subsequent `send_beat` times out.

**Fix:**

```systemverilog
// WRONG: m_tready changed in posedge active region
@(posedge aclk); check_...; m_axis_tready = 1'b0; send_beat(...);

// CORRECT: advance to negedge first, then change m_tready
@(posedge aclk); check_...;
@(negedge aclk); m_axis_tready = 1'b0; // safe: DUT already evaluated at previous posedge
send_beat(...);
```

This rule applies equally to `m_axis_tready = 1'b1` changes when the buffer is being released.

---

### Rule 3 — Avoid Unsafe Batch-then-Drain Patterns

For DUTs with short latency (1 cycle) and a 1-entry output buffer, the output window is exactly **one posedge**. With `m_tready=1`, the output is consumed at the same posedge it appears, and `m_tvalid` drops to 0 at the next posedge. If a testbench sends N beats first and then calls a drain loop, all but the last output have already expired.

**Wrong pattern (batch-then-drain):**
```systemverilog
send_beat(A, 0); send_beat(B, 0); send_beat(C, 0); send_beat(D, 1);
drain_scoreboard(); // ← beats A, B, C outputs expired; only D remains
```

**Correct pattern (interleave):**
```systemverilog
send_beat(A, 0); wait_output_beat(0);
send_beat(B, 0); wait_output_beat(1);
send_beat(C, 0); wait_output_beat(2);
send_beat(D, 1); wait_output_beat(3);
```

`wait_output_beat` must be called immediately after `send_beat` returns (at negedge), before any other `@(posedge)` advance.

For higher-latency DUTs (N cycles), batch-then-drain works if the drain starts within N cycles of the last send. For low-latency DUTs, always interleave.

**Alternative:** use a concurrent `always @(posedge aclk)` monitor process (or fork/join) that pops the scoreboard whenever `m_tvalid && m_tready`. This removes the ordering constraint entirely but requires a parallel process.

---

### Rule 4 — Scoreboard Policy

```
Push  on: posedge where s_axis_tvalid && s_axis_tready
          expected entry = { tdata + transform, tlast }

Pop   on: posedge where m_axis_tvalid && m_axis_tready
          compare m_axis_tdata and m_axis_tlast against head of queue
          dequeue head
```

For DUTs with N-cycle latency, the scoreboard queue depth must accommodate at least N in-flight beats. For the 1-cycle case, the maximum depth is 1 at any time, but the queue array must be sized ≥ total beats per test to avoid aliasing.

---

### Recommended AXI-Stream TB Architecture

```
module <dut>_tb;
    // 1. Clock generator
    always #5 aclk = ~aclk;

    // 2. Driver: send_beat(data, last)
    //    - @(negedge) drive s_tvalid, s_tdata, s_tlast
    //    - @(posedge) wait until s_tready=1
    //    - sb_push(transform(data), last)
    //    - @(negedge) deassert s_tvalid

    // 3. Monitor: wait_output_beat(idx)
    //    - @(posedge) wait until m_tvalid=1 (with timeout guard)
    //    - sb_check_beat(idx): compare m_tdata and m_tlast against sb head
    //    - For concurrent: always @posedge check m_tvalid&&m_tready→sb_check

    // 4. Scoreboard queue
    //    - logic [W-1:0] sb_data[0:255];
    //    - logic sb_last[0:255];
    //    - integer sb_wr=0, sb_rd=0;
    //    - push: sb_data[sb_wr & 8'hFF] = expected_data; sb_wr++;
    //    - pop:  compare m_tdata vs sb_data[sb_rd & 8'hFF]; sb_rd++;

    // 5. Timeout guard on every wait loop
    //    - integer timeout = 0;
    //    - while (!signal) { if (++timeout > 200) $fatal(...); @posedge; }

    // 6. Smoke loop (T-SMOKE)
    //    - logic [31:0] lfsr = FIXED_SEED;
    //    - for (pkt=0; pkt<N; pkt++) {
    //        for (beat=0; beat<pkt_len; beat++) {
    //            optional: @negedge; repeat(K) @posedge; // input idle
    //            lfsr = lfsr_next(lfsr);
    //            send_beat(lfsr, (beat==pkt_len-1));
    //            wait_output_beat(beat_cnt++);
    //        }
    //      }
endmodule
```

---

*Last updated: 2026-05-03 (P30 — post axis_add_one validation)*
*Applies to: DUT category CAT-4, RTL Verification Agent Phase v1 onward*
