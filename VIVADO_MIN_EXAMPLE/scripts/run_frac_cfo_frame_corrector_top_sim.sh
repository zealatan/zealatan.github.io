#!/usr/bin/env bash
set -euo pipefail

mkdir -p build logs

echo "[CLEAN] Removing previous frac_cfo_frame_corrector_top artifacts..."
rm -f  build/frac_cfo*.log build/frac_cfo*.pb \
       build/frac_cfo*.jou build/frac_cfo*.wdb
rm -rf build/xsim.dir build/.Xil

echo "[RUN] Compiling with xvlog..."
cd build

xvlog -sv \
    ../rtl/frac_cfo_frame_corrector_top.v \
    ../tb/frac_cfo_frame_corrector_top_tb.sv \
    2>&1 | tee ../logs/frac_cfo_xvlog.log

echo "[RUN] Elaborating with xelab..."
xelab frac_cfo_frame_corrector_top_tb \
    -debug typical \
    -timescale 1ns/1ps \
    -s frac_cfo_snap \
    2>&1 | tee ../logs/frac_cfo_xelab.log

echo "[RUN] Running simulation with xsim..."
xsim frac_cfo_snap \
    -runall \
    2>&1 | tee ../logs/frac_cfo_xsim.log

cd ..

echo ""
echo "[RESULTS]"
grep -E "\[PASS\]|\[FAIL\]|CI GATE|SUMMARY|---" logs/frac_cfo_xsim.log || true

if grep -qE '\[FAIL\]|FATAL' logs/frac_cfo_xsim.log; then
    echo "[ERROR] Failures detected in logs/frac_cfo_xsim.log"
    exit 1
fi

echo "[PASS] CI GATE: PASSED"
