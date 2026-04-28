# Verification Plan

Project: VIVADO_MIN_EXAMPLE  
Date: 2026-04-28  
Scope: testbench and scripts only — no RTL modifications

---

## Assumed DUT Trajectory

The current DUT (`rtl/and2.v`) is a placeholder. This plan targets the next meaningful
DUT: an AXI-lite register file with an AXI master DMA engine. All proposed files are
new or extensions of existing files. RTL is not touched.

---

## 1. Smoke Test

**Goal:** Confirm clock generation, reset de-assertion, and DUT responsiveness before
any bus traffic.

**Proposed file:** `tb/smoke_tb.sv`

What it does:
- Generate a 100 MHz clock (`clk` period = 10 ns)
- Assert `aresetn = 0` for 8 clock cycles, then deassert
- Check that all AXI output signals are driven to known idle states after reset
  (`awready`, `wready`, `arready` all high; `rvalid`, `bvalid` both low)
- No register access or DMA activity

Pass condition:
- Idle handshake signals reach expected reset values within 2 cycles of reset release
- Simulation completes without `$fatal`

Script hook: add a `smoke` target to `scripts/run_vivado_sim.sh` that compiles only
`rtl/` + `tb/smoke_tb.sv` and runs with `xsim`.

---

## 2. Register Read/Write Test

**Goal:** Verify every AXI-lite control register: reset default, full write, masked
write, and readback.

**Proposed file:** `tb/axi_regfile_tb.sv`

Reusable tasks (put in `tb/axi_pkg.sv`):

```systemverilog
task axi_write(input logic [31:0] addr, data, wstrb = 4'hF);
task axi_read (input logic [31:0] addr, output logic [31:0] rdata);
```

Test sequence:
1. Reset sequence (same as smoke test)
2. For each register in the map:
   a. Read — compare against documented reset default
   b. Write all-ones, read back, compare
   c. Write all-zeros, read back, compare
   d. Write a walking-ones pattern, read back, compare
3. Write to an unmapped address — expect `SLVERR` on `bresp`/`rresp`
4. Write with partial `wstrb` — verify only the enabled byte lanes change

Pass condition:
- All readback values match written values (masked by implemented bits)
- `SLVERR` fires exactly once on the unmapped access
- Pass counter printed as `[PASS] reg_rw N/N` before `$finish`

---

## 3. Memory Write/Readback Test

**Goal:** Verify the AXI master port can write and read back data through a memory
model without corruption or address aliasing.

**Proposed file:** `tb/mem_rw_tb.sv`  
**Proposed file:** `tb/axi_mem_model.sv` (simple associative-array memory slave)

`axi_mem_model.sv` spec:
- Responds to AXI4 full (not lite) read/write bursts
- 32-bit data bus, 32-bit address space
- Stores data in a `logic [31:0] mem [logic [31:0]]` associative array
- Returns `DECERR` for any address outside a configured base/size window

Test sequence:
1. Reset
2. Program DUT base address and length via AXI-lite control registers
3. Issue 16 sequential single-beat writes through the DUT AXI master
4. Issue 16 sequential single-beat reads, compare against written data
5. Issue a 4-beat incrementing burst write, then a 4-beat burst read
6. Write to an out-of-window address — expect `DECERR`

Pass condition:
- All readback data matches written data exactly
- No `DECERR` on in-window accesses
- Exactly one `DECERR` on the out-of-window access

---

## 4. DMA Transfer Test

**Goal:** Verify an end-to-end DMA move: source memory region → DUT → destination
memory region, entirely under AXI control.

**Proposed file:** `tb/dma_tb.sv`

Test sequence:
1. Reset
2. Pre-fill source region in `axi_mem_model` with a known pattern
   (e.g., `mem[base + i] = 32'hA5A5_0000 | i`)
3. Program DUT control registers via AXI-lite:
   - `SRC_ADDR`, `DST_ADDR`, `LENGTH`, `CTRL` (start bit)
4. Poll `STATUS` register for `DONE` bit, or wait for interrupt signal,
   with a timeout watchdog (see §5)
