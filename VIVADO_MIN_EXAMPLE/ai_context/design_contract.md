# Design Contract — simple_dma_add_ctrl

This document records the expected observable behavior of `rtl/simple_dma_add_ctrl.v` and its internal core `rtl/simple_dma_add_nword.v`, as verified in Phase v1.

---

## 1. AXI-Lite Register Interface

| Address | Name             | Access | Reset Default |
|---------|------------------|--------|---------------|
| 0x00    | CONTROL          | W/R    | 0x00000000    |
| 0x04    | SRC_ADDR         | R/W    | 0x00000000    |
| 0x08    | DST_ADDR         | R/W    | 0x00000000    |
| 0x0C    | LENGTH_WORDS     | R/W    | 0x00000000    |
| 0x10    | ADD_VALUE        | R/W    | 0x00000000    |
| 0x14    | STATUS           | RO     | 0x00000000    |
| 0x18    | PROCESSED_COUNT  | RO     | 0x00000000    |
| 0x1C    | LAST_INPUT_DATA  | RO     | 0x00000000    |
| 0x20    | LAST_OUTPUT_DATA | RO     | 0x00000000    |

Addresses outside `[0x00..0x20]` return `bresp=SLVERR` on write and `rresp=SLVERR, rdata=0x0` on read.

All three AXI-lite write orderings are supported:
- Simultaneous AW+W in the same cycle
- AW-before-W (W_WAIT_W path)
- W-before-AW (W_WAIT_A path)

---

## 2. STATUS Register Bit Layout

```
STATUS[31:3] = reserved (reads 0)
STATUS[2]    = busy   — 1 while DMA transfer is in progress
STATUS[1]    = error  — 1 if the last transfer encountered a read or write error
STATUS[0]    = done   — 1 (sticky) when a transfer completes; cleared by the next valid CONTROL.start
```

---

## 3. CONTROL Register

**Read:** Returns `{31'b0, busy_r}`. Reading CONTROL while busy returns 0x00000001. Reading while idle returns 0x00000000.

**Write:** `CONTROL[0]` = start. Writing 1 to bit0 while `busy_r=0` launches a new transfer using the current SRC_ADDR, DST_ADDR, LENGTH_WORDS, and ADD_VALUE values. Writing 1 while `busy_r=1` is accepted (returns OKAY) but is silently ignored — the running transfer is not interrupted.

---

## 4. SRC_ADDR / DST_ADDR / LENGTH_WORDS / ADD_VALUE

These are writable while the DMA is idle or busy. Writes are always accepted (return OKAY).

**Busy config write policy:** If these registers are written while a transfer is in-progress, the running transfer is unaffected because the DMA core latches all parameters at start time. New register values take effect on the next transfer triggered by CONTROL.start.

**LENGTH_WORDS:** Bits [15:0] specify the number of 32-bit words to transfer. Bits [31:16] are writable but only bits [15:0] are used by the DMA core.

---

## 5. PROCESSED_COUNT

Returns the number of words successfully written to the destination since the last CONTROL.start. Increments only on a write transaction that receives a B-channel OKAY response. After reset: 0. After a complete transfer: equals LENGTH_WORDS. After an aborted error transfer: equals the number of words successfully written before the error.

---

## 6. LAST_INPUT_DATA / LAST_OUTPUT_DATA

`LAST_INPUT_DATA`: The last 32-bit word read from the source address during the most recent transfer. Updated on every R-channel handshake, including the word that triggered a read error (the memory model returns 0x0 for out-of-range reads).

`LAST_OUTPUT_DATA`: The last 32-bit processed value (`last_input + ADD_VALUE`), purely combinatorial from the last input latch. Updated alongside LAST_INPUT_DATA.

After reset: both read 0x00000000.

---

## 7. Normal Add Transfer

A normal transfer:
1. Reads LENGTH_WORDS words sequentially from SRC_ADDR, SRC_ADDR+4, ... SRC_ADDR+(len-1)*4.
2. Adds ADD_VALUE to each word.
3. Writes each result to DST_ADDR, DST_ADDR+4, ... DST_ADDR+(len-1)*4.
4. On completion: STATUS.done=1, STATUS.error=0, STATUS.busy=0, PROCESSED_COUNT=LENGTH_WORDS, LAST_INPUT_DATA=last_src_word, LAST_OUTPUT_DATA=last_src_word+ADD_VALUE.

---

## 8. Identity Mode (ADD_VALUE = 0)

When ADD_VALUE=0, the DMA performs a plain copy: each destination word equals the corresponding source word. LAST_OUTPUT_DATA = LAST_INPUT_DATA. STATUS.error=0.

---

## 9. Overflow Wraparound

