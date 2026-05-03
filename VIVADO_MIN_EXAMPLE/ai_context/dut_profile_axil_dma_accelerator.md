# DUT Profile: AXI-lite Controlled DMA Accelerator

**Category:** CAT-3 (AXI-lite Controlled DMA Accelerator)
**Validation status:** Verified — Phase v1 benchmark
**Reference DUT:** `rtl/simple_dma_add_ctrl.v` + `rtl/simple_dma_add_nword.v`

---

## 1. Profile Purpose

This profile applies to any DUT that:
- Exposes a memory-mapped register interface over AXI-lite (slave)
- Initiates AXI4 master transactions to read a source buffer and write a destination buffer
- Performs an optional processing operation on each word
- Reports transfer status through readable status registers

**Applicable DUTs:**
- AXI-lite controlled DMA (plain copy)
- AXI-lite controlled DMA add engine *(validated)*
- Memory-mapped FIR accelerator
- Memory-mapped CFO correction block
- Memory-mapped complex multiply/scale block
- Any future processing accelerator with the pattern: program → start → poll done → read results

---

## 2. Required Design Contract Fields

Before verification begins, the design contract (`ai_context/design_contract.md`) must declare:

| Field | Description |
|-------|-------------|
| Register map | Address, name, access type (R/W/RO/W1S), reset default for every register |
| Invalid address policy | Address range that returns SLVERR; whether data is written on SLVERR write |
| CONTROL register | Write semantics (W1S start); read semantics (reads busy_r or 0) |
| STATUS register | Bit layout: which bit is done, which is error, which is busy |
| SRC_ADDR / DST_ADDR | Byte address of source/destination; alignment assumptions |
| LENGTH_WORDS | Units (words or bytes); maximum value; effect of zero |
| Processing operation | What transformation is applied to each word |
| ADD_VALUE or equivalent | Operand semantics; overflow behavior |
| PROCESSED_COUNT | When incremented; value after error; value after reset |
| LAST_INPUT_DATA | What word it holds; when updated; value on error; value after reset |
| LAST_OUTPUT_DATA | What processed value it holds; same as above |
| Busy retrigger policy | What happens when CONTROL.start is written while busy |
| Config-write-while-busy policy | Whether SRC/DST/LEN/ADD accept writes during transfer; when new values take effect |
| Zero-length behavior | What STATUS/COUNT show for LENGTH_WORDS=0 |
| Error abort behavior | Which errors abort; whether partial count is valid after error |
| Reset behavior | Which registers reset to 0; whether DMA core resets mid-transfer |
| Restart-after-completion | Whether done is cleared on next start |
| Restart-after-error | Whether error is cleared on next start |

---

## 3. Mandatory Test List

All of the following test scenarios must be covered before verification is considered closed for this profile:

| # | Scenario | Key Checks |
|---|----------|------------|
| T-REG | Register read/write sanity | Write/readback all R/W registers; verify reset defaults for RO registers |
| T-INVADDR | Invalid address SLVERR | Write and read to out-of-range address; verify SLVERR; verify no alias |
| T-NORM1 | 1-word normal transfer | STATUS.done, error, COUNT, LAST_IN, LAST_OUT, dst[0] |
| T-NORM-N | Multi-word normal transfer | All dst words, LAST_IN, LAST_OUT, COUNT |
| T-IDENT | Identity mode (if applicable) | Processing operand=identity value; dst=src |
| T-OVF | Overflow wraparound (if applicable) | Max_value + 1 = 0; no error |
| T-ZLEN | Zero-length transfer | done=1, error=0, count=0; no AXI traffic to memory |
| T-ERR-R | Invalid source address | error=1; partial count correct; dst beyond error not written |
| T-ERR-W | Invalid destination address | error=1; partial count correct; canary after dst unchanged |
| T-BUSY-RD | Busy-state register read | STATUS.busy=1 readable during active transfer |
| T-BUSY-TRIG | Busy retrigger guard | Second CONTROL.start while busy is silently ignored |
| T-BUSY-CFG | Config write while busy | SRC/DST/LEN/operand accepts write while busy; DMA uses latched values; new values readable after done |
| T-ERR-RESTART | Restart after error | Fresh transfer after error completes cleanly; stale error cleared |
| T-RST-XFR | Reset during transfer | busy=1 pre-reset; all registers=0 post-reset; canaries intact |
| T-RST-RECOVER | Post-reset fresh transfer | Full transfer works after reset release |
| T-REPEAT | Repeated normal restart | ≥5 sequential transfers with distinct configs; each result fully verified |
| T-SMOKE | Lightweight valid-transfer smoke | ≥10 iterations; deterministic varying length and operand |
| T-WO-AW | AW-before-W ordering | Config write via W_WAIT_W path; correct data in register |
| T-WO-W | W-before-AW ordering | Config write via W_WAIT_A path; correct data in register |
| T-BP-B | B-channel backpressure | bready delayed N cycles; bvalid held asserted per cycle; OKAY and SLVERR tested |
| T-BP-R | R-channel backpressure | rready delayed N cycles; rvalid held, rdata stable, rresp stable per cycle; all readable registers tested |

---

## 4. Testbench Structure Conventions

```
module <dut>_tb;
    // Clock + reset
    logic aclk = 0;
    logic aresetn;
    always #5 aclk = ~aclk;  // 10ns period

    // DUT + AXI memory model instantiation

    // Check helpers: check_eq, check_bit, check_resp
    // AXI-lite tasks: axil_write32, axil_write_aw_first, axil_write_w_first
    //                 axil_write_bready_delay, axil_read32, axil_read_rready_delay
    // DMA helpers: start_transfer, poll_done

    initial begin
        // Seed memory
        // Reset
        // Tests 1..N
        // Summary: [PASS]/[FAIL] <module> <N>/<N> checks passed
        $finish;
    end
endmodule
```

**AXI timing rule:** Drive AXI signals on `negedge aclk`; sample DUT ready/valid on `posedge aclk`.

---

## 5. Closure Evidence

Verification for this profile is closed when the following evidence is present:

| Evidence | Location |
|----------|----------|
| All 21 mandatory test scenarios PASS | Simulation log |
| Check count matches expected | `ai_context/current_status.md` |
| CI grep gate exit code 0 | Simulation script output |
| Design contract documented | `ai_context/design_contract.md` |
| Verification matrix entries | `ai_context/verification_matrix.md` |
| Known limitations documented | `ai_context/known_limitations.md` |
| Closure criteria documented | `ai_context/verification_closure_criteria.md` |
| Final summary | `ai_context/final_verification_summary.md` |

---

## 6. Phase v1 Benchmark Results

The following results were achieved for `simple_dma_add_ctrl`:

| Metric | Value |
|--------|-------|
| Total checks | 691/691 PASS |
| CI gate | PASS |
| Simulation end time | 16140 ns |
| All 21 mandatory scenarios | PASS |
| Closure documents | Complete |

All mandatory test scenarios in §3 above are covered by Tests 1–18 in `tb/simple_dma_add_ctrl_tb.sv`.

---

*Last updated: 2026-05-03*
*Applies to: DUT category CAT-3, RTL Verification Agent Phase v1 onward*