5. Read back destination region from `axi_mem_model`
6. Compare destination against source pattern word-by-word

Variants:
- Length = 1 word (boundary case)
- Length = 256 words (typical burst)
- Overlapping src/dst addresses (if supported by spec)
- Length = 0 (expect no-op, `DONE` immediately)

Pass condition:
- Destination matches source for every tested length
- `DONE` bit asserts within timeout
- No AXI error responses during transfer

---

## 5. Timeout and Error Handling

**Goal:** Prevent simulation hangs and make protocol violations immediately visible.

**Proposed file:** `tb/watchdog_pkg.sv`

```systemverilog
// Kills sim with $fatal after N cycles if not cancelled
task automatic watchdog(input int unsigned cycles, input string ctx);
```

Usage in every testbench `initial` block:
```systemverilog
fork
    watchdog(10_000, "axi_write addr=0x00");
    axi_write(ADDR, DATA);
join_any
disable fork;
```

Additional error checks:
- `$fatal` (not `$finish`) on any assertion failure — xsim exits non-zero
- Monitor `xresp != AXI_OKAY` on every handshake; log unexpected errors
- Check `awvalid` not asserted for > 1000 cycles without `awready` (stall detector)

**Script change:** `scripts/run_vivado_sim.sh` should grep `logs/xsim.log` for `[FAIL]`
and `ERROR` after xsim exits, and return exit code 1 if found:

```bash
if grep -qE '\[FAIL\]|FATAL' logs/xsim.log; then
    echo "[ERROR] Simulation failures detected"
    exit 1
fi
```

---

## 6. Waveform Checkpoints

**Goal:** Capture waveforms automatically on every run without requiring `-gui`.

**Change to every testbench `initial` block:**
```systemverilog
initial begin
    $dumpfile("../logs/<tb_name>.vcd");
    $dumpvars(0, <tb_name>);   // depth 0 = full hierarchy
end
```

VCD files go to `logs/` per CLAUDE.md convention.

Named checkpoints using display timestamps — add to key moments in each test:
```systemverilog
$display("[CHK] t=%0t phase=reset_release", $time);
$display("[CHK] t=%0t phase=first_axi_write", $time);
$display("[CHK] t=%0t phase=dma_done", $time);
```

These appear in `logs/xsim.log` so a CI log reader can correlate waveform time to
test phase without opening a waveform viewer.

**Optional:** Add a `sim/wave.tcl` Tcl script that opens the `.wdb` and adds the
most-useful signals (AXI buses, status registers, DMA FSM state) to a named waveform
window for manual debug.

---

## 7. Pass/Fail Criteria

### Per-testbench

| Criterion | Method |
|-----------|--------|
| All assertions pass | No `$fatal` call reached |
| All expected checks run | `pass_count == EXPECTED_COUNT` at `$finish` |
| No unexpected AXI errors | `err_count == 0` at `$finish` |
| No timeout fired | Watchdog cancelled before expiry |
| Summary line present | `[PASS] <tb_name> N/N` in `logs/xsim.log` |

### End-of-simulation log format (required in every TB)

```
[PASS] smoke        1/1   checks passed
[PASS] reg_rw      32/32  checks passed
[PASS] mem_rw      24/24  checks passed
[PASS] dma          6/6   checks passed
```

Or on failure:
```
[FAIL] dma          4/6   checks passed  (2 failures)
```

### Script-level (CI)

- `scripts/run_vivado_sim.sh` exits 0 only if no `[FAIL]` or `FATAL` line in log
- xsim exit code is non-zero for any `$fatal` call (xsim honors this by default)
- CI shell step: `bash scripts/run_vivado_sim.sh && echo "SIM PASSED" || exit 1`

### Regression gate

All 4 testbenches must pass before any RTL change is considered verified:
1. `smoke_tb` — gate on clock/reset health
2. `axi_regfile_tb` — gate on control-plane correctness
3. `mem_rw_tb` — gate on data-plane integrity
4. `dma_tb` — gate on end-to-end transfer correctness
