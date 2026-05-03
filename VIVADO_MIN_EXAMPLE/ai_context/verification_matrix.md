# Verification Matrix — DMA/AXI Phase v1

All entries are verified by directed simulation using Vivado xsim. Status = PASS means the associated testbench check(s) passed on the final simulation run recorded in `ai_context/current_status.md`.

---

| ID  | Module                       | Category               | Scenario                                             | Prompt | Test / Evidence                              | Status |
|-----|------------------------------|------------------------|------------------------------------------------------|--------|----------------------------------------------|--------|
| V01 | axi_lite_regfile             | Register access        | Reset defaults — all 4 registers read 0              | P01    | axi_lite_regfile_tb T1 (reset)               | PASS   |
| V02 | axi_lite_regfile             | Register access        | Write/readback all 4 registers with unique values    | P01    | axi_lite_regfile_tb T2–T4                    | PASS   |
| V03 | axi_lite_regfile             | Register access        | Partial WSTRB byte-lane writes                       | P01    | axi_lite_regfile_tb T5/T5b                   | PASS   |
| V04 | axi_lite_regfile             | Write ordering         | AW-before-W (W_WAIT_W path)                          | P01    | axi_lite_regfile_tb T6                       | PASS   |
| V05 | axi_lite_regfile             | Write ordering         | W-before-AW (W_WAIT_A path)                          | P01    | axi_lite_regfile_tb T7                       | PASS   |
| V06 | axi_lite_regfile             | Invalid address        | 0x10 returns SLVERR; no register aliased             | P01    | axi_lite_regfile_tb T8                       | PASS   |
| V07 | axi_lite_regfile             | Invalid address        | Sweep 0x10–0x3C all return SLVERR on write/read      | P01    | axi_lite_regfile_tb T12–T14                  | PASS   |
| V08 | axi_lite_regfile             | B-channel backpressure | bready delayed; bvalid held; SLVERR under delay      | P01    | axi_lite_regfile_tb T10                      | PASS   |
| V09 | axi_lite_regfile             | R-channel backpressure | rready delayed; rvalid held; SLVERR under delay      | P01    | axi_lite_regfile_tb T11                      | PASS   |
| V10 | axi_mem_model                | Memory access          | Full-word write/readback at two addresses            | P02    | mem_rw_tb T1                                 | PASS   |
| V11 | axi_mem_model                | Memory access          | Multiple addresses with unique values                | P02    | mem_rw_tb T2                                 | PASS   |
| V12 | axi_mem_model                | Memory access          | Partial WSTRB byte-lane writes                       | P02    | mem_rw_tb T3                                 | PASS   |
| V13 | axi_mem_model                | Memory access          | Read from unwritten address returns 0                | P02    | mem_rw_tb T4                                 | PASS   |
| V14 | simple_axi_master            | Master operation       | Single write/readback; round-trip verify             | P03    | simple_axi_master_tb T1                      | PASS   |
| V15 | simple_axi_master            | Master operation       | Three transactions with distinct addresses/data      | P03    | simple_axi_master_tb T2                      | PASS   |
| V16 | simple_axi_master            | Error handling         | Out-of-range address — done=1, error=1               | P03    | simple_axi_master_tb T3                      | PASS   |
| V17 | simple_dma_copy              | DMA basic              | 1-word copy; verify copied_data and dst              | P04    | simple_dma_copy_tb T1–T2                     | PASS   |
| V18 | simple_dma_copy              | Error handling         | Invalid src — error=1, dst unchanged                 | P04    | simple_dma_copy_tb T3                        | PASS   |
| V19 | simple_dma_copy              | Error handling         | Invalid dst — error=1, copied_data=src, canary ok    | P04    | simple_dma_copy_tb T4                        | PASS   |
| V20 | simple_dma_copy_nword        | N-word copy            | len=0 — done immediately, count=0                   | P05    | simple_dma_copy_nword_tb T1                  | PASS   |
| V21 | simple_dma_copy_nword        | N-word copy            | len=1 and len=4 — all dst words verified             | P05    | simple_dma_copy_nword_tb T2–T3               | PASS   |
| V22 | simple_dma_copy_nword        | Error handling         | Invalid src mid-copy — partial count, dst[3] ok      | P05    | simple_dma_copy_nword_tb T4                  | PASS   |
| V23 | simple_dma_copy_nword        | Error handling         | Invalid dst mid-copy — partial count, canary ok      | P05    | simple_dma_copy_nword_tb T5                  | PASS   |
| V24 | simple_dma_ctrl              | Register access        | All 6 registers write/readback; invalid addr SLVERR  | P06    | simple_dma_ctrl_tb T1–T3                     | PASS   |
| V25 | simple_dma_ctrl              | DMA transfer           | 4-word copy with STATUS/count/dst verified           | P06    | simple_dma_ctrl_tb T1                        | PASS   |
| V26 | simple_dma_ctrl              | Write ordering         | AW-first and W-first for SRC/LEN/DST/CTRL            | P06    | simple_dma_ctrl_tb T6                        | PASS   |
| V27 | simple_dma_ctrl              | Invalid address        | 0x40 AW-first, 0x50 W-first — both SLVERR           | P06    | simple_dma_ctrl_tb T7                        | PASS   |
| V28 | simple_dma_ctrl              | B-channel backpressure | 3-cycle bready delay; bvalid held; SLVERR under delay| P06    | simple_dma_ctrl_tb T8                        | PASS   |
| V29 | simple_dma_ctrl              | R-channel backpressure | 3-cycle rready delay; rvalid/rdata/rresp stable      | P06    | simple_dma_ctrl_tb T9                        | PASS   |
| V30 | simple_dma_ctrl              | Busy state             | STATUS/COPIED_COUNT read while DMA in-flight         | P06    | simple_dma_ctrl_tb T10                       | PASS   |
| V31 | simple_dma_ctrl              | Busy retrigger         | Second CONTROL.start while busy — silently ignored   | P06    | simple_dma_ctrl_tb T11                       | PASS   |
| V32 | simple_dma_ctrl              | Zero-length            | LENGTH_WORDS=0 — done immediately, count=0           | P06    | simple_dma_ctrl_tb T12a                      | PASS   |
| V33 | simple_dma_ctrl              | Zero-length            | Fresh restart after zero-length completes normally   | P06    | simple_dma_ctrl_tb T12b                      | PASS   |
| V34 | simple_dma_ctrl              | Error handling         | OOB src mid-copy — error=1, count=3, dst[3] ok       | P06    | simple_dma_ctrl_tb T4                        | PASS   |
| V35 | simple_dma_ctrl              | Error handling         | OOB dst mid-copy — error=1, count=3, canary ok       | P06    | simple_dma_ctrl_tb T5                        | PASS   |
| V36 | simple_dma_add_nword         | Add processing         | len=0 — done immediately, count=0, canary ok         | P07    | simple_dma_add_nword_tb T1                   | PASS   |
| V37 | simple_dma_add_nword         | Add processing         | len=1 — dst=src+add, LAST_IN/LAST_OUT correct        | P07    | simple_dma_add_nword_tb T2                   | PASS   |
| V38 | simple_dma_add_nword         | Add processing         | len=4 — all 4 dst words, LAST_IN/LAST_OUT for word 4 | P07    | simple_dma_add_nword_tb T3                   | PASS   |
| V39 | simple_dma_add_nword         | Overflow               | 0xFFFFFFFF+1=0 — no error                           | P07    | simple_dma_add_nword_tb T4                   | PASS   |
| V40 | simple_dma_add_nword         | Identity mode          | ADD_VALUE=0 — dst=src, LAST_OUT=LAST_IN              | P07    | simple_dma_add_nword_tb T7                   | PASS   |
| V41 | simple_dma_add_nword         | Error observability    | Read error — LAST_IN=SLVERR data(0), LAST_OUT=add    | P07    | simple_dma_add_nword_tb T5                   | PASS   |
| V42 | simple_dma_add_nword         | Error observability    | Write error — LAST_IN/LAST_OUT = failed word values  | P07    | simple_dma_add_nword_tb T6                   | PASS   |
| V43 | simple_dma_add_nword         | Restart after error    | Recovery transfer after read error                   | P07    | simple_dma_add_nword_tb T8a/T8b              | PASS   |
| V44 | simple_dma_add_nword         | Restart after error    | Recovery transfer after write error                  | P07    | simple_dma_add_nword_tb T9a/T9b              | PASS   |
| V45 | simple_dma_add_ctrl          | Register access        | All 9 regs write/readback; invalid addr SLVERR       | P08    | simple_dma_add_ctrl_tb T1                    | PASS   |
| V46 | simple_dma_add_ctrl          | DMA add transfer       | 1-word add; STATUS/COUNT/LAST_IN/LAST_OUT            | P08    | simple_dma_add_ctrl_tb T2                    | PASS   |
| V47 | simple_dma_add_ctrl          | DMA add transfer       | 4-word add; all dst words, LAST_IN/LAST_OUT          | P08    | simple_dma_add_ctrl_tb T3                    | PASS   |
| V48 | simple_dma_add_ctrl          | Identity mode          | ADD_VALUE=0 — dst=src, error=0, count=4              | P08    | simple_dma_add_ctrl_tb T4                    | PASS   |
| V49 | simple_dma_add_ctrl          | Overflow               | 0xFFFFFFFF+1=0 — no error                           | P08    | simple_dma_add_ctrl_tb T5                    | PASS   |
| V50 | simple_dma_add_ctrl          | Zero-length            | LENGTH_WORDS=0 — done=1, error=0, count=0            | P08    | simple_dma_add_ctrl_tb T6                    | PASS   |
| V51 | simple_dma_add_ctrl          | Error handling         | Invalid src mid-transfer — error=1, canary ok        | P08    | simple_dma_add_ctrl_tb T7                    | PASS   |
| V52 | simple_dma_add_ctrl          | Error handling         | Invalid dst mid-transfer — error=1, src ok           | P08    | simple_dma_add_ctrl_tb T8                    | PASS   |
| V53 | simple_dma_add_ctrl          | Busy state             | STATUS.busy=1 read while DMA in-flight               | P08    | simple_dma_add_ctrl_tb T9                    | PASS   |
| V54 | simple_dma_add_ctrl          | Busy retrigger         | Second CONTROL.start while busy — silently ignored   | P08    | simple_dma_add_ctrl_tb T9                    | PASS   |
| V55 | simple_dma_add_ctrl          | Restart after error    | Recovery transfer after error transfer               | P08    | simple_dma_add_ctrl_tb T10                   | PASS   |
| V56 | simple_dma_add_ctrl          | Write ordering         | AW-first / W-first with SLVERR; mixed-order transfer | P19    | simple_dma_add_ctrl_tb T11                   | PASS   |
| V57 | simple_dma_add_ctrl          | B-channel backpressure | 3-cycle bready delay; bvalid held; SLVERR under delay| P19    | simple_dma_add_ctrl_tb T12                   | PASS   |
| V58 | simple_dma_add_ctrl          | R-channel backpressure | 3-cycle rready delay; all 9 regs + invalid addr      | P20    | simple_dma_add_ctrl_tb T13                   | PASS   |
| V59 | simple_dma_add_ctrl          | Reset during transfer  | Reset mid-flight; register defaults; canary ok       | P21    | simple_dma_add_ctrl_tb T14a                  | PASS   |
| V60 | simple_dma_add_ctrl          | Post-reset restart     | Fresh transfer after reset — full result verified    | P21    | simple_dma_add_ctrl_tb T14b                  | PASS   |
| V61 | simple_dma_add_ctrl          | Repeated restart       | 5 back-to-back transfers with distinct configs       | P22    | simple_dma_add_ctrl_tb T15                   | PASS   |
| V62 | simple_dma_add_ctrl          | Smoke / coverage       | 10-iteration deterministic smoke with len cycling    | P22    | simple_dma_add_ctrl_tb T16                   | PASS   |
| V63 | simple_dma_add_ctrl          | Busy config write      | Writes to SRC/DST/LEN/ADD while busy — ignored by DMA| P23   | simple_dma_add_ctrl_tb T17                   | PASS   |
| V64 | simple_dma_add_ctrl          | Busy config readback   | Post-xfer register readback shows new written values | P23    | simple_dma_add_ctrl_tb T17                   | PASS   |
| V65 | simple_dma_add_ctrl          | Second xfer new values | Second CTRL.start uses new register values           | P23    | simple_dma_add_ctrl_tb T17                   | PASS   |
| V66 | simple_dma_add_ctrl          | Reset during transfer  | busy=1 verified pre-reset; all defaults post-reset   | P24    | simple_dma_add_ctrl_tb T18                   | PASS   |
| V67 | simple_dma_add_ctrl          | Post-reset restart     | Recovery xfer; STATUS/COUNT/LAST_IN/LAST_OUT/dst ok  | P24    | simple_dma_add_ctrl_tb T18                   | PASS   |

---

## Summary Counts

| Module                  | Entries | All PASS |
|-------------------------|---------|----------|
| axi_lite_regfile        | 9       | Yes      |
| axi_mem_model           | 4       | Yes      |
| simple_axi_master       | 3       | Yes      |
| simple_dma_copy         | 3       | Yes      |
| simple_dma_copy_nword   | 4       | Yes      |
| simple_dma_ctrl         | 12      | Yes      |
| simple_dma_add_nword    | 9       | Yes      |
| simple_dma_add_ctrl     | 23      | Yes      |
| **Total**               | **67**  | **Yes**  |

---

*Last updated: 2026-05-03*
*Applies to: DMA/AXI Verification Phase v1 (Prompts 1–25)*
