# 06. N-word DMA Copy Prompt

```text
Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - rtl/simple_dma_copy_nword.v
  - tb/simple_dma_copy_nword_tb.sv
  - scripts/run_simple_dma_copy_nword_sim.sh
  - ai_context/current_status.md
- You may instantiate the existing tb/axi_mem_model.sv.
- Do not modify:
  - rtl/simple_dma_copy.v
  - tb/simple_dma_copy_tb.sv
  - tb/axi_mem_model.sv
  - tb/mem_rw_tb.sv
  - rtl/simple_axi_master.v
  - tb/simple_axi_master_tb.sv
  - rtl/axi_lite_regfile.v
  - tb/axi_lite_regfile_tb.sv

Goal:
Create a minimal N-word DMA copy engine that copies multiple 32-bit words from a source address range to a destination address range through AXI.

Requirements for rtl/simple_dma_copy_nword.v:
1. Inputs:
   - aclk
   - aresetn
   - start
   - src_addr[31:0]
   - dst_addr[31:0]
   - length_words[15:0]

2. Outputs:
   - done
   - error
   - copied_count[15:0]
   - last_copied_data[31:0]

3. AXI master interface:
   - AW, W, B, AR, R channels
   - 32-bit data
   - single-beat transactions only
   - wstrb=4'hF fixed
   - no burst support
   - no multiple outstanding transactions

4. Behavior:
   - wait for start
   - latch src_addr, dst_addr, and length_words
   - if length_words == 0, assert done with error=0 and copied_count=0
   - for each word index i:
       read  src_addr + 4*i
       if rresp != OKAY:
           assert error, stop immediately, do not write this word
       latch rdata into last_copied_data
       write dst_addr + 4*i
       if bresp != OKAY:
           assert error, stop immediately
       increment copied_count only after a successful write
   - assert done for one cycle at the end

5. Error policy:
   - Read error: abort before write, copied_count does not increment for the failed word.
   - Write error: abort after failed write response, copied_count does not increment for the failed word.
   - Normal completion: done=1, error=0, copied_count=length_words.

6. Keep the FSM simple and readable.
7. Avoid changing interface after implementation unless absolutely necessary.

Requirements for tb/simple_dma_copy_nword_tb.sv:
1. Instantiate simple_dma_copy_nword and existing axi_mem_model.
2. Generate clock/reset.
3. Use direct hierarchical initialization of memory to seed source data and canary values.
4. Add timeout guards for waiting on done.
5. Print [PASS]/[FAIL] lines.
6. Print [DONE] only after all checks pass.

Tests:
1. length_words=0:
   - expect done=1
   - expect error=0
   - expect copied_count=0
   - verify destination memory unchanged

2. length_words=1:
   - copy one word from 0x00 to 0x40
   - verify destination data
   - verify copied_count=1
   - verify error=0

3. length_words=4:
   - copy four unique words from 0x00/0x04/0x08/0x0C to 0x80/0x84/0x88/0x8C
   - verify all destination words
   - verify copied_count=4
   - verify last_copied_data equals the fourth source word
   - verify error=0

4. invalid source during multi-word copy:
   - choose src range so the first few reads are valid and a later read is out-of-range
   - expect done=1 and error=1
   - verify copied_count equals the number of successfully written words before the failure
   - verify no write was issued for the failed read word
   - verify destination canary after the failed index remains unchanged

5. invalid destination during multi-word copy:
   - choose dst range so the first few writes are valid and a later write is out-of-range
   - expect done=1 and error=1
   - verify copied_count equals the number of successfully written words before the failed write
   - verify source memory remains unchanged
   - verify in-range destination words before the failure were copied correctly

Requirements for scripts/run_simple_dma_copy_nword_sim.sh:
1. Run xvlog, xelab, xsim.
2. Save logs under logs/.
3. Fail if [FAIL] or FATAL appears in the xsim log.
4. Print concise pass/fail summary.

Final report must include:
- Files created
- FSM summary
- Error policy summary
- Number of checks passed
- Whether CI grep gate passed
- Any remaining limitations
```
