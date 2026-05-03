# DUT Category Taxonomy — RTL Verification Agent

## 1. Why Categorization Is Necessary

The RTL Verification Agent is **not fully DUT-agnostic**. It is **contract-driven**: it verifies a DUT against a declared design contract, using a testbench structure appropriate for that DUT's interface and behavior.

A DUT with an AXI-lite register interface needs write-ordering and backpressure tests. A DSP pipeline needs golden vector comparison and numerical tolerance checks. A CDC FIFO needs pointer-wrap and cross-domain reset tests. These test patterns are category-specific.

A new DUT requires:
1. Identification of its category from this taxonomy
2. Selection or creation of a matching **DUT verification profile** (see `dut_profile_*.md`)
3. A **design contract** document declaring expected behavior
4. A testbench structured around the profile's mandatory test list

Without a category and profile, the agent cannot determine what constitutes a complete verification campaign for that DUT.

---

## 2. Category Decision Tree

```
Is the DUT memory-mapped (AXI-lite registers)?
  └─ Yes → AXI-lite peripheral or AXI-lite controlled DMA/accelerator
       └─ Does it also initiate AXI master transactions?
             └─ Yes → AXI-lite controlled DMA accelerator  ← validated in Phase v1
             └─ No  → AXI-lite peripheral

Does the DUT process a continuous stream of samples?
  └─ Yes, with tvalid/tready → AXI-stream block
  └─ Yes, arithmetic/math pipeline → DSP pipeline

Is there more than one clock domain?
  └─ Yes → CDC / FIFO block  (formal/SVA recommended)

Is the DUT an OFDM or communications processing chain?
  └─ Yes → OFDM / communications block  (requires Python Modeling Agent handoff)

Is board-level evidence required?
  └─ Yes → FPGA board-level test target  (Agent 5 scope)
```

---

## 3. Category Reference

---

### CAT-1: AXI-lite Peripheral

**Typical interface:** AXI-lite slave only (no master ports). Memory-mapped register bank.

**Typical behavior:** Software programs registers over AXI-lite; DUT performs combinatorial or registered computation; software reads results from status registers.

**Required contract items:**
- Register map (addresses, reset defaults, access types)
- Invalid address policy (SLVERR expected)
- Write ordering support (simultaneous, AW-first, W-first)
- WSTRB/byte-enable behavior
- Read-only vs. read-write register classification

**Mandatory tests:**
- Reset defaults
- Write/readback all registers
- Partial WSTRB byte-lane writes
- AW-before-W ordering
- W-before-AW ordering
- Simultaneous AW+W
- Invalid address SLVERR (write and read)
- B-channel backpressure
- R-channel backpressure

**Common hazards:**
- TB/DUT timing race (negedge-drive / posedge-sample rule)
- Wrong bit index in STATUS field
- Incorrect invalid address boundary condition

**Likely deferred:** Formal register access correctness, burst support, multiple outstanding transactions

---

### CAT-2: AXI Master / DMA (bare)

**Typical interface:** AXI4 master (no AXI-lite slave). Control via direct RTL ports (start, src_addr, dst_addr, length, done, error).

**Typical behavior:** Initiated by a start pulse; reads from source address, processes or copies, writes to destination address; asserts done on completion; asserts error on AXI error response.

**Required contract items:**
- Source/destination address semantics
- Length semantics (words vs. bytes)
- Error abort behavior
- Count semantics (words successfully written)
- Last-data output behavior if applicable

**Mandatory tests:**
- Single-word transfer
- Multi-word transfer
- Read error abort
- Write error abort
- Zero-length
- Restart after error

**Common hazards:**
- Reset timing between start pulse and done observation
- Off-by-one in address increment
- Error flag not cleared on fresh start

**Likely deferred:** Burst, multiple outstanding, scatter-gather

---

### CAT-3: AXI-lite Controlled DMA Accelerator *(validated — Phase v1)*

See `dut_profile_axil_dma_accelerator.md` for the full profile.

**Typical interface:** AXI-lite slave + AXI4 master.

**Typical behavior:** Software programs a register bank over AXI-lite, writes CONTROL.start, polls STATUS.done.

**Key additions over CAT-2:** Full AXI-lite register interface protocol (ordering, backpressure, invalid address), busy retrigger guard, config-write-while-busy policy, reset-during-transfer.

---

### CAT-4: AXI-Stream Block

**Typical interface:** AXI-Stream slave input (s_axis_*) and/or AXI-Stream master output (m_axis_*). Optional AXI-lite config slave.

**Typical behavior:** Processes or routes a continuous stream of data beats. May operate on packets delimited by tlast.

**Required contract items:**
- tdata width, tvalid/tready handshake policy
- tlast semantics (packet boundary vs. frame end)
- tkeep/tstrb/tuser usage if present
- Latency from input to output
- Backpressure propagation (does output stall propagate to input?)
- Drop/overflow policy if tready is not always asserted

**Mandatory tests:**
- Single beat through the block
- Multi-beat packet; tlast on last beat
- Correct tlast position
- Input-side backpressure (output not ready)
- Output-side backpressure (downstream not consuming)
- Random tvalid/tready stall injection
- Reset mid-packet; verify clean recovery

