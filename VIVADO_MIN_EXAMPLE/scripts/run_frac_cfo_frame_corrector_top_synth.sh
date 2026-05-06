#!/usr/bin/env bash
# Step 22 synthesis check for frac_cfo_frame_corrector_top.
# Runs Vivado in batch mode targeting xczu9eg-ffvb1156-2-e (ZCU102) at 100 MHz.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJ_DIR="$(dirname "$SCRIPT_DIR")"
VIVADO_BIN="${VIVADO_BIN:-vivado}"

mkdir -p "$PROJ_DIR/reports"

echo "[STEP22] Running Vivado synthesis check..."
echo "[STEP22] Target: xczu9eg-ffvb1156-2-e (ZCU102)  Clock: 100 MHz"
echo ""

set +e
"$VIVADO_BIN" -mode batch \
    -source "$SCRIPT_DIR/step22_synth_check.tcl" \
    -nojournal \
    -nolog \
    2>&1 | tee "$PROJ_DIR/reports/step22_synth_messages.log"
VIVADO_EXIT=$?
set -e

echo ""
echo "[RESULTS]"
if [ -f "$PROJ_DIR/reports/step22_synth_utilization.rpt" ]; then
    echo "[STEP22] Utilization report generated."
    grep -E "LUT|FF|BRAM|DSP" "$PROJ_DIR/reports/step22_synth_utilization.rpt" | head -20 || true
fi

if [ -f "$PROJ_DIR/reports/step22_timing_summary.rpt" ]; then
    echo "[STEP22] Timing summary generated."
    grep -E "WNS|TNS|Slack|Design Timing Summary" \
        "$PROJ_DIR/reports/step22_timing_summary.rpt" | head -10 || true
fi

if grep -qE "^SYNTHESIS FAILED|ERROR:" "$PROJ_DIR/reports/step22_synth_messages.log" 2>/dev/null; then
    echo "[STEP22] SYNTHESIS FAILED — see reports/step22_synth_messages.log"
    exit 1
fi

if [ "$VIVADO_EXIT" -ne 0 ]; then
    echo "[STEP22] Vivado exited with code $VIVADO_EXIT — synthesis FAILED"
    exit 1
fi

echo "[STEP22] CI GATE: PASSED"
