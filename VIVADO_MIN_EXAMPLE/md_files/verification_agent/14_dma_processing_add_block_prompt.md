Before doing any implementation, save this exact prompt into:

md_files/14_dma_processing_add_block_prompt.md

Then proceed with the task.

Read CLAUDE.md and ai_context/current_status.md first.

Scope:
- You may create or modify only:
  - md_files/14_dma_processing_add_block_prompt.md
  - rtl/simple_dma_add_nword.v
  - tb/simple_dma_add_nword_tb.sv
  - scripts/run_simple_dma_add_nword_sim.sh
  - ai_context/current_status.md

- You may reuse or instantiate:
  - tb/axi_mem_model.sv

- Do not modify existing verified files:
  - rtl/simple_dma_ctrl.v
  - tb/simple_dma_ctrl_tb.sv
  - rtl/simple_dma_copy_nword.v
  - tb/simple_dma_copy_nword_tb.sv
  - rtl/simple_dma_copy.v
  - tb/simple_dma_copy_tb.sv
  - rtl/simple_axi_master.v
  - tb/simple_axi_master_tb.sv
  - rtl/axi_lite_regfile.v
  - tb/axi_lite_regfile_tb.sv
  - tb/axi_mem_model.sv
  - tb/mem_rw_tb.sv

Goal:
Create a minimal N-word DMA processing engine that reads 32-bit words from source memory, adds a programmable constant to each word, and writes the processed result to destination memory.

This is the first step from a pure copy DMA toward a processing data-path DMA.

Requirements for rtl/simple_dma_add_nword.v:

1. Inputs:
   - aclk
   - aresetn
   - start
   - src_addr[31:0]
   - dst_addr[31:0]
   - length_words[15:0]
   - add_value[31:0]

2. Outputs:
   - done
   - error
   - processed_count[15:0]
   - last_input_data[31:0]
   - last_output_data[31:0]

3. AXI master interface:
   - AW, W, B, AR, R channels
   - 32-bit data
   - single-beat transactions only
   - wstrb=4'hF fixed
   - no burst support
   - no multiple outstanding transactions

4. Behavior:
   - wait for start
   - latch src_addr, dst_addr, length_words, and add_value
   - if length_words == 0:
       assert done with error=0 and processed_count=0
   - for each word index i:
       read input word from src_addr + 4*i
       if rresp != OKAY:
           assert error and stop immediately before write
       compute output_data = input_data + add_value
       write output_data to dst_addr + 4*i
       if bresp != OKAY:
           assert error and stop immediately
       increment processed_count only after successful write
   - assert done for one cycle at the end

5. Error policy:
   - Read error: abort before write; processed_count does not increment for the failed word.
   - Write error: abort after failed write response; processed_count does not increment for the failed word.
   - Normal completion: done=1, error=0, processed_count=length_words.

6. Keep the FSM simple and readable.
7. Do not use AXI bursts.
8. Do not support multiple outstanding transactions.
9. Keep the processing operation purely combinational:
   - processed_data = read_data + add_value

Requirements for tb/simple_dma_add_nword_tb.sv:

1. Instantiate simple_dma_add_nword and existing axi_mem_model.

2. Generate clock/reset.

3. Use direct hierarchical initialization of memory to seed source data and canary values.

4. Add timeout guards for waiting on done.

5. Print [PASS]/[FAIL] lines.

6. Print [DONE] only after all checks pass.

Tests:

1. length_words=0:
   - program valid src/dst/add_value
   - start DMA
   - expect done=1
   - expect error=0
   - expect processed_count=0
   - verify destination memory and canaries remain unchanged

2. length_words=1:
   - source data = 0x0000_0010
   - add_value = 0x0000_0005
   - expect destination = 0x0000_0015
   - verify processed_count=1
   - verify last_input_data and last_output_data
   - verify error=0

3. length_words=4:
   - seed four source words with unique values
   - add a constant, for example 0x0000_0100
   - verify all four destination words equal source + add_value
   - verify processed_count=4
   - verify last_input_data equals the fourth source word
   - verify last_output_data equals fourth source word + add_value
   - verify error=0

4. overflow behavior:
   - source data = 0xFFFF_FFFF
   - add_value = 0x0000_0001
   - expect wraparound result = 0x0000_0000
   - verify no error is generated for arithmetic overflow

5. invalid source mid-processing:
   - choose src range so the first few reads are valid and a later read is out-of-range
   - expect done=1 and error=1
   - verify processed_count equals the number of successfully written words before the failure
   - verify no write was issued for the failed read word
   - verify destination canary after the failed index remains unchanged

6. invalid destination mid-processing:
   - choose dst range so the first few writes are valid and a later write is out-of-range
   - expect done=1 and error=1
   - verify processed_count equals the number of successfully written words before the failed write
   - verify source memory remains unchanged
   - verify in-range destination words before the failure were processed correctly

Requirements for scripts/run_simple_dma_add_nword_sim.sh:

1. Run xvlog, xelab, xsim.
2. Save logs under logs/.
3. Fail if [FAIL] or FATAL appears in the xsim log.
4. Print concise pass/fail summary.

Final report must include:
- Files created
- Prompt backup path
- FSM summary
- Processing datapath summary
- Error policy summary
- Number of checks passed
- Whether CI grep gate passed
- Any remaining limitations