**Scoreboard / golden model:** A reference model (inline or external) is required for non-trivial transforms. Pure routing/FIFO blocks may use direct comparison.

**Common hazards:**
- Off-by-one in beat count; tlast one beat early or late
- Stall handling drops a beat silently
- Reset state leaves tvalid/tlast asserted

**Likely deferred:** Constrained-random packet generation, AXI-stream protocol checker, CDC between stream clock and config clock

---

### CAT-5: DSP Pipeline

**Typical interface:** Registered input samples (re/im or scalar), registered output results, optional valid/ready or CE (clock enable) signals. Optional AXI-lite coefficient interface.

**Typical behavior:** Performs a deterministic arithmetic transformation with a fixed pipeline latency. Examples: FIR filter, FFT stage, complex multiply, NCO.

**Required contract items:**
- Input/output data format (integer bit width, fractional bits)
- Fixed-point rounding and saturation policy
- Pipeline latency (input-to-output clock cycles)
- Valid/ready or enable semantics
- Frame length if applicable
- Coefficient update behavior
- Reset behavior

**Mandatory tests:**
- Golden vector comparison (reference output from Python Modeling Agent)
- Impulse input (verifies transfer function shape)
- All-zero input (verifies no spurious output)
- Max/min input values (verifies saturation)
- Latency alignment (verify output appears exactly N cycles after input)
- Reset during frame
- Coefficient/config update

**Python Modeling Agent handoff expected:**
- `golden_model.py` — generates reference output
- `test_vectors/` — input stimuli files
- `expected_outputs/` — expected result files
- Tolerance specification — maximum allowable bit error or SNR floor

**Common hazards:**
- Latency miscounted by one; scoreboard misaligned
- Truncation vs. round-half-up vs. round-to-even inconsistency
- Saturation not triggered at boundary values

**Likely deferred:** Constrained-random functional coverage, SNR measurement, FPGA board validation

---

### CAT-6: CDC / FIFO Block

**Typical interface:** Write port (wr_clk domain: wr_en, wr_data, full) and read port (rd_clk domain: rd_en, rd_data, empty). Optional almost_full / almost_empty flags.

**Typical behavior:** Asynchronous FIFO bridging two clock domains; guarantees in-order data delivery; asserts full/empty flags; behavior on overflow/underflow is design-specific (drop, assert, wrap).

**Required contract items:**
- Write clock and read clock (may be same for synchronous smoke)
- Reset policy (synchronous vs. asynchronous; per-clock-domain reset)
- Depth (number of entries)
- Data width
- Full/empty assertion timing (registered or combinatorial)
- Almost full/empty threshold if present
- Overflow behavior (drop, assert wr_overflow, undefined)
- Underflow behavior (assert rd_underflow, undefined)
- Ordering guarantee (FIFO, not LIFO)
- Gray code or binary pointer synchronization assumptions

**Mandatory tests:**
- Same-clock smoke (if synchronous mode supported)
- Write faster than read (different ratios)
- Read faster than write
- Fill to full; verify full asserted; attempt overflow
- Drain to empty; verify empty asserted; attempt underflow
- Pointer wrap (write/read more than depth entries)
- Reset during non-empty FIFO; verify empty after reset
- Back-to-back write then back-to-back read

**Formal/SVA recommendation:** Functional simulation alone is insufficient for serious CDC confidence. Gray-code pointer synchronization correctness and metastability protection are properties that benefit from formal verification or independent CDC analysis tools. This agent flags CDC blocks as requiring SVA or formal review beyond directed simulation.

**Common hazards:**
- Gray code decode error at pointer boundary
- Read data one cycle late due to registered empty flag
- Reset synchronizer not properly handled; pointer mismatch after reset

**Likely deferred:** Metastability injection, MTBF analysis, formal CDC verification

---

### CAT-7: OFDM / Communications Block

**Typical interface:** Complex sample stream input (I/Q), complex sample stream or demodulated symbol output. Optional AXI-lite config/status slave.

**Typical behavior:** Performs DSP-based modulation or demodulation (FFT, IFFT, CP insertion/removal, channel estimation, equalization, CFO correction, etc.).

**Required contract items:** Same as CAT-5 (DSP pipeline), plus:
- Complex arithmetic format (separate I/Q or interleaved)
- FFT size
- Cyclic prefix length
- Pilot pattern if applicable
- CFO/SNR tolerance for the test environment

**Mandatory tests:** Same as CAT-5, plus:
- Multi-symbol sequence
- CFO/channel impairment tolerance (if correction is in-scope)
- Adjacent-symbol interference check

**Python Modeling Agent handoff is required** for this category. The reference model is non-trivial and must precede RTL design.

**Likely deferred:** Over-the-air testing, hardware channel impairment, multi-antenna configurations

---

### CAT-8: FPGA Board-Level Test Target

**Scope:** Agent 5 (FPGA Test Agent), not Agent 4 (RTL Verification Agent).

The RTL Verification Agent hands off to the FPGA Test Agent after simulation closure. Board-level evidence (UART, ILA, hardware DMA loopback) is outside the scope of this protocol.

---

*Last updated: 2026-05-03*
*Applies to: RTL Verification Agent (Agent 4)*
