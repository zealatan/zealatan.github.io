# DUT Profile: AXI-Stream Block

**Category:** CAT-4 (AXI-Stream Block)
**Validation status:** Not yet verified — profile only
**Example DUTs:** Packet router, stream FIFO, FIR filter with AXI-S I/O, deserializer, packetizer

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
| T-SINGLE | Single-beat packet | tdata correct; tlast on single beat; tready/tvalid handshake correct |
| T-MULTI | Multi-beat packet | All beats delivered in order; tlast only on last beat |
| T-TLAST | tlast correctness | tlast not asserted early; tlast not missed on final beat |
| T-IN-BP | Input backpressure | Hold s_tvalid=0 mid-packet; verify DUT waits; resumes correctly |
| T-OUT-BP | Output backpressure | Hold m_tready=0; verify DUT holds m_tvalid; no beats lost |
| T-STALL | Random tvalid/tready stall | Inject random stalls on both input and output; all beats delivered |
| T-PKT-BOUND | Packet boundary preservation | End of one packet does not bleed into next; tlast position correct |
| T-RST-PKT | Reset mid-packet | Assert reset during multi-beat packet; verify clean state after release; next packet processes correctly |
| T-EMPTY | Empty/invalid packet (if applicable) | Zero-beat packet with tlast on beat 0; DUT handles gracefully |
| T-LATENCY | Latency alignment | First output beat appears exactly N cycles after first input beat; verify alignment across a full packet |

---

## 4. Scoreboard and Golden Model

**A scoreboard is required** for non-trivial AXI-Stream DUTs. The scoreboard:
- Captures input beats in order
- Applies the expected transformation
- Compares each output beat against the expected result

For pure routing or FIFO DUTs, direct comparison of input vs. output beats is sufficient.

For processing DUTs (filters, transforms), a **golden model** is required:
- Inline reference function in the testbench (acceptable for simple operations)
- External Python golden model from the Python Modeling Agent (required for FIR, FFT, complex arithmetic)

The golden model handoff format mirrors the DSP pipeline profile (`dut_profile_dsp_pipeline.md`): `golden_model.py`, `test_vectors/`, `expected_outputs/`, and a tolerance specification.

---

## 5. Testbench Structure Conventions

```
module <dut>_axi_stream_tb;
    // Clocks
    logic aclk = 0;
    logic aresetn;
    always #5 aclk = ~aclk;

    // AXI-Stream signals
    logic         s_tvalid, s_tready, s_tlast;
    logic [W-1:0] s_tdata;
    logic         m_tvalid, m_tready, m_tlast;
    logic [W-1:0] m_tdata;

    // DUT instantiation

    // Tasks: send_packet(data[], len), recv_packet(data[], len)
    //        inject_stall(cycles), check_tdata, check_tlast

    // Scoreboard queue: expected_q

    initial begin
        // Reset
        // Tests: T-SINGLE, T-MULTI, T-TLAST, T-IN-BP, T-OUT-BP, ...
        // Summary
        $finish;
    end
endmodule
```

**Timing rule:** Drive `s_tvalid` and `s_tdata` on `negedge aclk`; sample `s_tready`, `m_tvalid`, `m_tdata` on `posedge aclk`.

---

## 6. Known Gaps at Profile Creation

This profile has not been exercised against a real DUT in this project. The following items should be validated against an actual AXI-Stream DUT before the profile is considered stable:

- Scoreboard implementation pattern
- Stall injection timing discipline
- tlast edge-case handling for 1-beat packets
- Interaction between AXI-lite config and stream reset

---

## 7. Common Hazards

| Hazard | Description |
|--------|-------------|
| Off-by-one tlast | tlast asserted one beat early or late; check with both even and odd packet lengths |
| Beat drop under backpressure | DUT drops a beat when tready is deasserted; scoreboard mismatch |
| tvalid still asserted after reset | DUT does not deassert tvalid cleanly on reset; causes spurious beat on next frame |
| Scoreboard alignment | Output is delayed by pipeline latency; scoreboard must account for this offset |

---

## 8. Likely Deferred Items

- Constrained-random packet generation
- AXI-Stream protocol checker (Synopsys/ARM VIP)
- Simultaneous multiple in-flight packets
- tuser/tkeep error injection
- CDC between stream clock and config clock

---

*Last updated: 2026-05-03*
*Applies to: DUT category CAT-4, RTL Verification Agent Phase v1 onward*
