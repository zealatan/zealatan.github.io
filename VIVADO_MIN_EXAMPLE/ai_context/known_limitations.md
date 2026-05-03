# Known Limitations — DMA/AXI Verification Phase v1

This document records limitations that were intentionally deferred from the v1 verification phase. Each item is not a defect; it defines the boundary of what v1 claims to verify.

---

## 1. Verification Methodology Limitations

### 1.1 No UVM Environment
All testbenches are directed, self-checking SystemVerilog. There is no UVM agent, sequencer, monitor, scoreboard, or coverage collector. Stimulus is deterministic and hand-crafted per prompt.

### 1.2 No Constrained-Random Coverage-Driven Verification
Functional coverage metrics (`covergroup`, `coverpoint`) are not implemented. There are no coverage closure criteria driven by automatic randomization. The deterministic smoke tests (Test 16 in simple_dma_add_ctrl_tb) provide structured iteration but are not equivalent to constrained-random verification.

### 1.3 No Formal Verification
No SVA property checking, model checking, or equivalence checking has been performed. Properties such as "PROCESSED_COUNT never exceeds LENGTH_WORDS" or "STATUS.busy is never set while done=1" are verified only through directed test stimulus, not formal proof.

---

## 2. Protocol / Feature Scope Limitations

### 2.1 No Full AXI4 Burst Support
All AXI4 transactions are single-beat (AxLEN=0). Burst transfers (AxLEN>0), fixed/wrap burst types, and narrow/unaligned transfers are not implemented or tested. The AXI4 memory model accepts single-beat only; WLAST is accepted at the port but not enforced.

### 2.2 No Multiple Outstanding AXI Transactions
The DMA master issues one AXI transaction at a time (read before write, one word per cycle). Out-of-order responses, ID interleaving, and multiple in-flight transactions are not exercised.

### 2.3 No Scatter-Gather Descriptor Support
All transfers use a single contiguous source and destination region. Linked-list descriptors, descriptor rings, and chain-mode DMA are not implemented or tested.

### 2.4 No 4KB Boundary Split Support
No test verifies that the DMA correctly handles or avoids AXI 4KB boundary crossings. Transfers that span a 4KB boundary are not tested.

### 2.5 No AXI4 Protocol Compliance Checker
No commercial or open-source AXI protocol checker (e.g., Synopsys VIP, ARM AXI checkers) is connected. Protocol correctness is inferred from functional test results only.

---

## 3. Design Scope Limitations

### 3.1 Misaligned Address Behavior
Behavior for source or destination addresses that are not 4-byte aligned has not been explicitly verified. The current RTL processes addresses as byte addresses with 4-byte-aligned assumptions implied by the sequential word-stride address increment (`addr + 4*i`). Misaligned-address scenarios are deferred.

### 3.2 Source/Destination Overlap Behavior
Transfer behavior when the source and destination regions overlap (i.e., `dst_addr` is within `[src_addr, src_addr + len*4 - 1]`) has not been tested. The RTL processes words sequentially and would likely produce partially overwritten results, but this is neither documented as a design contract nor tested.

### 3.3 Zero-Length Transfer Edge Cases
Zero-length transfers (LENGTH_WORDS=0) are tested and produce immediate completion with done=1, error=0, count=0. No attempt is made to write any destination word. However, zero-length transfers with deliberately invalid addresses are not separately tested — the DMA exits before any AXI transaction is attempted, so invalid-address behavior during zero-length is untested.

### 3.4 Reset Timing — Exact Pre-Reset Progress
Tests that assert reset mid-transfer do not verify the exact number of destination words written before reset. Reset timing is treated as implementation-dependent. The test verifies: (a) no writes occur outside the designated destination region, (b) all registers are at reset defaults after release, and (c) the DUT is functional after reset. The number of partial beats completed is intentionally not asserted.

---

## 4. Physical / Integration Limitations

### 4.1 No CDC Verification
All RTL operates on a single clock domain (`aclk`). Clock-domain crossing (CDC) analysis has not been performed. No synchronizers are present or tested.

### 4.2 No Synthesis or Timing Closure
The RTL has been verified in Vivado xsim (functional simulation only). No synthesis, place-and-route, or static timing analysis has been performed. Timing constraints, maximum clock frequency, and logic utilization are unknown.

### 4.3 No FPGA Board Validation
No hardware test has been performed. All verification is simulation-only. FPGA board bring-up, UART, ILA, and hardware DMA loopback tests are deferred to Phase v2 (FPGA Test Agent).

---

## 5. Documentation Completeness

- No automated coverage report is generated. Coverage evidence is the check-count summary in `ai_context/current_status.md` and `ai_context/final_verification_summary.md`.
- No waveform review was performed as part of the verification sign-off process.
- Simulation VCD files are generated but were not reviewed for protocol-level correctness beyond check pass/fail.

---

*Last updated: 2026-05-03*
*Applies to: DMA/AXI Verification Phase v1 (Prompts 1–25)*
