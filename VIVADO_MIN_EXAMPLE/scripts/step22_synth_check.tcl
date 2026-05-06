# step22_synth_check.tcl
# Phase-1 out-of-context synthesis check for frac_cfo_frame_corrector_top.
# Target: xczu9eg-ffvb1156-2-e (ZCU102 Zynq UltraScale+ ZU9EG), 100 MHz clock.

set script_dir [file normalize [file dirname [info script]]]
set proj_dir   [file normalize [file join $script_dir ..]]
set rtl_dir    [file join $proj_dir rtl]
set rpt_dir    [file join $proj_dir reports]

file mkdir $rpt_dir

set log_file   [file join $rpt_dir step22_synth_messages.log]
set log_fh     [open $log_file w]
proc tee {msg} {
    global log_fh
    puts $msg
    puts $log_fh $msg
    flush $log_fh
}

tee "=== Step 22 Synthesis Check ==="
tee "Project dir : $proj_dir"
tee "RTL source  : [file join $rtl_dir frac_cfo_frame_corrector_top.v]"
tee "Target part : xczu9eg-ffvb1156-2-e  (ZCU102 Zynq UltraScale+ ZU9EG)"
tee "Target clock: aclk 100 MHz (10.000 ns)"
tee ""

# Create in-memory project
create_project -in_memory
set_part xczu9eg-ffvb1156-2-e

# Add RTL source
read_verilog [file join $rtl_dir frac_cfo_frame_corrector_top.v]

# Attempt synthesis
tee "--- Running synth_design ---"
set synth_ok 0
if {[catch {
    synth_design \
        -top frac_cfo_frame_corrector_top \
        -part xczu9eg-ffvb1156-2-e \
        -mode out_of_context \
        -flatten_hierarchy rebuilt
    set synth_ok 1
} synth_err]} {
    tee "SYNTHESIS FAILED"
    tee "First error captured: $synth_err"
    close $log_fh
    exit 1
}

tee "--- synth_design completed ---"
tee ""

# Apply clock constraint for timing analysis
create_clock -period 10.000 [get_ports aclk]

# Utilization report
tee "--- Generating utilization report ---"
report_utilization -file [file join $rpt_dir step22_synth_utilization.rpt]

# Timing summary
tee "--- Generating timing summary ---"
report_timing_summary \
    -delay_type min_max \
    -report_unconstrained \
    -check_timing_verbose \
    -max_paths 10 \
    -input_pins \
    -file [file join $rpt_dir step22_timing_summary.rpt]

# DRC
tee "--- Generating DRC report ---"
report_drc -file [file join $rpt_dir step22_drc.rpt]

tee ""
tee "=== Synthesis PASSED ==="
tee "Reports written to: $rpt_dir"

close $log_fh
exit 0