32-bit addition wraps silently. `0xFFFFFFFF + 1 = 0x00000000`. No error is generated. STATUS.error remains 0.

---

## 10. Read Error Behavior

If the AXI4 slave returns `rresp=SLVERR` for a read transaction:
- The transfer aborts immediately before the corresponding write.
- STATUS.error=1.
- PROCESSED_COUNT reflects the number of words successfully written before the error.
- LAST_INPUT_DATA = the SLVERR read data (0x0 from the memory model).
- LAST_OUTPUT_DATA = 0x0 + ADD_VALUE.
- Destination words for the failed and subsequent indices are not written.

---

## 11. Write Error Behavior

If the AXI4 slave returns `bresp=SLVERR` for a write transaction:
- The transfer aborts after the failed write response.
- STATUS.error=1.
- PROCESSED_COUNT reflects words successfully written before this write (does not count the failed word).
- LAST_INPUT_DATA = the input word of the failed write.
- LAST_OUTPUT_DATA = the processed value of the failed write.
- Subsequent words are not written.

---

## 12. Busy CONTROL.start Retrigger

Writing CONTROL.start=1 while STATUS.busy=1:
- Returns OKAY (AXI-lite write is accepted).
- The running transfer continues unaffected.
- The start pulse is ignored; no second transfer is queued.
- STATUS.busy remains 1 until the current transfer completes.

---

## 13. Busy Config Register Write Policy

Writing SRC_ADDR, DST_ADDR, LENGTH_WORDS, or ADD_VALUE while STATUS.busy=1:
- Returns OKAY (write accepted).
- The running transfer uses its latched parameters (captured at CONTROL.start time) and is unaffected.
- After transfer completion, registers read back the new written values.
- The next CONTROL.start uses the new register values.

---

## 14. Zero-Length Transfer

When LENGTH_WORDS=0:
- The transfer completes in approximately 3 cycles without issuing any AXI transactions.
- STATUS.done=1, STATUS.error=0, PROCESSED_COUNT=0.
- No source reads or destination writes occur.
- LAST_INPUT_DATA and LAST_OUTPUT_DATA are unchanged from the previous transfer.

---

## 15. Restart After Normal Completion

After a completed transfer (STATUS.done=1, STATUS.busy=0):
- Writing new SRC_ADDR/DST_ADDR/LENGTH_WORDS/ADD_VALUE programs the next transfer.
- Writing CONTROL.start=1 clears STATUS.done, sets STATUS.busy=1, and launches a new transfer.
- Fresh configuration takes effect on the new transfer. Previous results are not preserved.

---

## 16. Restart After Error

After an error transfer (STATUS.error=1, STATUS.done=1):
- Writing new configuration and CONTROL.start=1 launches a clean transfer.
- No stale error state affects the new transfer.
- STATUS.error is cleared by the next CONTROL.start.

---

## 17. Reset During Transfer

Asserting `aresetn=0` while a transfer is in-progress:
- Immediately resets all AXI-lite visible registers to 0x00000000.
- Clears busy_r, done_r, error_r, processed_count_r, last_input_r, last_output_r.
- The DMA core (simple_dma_add_nword) is also held in reset; any in-flight AXI transaction may terminate abnormally.
- Zero or more destination words may have already been written before reset — this is acceptable and not treated as an error.
- Destination words outside the programmed range are not affected by the aborted transfer.
- Canary words adjacent to the destination region are not overwritten.

---

## 18. Post-Reset Register Defaults

After `aresetn` deasserts:

| Register         | Value      |
|------------------|------------|
| CONTROL          | 0x00000000 |
| SRC_ADDR         | 0x00000000 |
| DST_ADDR         | 0x00000000 |
| LENGTH_WORDS     | 0x00000000 |
| ADD_VALUE        | 0x00000000 |
| STATUS           | 0x00000000 |
| PROCESSED_COUNT  | 0x00000000 |
| LAST_INPUT_DATA  | 0x00000000 |
| LAST_OUTPUT_DATA | 0x00000000 |

The DUT is immediately ready to accept fresh register programming and a new CONTROL.start.

---

## 19. Memory / Canary Integrity

The DMA writes only to `[DST_ADDR, DST_ADDR + (LENGTH_WORDS-1)*4]`. All memory words outside this range are unaffected, including:
- Words at DST_ADDR - 4 (canary before destination).
- Words at DST_ADDR + LENGTH_WORDS*4 (canary after destination).
- Source memory (read-only from the DMA's perspective).

---

*Last updated: 2026-05-03*
*Applies to: rtl/simple_dma_add_ctrl.v + rtl/simple_dma_add_nword.v, Phase v1*
