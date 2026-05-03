# DUT Profile: CDC / FIFO Block

**Category:** CAT-6 (CDC / FIFO Block)
**Validation status:** Not yet verified — profile only
**Example DUTs:** Async FIFO, synchronous FIFO, clock-domain crossing handshake, gray-code pointer FIFO

---

## 1. Profile Purpose

This profile applies to DUTs that buffer data between producer and consumer, particularly when the two sides operate at different clock rates or in different clock domains.

**Applicable DUTs:**
- Asynchronous FIFO (gray-code pointer synchronization)
- Synchronous FIFO (single clock, registered full/empty)
- Dual-clock register file
- Pulse synchronizer / toggle synchronizer
- CDC handshake bridge

---

## 2. Required Design Contract Fields

| Field | Description |
|-------|-------------|
| Write clock | Source clock domain for write port; frequency if known |
| Read clock | Destination clock domain for read port; frequency if known |
| Reset policy | Synchronous vs. asynchronous reset; per-domain reset vs. global reset |
| Depth | Number of data entries; power-of-two required for gray-code pointer FIFO |
| Data width | Bits per entry |
| Full flag | Timing: registered (1 cycle before full) or combinatorial (same cycle); exact threshold |
| Empty flag | Same; exact threshold |
| Almost full / almost empty | Threshold if present; used for flow control upstream/downstream |
| Overflow policy | Write while full: data dropped silently; error flag asserted; undefined |
| Underflow policy | Read while empty: data output undefined; error flag asserted; undefined |
| Ordering guarantee | FIFO (first-in first-out); data arrives at read port in write order |
| Gray code pointer sync | Number of synchronizer stages (typically 2); metastability protection model |
| Reset crossing | Are both clocks running during reset? Are write and read resets independent? |

---

## 3. Mandatory Test List

| # | Scenario | Key Checks |
|---|----------|------------|
| T-SYNC-SMOKE | Same-clock smoke (if applicable) | Write N entries; read N entries; verify all data in order; full/empty flags correct |
| T-WR-FAST | Write faster than read | Write at full rate; read at half rate; no data loss; full asserted before overflow |
| T-RD-FAST | Read faster than write | Read at full rate; write at half rate; empty asserted; no underflow |
| T-FULL | Fill to full | Write exactly depth entries; verify full asserted; attempt one more write; verify overflow behavior per design contract |
| T-EMPTY | Drain to empty | Read all entries; verify empty asserted; attempt one more read; verify underflow behavior per design contract |
| T-WRAP | Pointer wrap | Write and read more than depth entries total; verify pointers wrap correctly; verify no data corruption |
| T-RST-NONEMPTY | Reset during non-empty FIFO | Fill FIFO partway; assert reset; verify empty after reset deassert; verify old data not readable |
| T-BURST-WR-RD | Back-to-back write then back-to-back read | Fill entire FIFO; then drain entire FIFO; verify all entries correct and in order |
| T-CLK-RATIO-A | Fast write, slow read (ratio ≥ 4) | High-rate burst write; slow drain; no overflow if depth is sufficient; verify data |
| T-CLK-RATIO-B | Slow write, fast read (ratio ≥ 4) | Low-rate write; burst read; no underflow after write completes |

---

## 4. Formal / SVA Recommendation

**Functional simulation alone is insufficient for serious CDC confidence.**

The gray-code pointer synchronization scheme prevents data corruption from metastability, but only if the implementation is correct. The following properties benefit from formal verification or dedicated CDC analysis tools:

- **Pointer monotonicity:** Write pointer never decreases; read pointer never decreases.
- **Full/empty flag correctness:** Full is asserted if and only if write_ptr − read_ptr = depth; empty if and only if write_ptr = read_ptr (gray code comparison).
- **No data overwrite:** A write never overwrites a valid entry; read pointer is not behind write pointer by more than depth.
- **Reset correctness:** After reset, both pointers are 0 in their respective clock domains, regardless of what was in-flight.

**This profile flags CDC FIFO DUTs as requiring SVA properties or formal review beyond directed simulation.** Directed tests verify functional correctness under nominal conditions. They do not cover metastability windows, glitching during reset crossing, or race conditions at the synchronizer boundary.

Tools that can supplement directed simulation:
- Synopsys CDC Compiler / SpyGlass CDC
- Cadence JasperGold
- Custom SVA assertions on pointer logic

---

## 5. Testbench Structure Conventions

```
module <dut>_fifo_tb;
    // Independent write and read clocks
    logic wr_clk = 0;
    logic rd_clk = 0;
    always #(WR_HALF_PERIOD) wr_clk = ~wr_clk;
    always #(RD_HALF_PERIOD) rd_clk = ~rd_clk;

    logic wr_rst_n, rd_rst_n;

    // Write port
    logic              wr_en;
    logic [WIDTH-1:0]  wr_data;
    logic              full;

    // Read port
    logic              rd_en;
    logic [WIDTH-1:0]  rd_data;
    logic              empty;

    // DUT instantiation

    // Tasks: fifo_write(data), fifo_read(data), fill_n(n), drain_n(n)

    initial begin
        // Reset both domains
        // T-SYNC-SMOKE, T-FULL, T-EMPTY, T-WRAP, T-RST-NONEMPTY, ...
        // Summary
        $finish;
    end
endmodule
```

**Multi-clock timing:** Write-domain signals are driven and sampled relative to `wr_clk`. Read-domain signals are driven and sampled relative to `rd_clk`. The testbench must not use `@(posedge wr_clk)` to check `rd_data` without accounting for synchronization latency.

**Pointer synchronization latency:** After a write, the updated write pointer takes 2+ `rd_clk` cycles to propagate to the read domain. The read side sees `empty` deasserted one pointer-sync-latency after the write. Testbench must wait for this propagation before reading.

---

## 6. Common Hazards

| Hazard | Description |
|--------|-------------|
| Full flag one cycle early | Registered full flag is asserted one write cycle before depth is reached; off-by-one test fills depth-1 entries |
| Empty deasserted late | Read side sees empty for 1–2 extra cycles after write; read before then causes underflow |
| Pointer wrap overflow | If depth is not a power of two, gray-code wrap is non-trivial; pointer mismatch at boundary |
| Reset not crossing correctly | Write reset is released before read reset; write pointer updates while read pointer is still in reset; mismatch |
| Data read before write fully committed | For very fast read clocks, data is read before the write clock domain has published the write pointer |

---

## 7. Likely Deferred Items

- Metastability injection (requires specialized simulation tools)
- MTBF analysis
- Formal verification of gray-code pointer logic
- CDC analysis tool integration
- Simultaneous concurrent reads and writes at the same address (coverage edge case)
- FPGA board measurement of FIFO latency under load

---

*Last updated: 2026-05-03*
*Applies to: DUT category CAT-6, RTL Verification Agent Phase v1 onward*
