// Design Insights — Chapters 6-10
// Fixed-point · Timing/CDC · Verification · FPGA resources · Trade-offs
import * as W from '../widgets.js';
import { COMMITS, CONDITIONS, REPORTS, STAGE_METRICS, RESOURCES, FRAME, ghLink } from '../data.js';

const h = W.h;
const provFix = { report: `${REPORTS.fix} + ${REPORTS.auditJson}`, commit: COMMITS.fix,
                  conditions: CONDITIONS };
const provStage = { report: STAGE_METRICS.source, scenario: 'qpsk_tier1 / qam16_tier1',
                    commit: COMMITS.fix, conditions: CONDITIONS };

function card(ctx, module, file, extra) {
  const gh = ghLink(file, extra && extra.gh ? extra.gh : {});
  return { module, file, explorerLink: ctx.explorerLink(module),
           github: gh.github, localNote: gh.localNote, ...extra };
}

// ===========================================================================
// Chapter 6 — Fixed-Point Arithmetic & Quantization
// ===========================================================================
export const ch6 = {
  id: 'fixed-point',
  title: 'Fixed-Point Arithmetic & Quantization',
  subtitle: 'Q15, rounding, saturation and BFP — and why "a few LSBs off" is correct',
  render(ctx) {
    const root = h('<div></div>');
    root.appendChild(W.section('concept', `
      RTL DSP carries amplitudes as scaled integers (here: 16-bit I/Q at a global
      Q15 project scale). Every multiply grows bits; every rescale rounds or
      truncates; every stage must choose saturation vs wrap. A floating-point
      golden model and a correct RTL implementation therefore differ by bounded
      LSBs — the verification question is whether the bound is explained.`));

    const vis = h('<div></div>');
    // Q15 number line
    vis.appendChild(W.blockDiagram({
      title: 'Q15 representation (16-bit signed fraction)',
      width: 860, height: 110,
      boxes: [
        { id: 's', x: 20, y: 30, w: 52, h: 40, label: 'S', sub: 'sign', cls: 'mem' },
        ...Array.from({ length: 15 }, (_, i) => ({
          id: 'b' + i, x: 80 + i * 50, w: 46, y: 30, h: 40,
          label: `2⁻${i + 1}`, cls: i < 4 ? 'dsp' : '' })),
      ],
      arrows: [],
      caption: 'value = −S + Σ bᵢ·2⁻ⁱ ∈ [−1, 1). This project uses a slot-level scale of ' +
        '5090.697 counts per unit amplitude (RMS-matched to the hardware capture), so ' +
        '±1 LSB ≈ 1.96×10⁻⁴ of full scale (−74 dB).',
    }));
    vis.appendChild(W.waveform({
      title: 'Quantization at each DSP boundary — where LSB error enters',
      cycles: 6, cw: 130, lbl: 10,
      signals: [
        { name: '', kind: 'bus', wave: ['QAM map (exact int)', 'IFFT (BFP trunc.)', '≪blk ≫4 (round-half-up)',
          'channel est. (18b coeff ≫16)', 'ZF divide (recip LUT+NR)', 'demod slice (exact)'] },
      ],
      caption: 'Conceptual Example. Exact stages introduce 0 error; truncating/rounding ' +
        'stages add ≤½ LSB each. Independent per-stage errors accumulate in RMS, not ' +
        'linearly — hence the measured ≤2 LSB TX error over an IFFT + 2 rescales.',
    }));
    vis.appendChild(W.blockDiagram({
      title: 'Block Floating Point: one exponent per frame, full mantissa precision',
      width: 860, height: 150,
      boxes: [
        { id: 'in', x: 15, y: 50, w: 130, h: 50, label: 'frame x[0..255]', sub: '16-bit mantissas' },
        { id: 'fft', x: 195, y: 50, w: 180, h: 50, label: 'FFT stages', sub: 'shift only on overflow risk', cls: 'dsp' },
        { id: 'm', x: 430, y: 20, w: 170, h: 46, label: 'mantissas out[k]', sub: '16-bit, common scale' },
        { id: 'e', x: 430, y: 90, w: 170, h: 46, label: 'blk_exp (tuser)', sub: 'per-frame exponent', cls: 'mem' },
        { id: 'rec', x: 660, y: 50, w: 180, h: 50, label: 'recover', sub: '(m ≪ blk_exp + 2³) ≫ 4', cls: 'dsp' },
      ],
      arrows: [
        { from: 'in', to: 'fft' }, { from: 'fft', to: 'm' }, { from: 'fft', to: 'e' },
        { from: 'm', to: 'rec' }, { from: 'e', to: 'rec', label: 'realign' },
      ],
      caption: 'BFP = floating point at frame granularity. Unlike fixed per-stage ≫1 ' +
        '(which costs SNR on quiet frames), the shift count adapts to the data and is ' +
        'reported out-of-band so downstream realigns every frame to one global Q15 scale.',
    }));
    vis.appendChild(W.beforeAfter([
      { label: 'TX waveform max |error| (LSB)', before: 2, after: 2 },
      { label: 'EQ constellation max |error| (LSB)', before: 4, after: 4 },
    ], 'Float-golden vs RTL — identical before/after the streaming fix (datapath untouched)'));
    root.appendChild(W.section('visual', vis));

    root.appendChild(W.section('equation', W.equationBox(
      'round-half-up: y = (x + 2<sup>s−1</sup>) ≫ s &nbsp;·&nbsp; sat16: y = max(−2¹⁵, min(2¹⁵−1, x))',
      'The two primitives used at every rescale boundary in this design (e.g. the BFP ' +
      'recover and the CE coefficient multiply, 18-bit coeffs with 16 fractional bits).')));

    root.appendChild(W.section('rtl', W.rtlRef([
      card(ctx, 'tx_ifft_frontend', 'tx_ifft_frontend.v', {
        gh: { modified: true },
        signals: ['rnd_i/rnd_q (+2³)', 'sat16()', 's1_blk'],
        decision: 'Two-stage registered recover: shift+round in one stage, saturate+write ' +
          'in the next — fixed-point correctness without a long combinational path.' }),
      card(ctx, 'rx_ch_est', 'rx_ch_est.v', {
        signals: ['W ROM {Wi,Wr} 18b', '≫16 + round'],
        decision: 'Pilot division precomputed as conj(p)/|p|² coefficients — divide ' +
          'replaced by one complex multiply, matching the old divider to 0–1 LSB.' }),
      card(ctx, 'rx_eq_complex_div', 'rx_eq_complex_div.v', {
        signals: ['recip_lut', 'Newton-Raphson refine'],
        decision: 'ZF 1/|H|² via LUT + NR iteration: bounded-error reciprocal without a ' +
          'pipelined divider.' }),
    ])));

    const ev = h('<div></div>');
    ev.appendChild(h(`<table class="tbl">
      <tr><th>stage (vs float golden, same bits/pilots)</th><th>measured</th></tr>
      <tr><td>TX sync region (ROM)</td><td>bit-exact (0 mismatches)</td></tr>
      <tr><td>TX data region (IFFT+BFP+CP)</td><td>max ${STAGE_METRICS.txMaxLsb} LSB · NMSE ${STAGE_METRICS.txNmseDb} dB</td></tr>
      <tr><td>equalized constellation</td><td>EVM ${STAGE_METRICS.evmPct} % rms · max ${STAGE_METRICS.eqMaxLsb} LSB</td></tr>
      <tr><td>recovered bits (all 4 modulations)</td><td>BER 0</td></tr>
    </table>
    <div class="small muted">Test conditions preserved: identical data bits + pilots fed
    to the tier-1 float model and the RTL; comparison at project scale 5090.697; the
    documented +1-sample timing phase ramp removed before FFT-domain comparison.</div>`));
    ev.appendChild(W.provenance(provStage));
    root.appendChild(W.section('evidence', ev, { badge: 'MEASURED', badgeKind: 'measured' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'Why can a mathematically correct floating-point model differ from an RTL implementation by several LSBs?',
        a: 'Because the RTL performs a DIFFERENT, exactly-specified computation: finite ' +
          'twiddle precision, truncating BFP shifts, round-half-up rescales and ' +
          'saturation. Each boundary contributes a bounded fraction of an LSB and they ' +
          'accumulate in RMS. The correct acceptance is a justified bound per stage — ' +
          'here ≤2 LSB at the TX output, −78 dB NMSE — not equality with float. When we ' +
          'needed exactness we compared against a BIT-EXACT integer model instead (the ' +
          'CORDIC gate: 0 LSB on 400/400 vectors).',
      },
      advanced: {
        q: 'Where would you insert saturation vs allow wraparound, and why?',
        a: 'Saturate at REPRESENTATION boundaries where the value is a physical ' +
          'amplitude (BFP recover, equalizer output) — wrap there turns a 1-LSB ' +
          'overflow into a full-scale sign flip. Allow natural wrap inside modular ' +
          'arithmetic that is DEFINED modulo 2ⁿ, like NCO phase accumulators — our ' +
          'CORDIC phase latch deliberately wraps because angle arithmetic is modular; ' +
          'saturating it would be the bug.',
      },
      model: 'Q15: 1 sign + 15 fraction bits; every rescale = shift + round/truncate ' +
        '(+½ LSB bound); BFP = per-frame exponent preserving mantissa SNR; verify with ' +
        'per-stage error budgets vs float, bit-exact models where exactness is claimed.',
      spoken: 'When my RTL differs from the Python model by two LSBs I do not panic — I ' +
        'budget. The IFFT truncates inside block floating point, my recover stage ' +
        'rounds half-up, the channel estimator multiplies by an 18-bit coefficient and ' +
        'drops 16 fractional bits. Each is at most half an LSB and they add in RMS. ' +
        'Two LSBs at minus 78 dB NMSE is exactly that budget. And where I claim ' +
        'bit-exactness, I prove it against an integer reference — our CORDIC matches ' +
        'its bit-exact model on every single vector.',
      mistake: 'Comparing RTL against float with a ±0 or arbitrary tolerance — either ' +
        'spurious failures or hidden real bugs. Derive the bound from the arithmetic, ' +
        'or build a bit-exact reference.',
    })));
    return root;
  },
};

// ===========================================================================
// Chapter 7 — Clocking, Timing Closure & CDC
// ===========================================================================
export const ch7 = {
  id: 'timing-cdc',
  title: 'Clocking, Timing Closure & CDC',
  subtitle: 'What simulation cannot tell you',
  render(ctx) {
    const root = h('<div></div>');
    root.appendChild(W.section('concept', `
      RTL simulation proves cycle-level BEHAVIOR; timing closure proves every
      register-to-register path settles within one clock period on real silicon
      — a property of synthesis, placement and routing, not of the RTL alone.
      This chapter is educational: this project's Verilator results make NO
      timing-closure claims.`, { badge: 'Conceptual chapter', badgeKind: 'concept' }));

    const vis = h('<div></div>');
    vis.appendChild(W.waveform({
      title: 'Setup / hold at a capture flop — Conceptual Example',
      cycles: 4, cw: 120,
      signals: [
        { name: 'clk', kind: 'clk' },
        { name: 'D (early enough)', kind: 'bit', wave: [0, 1, 1, 0], cls: 'blue' },
        { name: 'D (setup violation)', kind: 'bit', wave: [0, 0, 1, 1], cls: 'amber' },
      ],
      highlights: [{ from: 1, to: 2, label: 'data must be stable t_setup before the edge', cls: '' }],
      caption: 'Conceptual Example. f_max = 1 / (t_cq + t_logic + t_route + t_setup). ' +
        'Verilator evaluates logic in zero time — it can never see this failure.',
    }));
    vis.appendChild(W.blockDiagram({
      title: 'Critical path & the pipelining fix — Conceptual Example',
      width: 860, height: 170,
      boxes: [
        { id: 'r1', x: 15, y: 25, w: 60, h: 40, label: 'FF' },
        { id: 'l1', x: 120, y: 25, w: 280, h: 40, label: 'mult → add → mux → sat', sub: 'long combinational cone', cls: 'dsp' },
        { id: 'r2', x: 450, y: 25, w: 60, h: 40, label: 'FF' },
        { id: 'r3', x: 15, y: 105, w: 60, h: 40, label: 'FF' },
        { id: 'l2', x: 120, y: 105, w: 120, h: 40, label: 'mult', cls: 'dsp' },
        { id: 'rp', x: 280, y: 105, w: 60, h: 40, label: 'FF', cls: 'mem' },
        { id: 'l3', x: 380, y: 105, w: 150, h: 40, label: 'add → sat', cls: 'dsp' },
        { id: 'r4', x: 570, y: 105, w: 60, h: 40, label: 'FF' },
      ],
      arrows: [
        { from: 'r1', to: 'l1' }, { from: 'l1', to: 'r2', label: 'slack < 0 ✗' },
        { from: 'r3', to: 'l2' }, { from: 'l2', to: 'rp' }, { from: 'rp', to: 'l3' },
        { from: 'l3', to: 'r4', label: 'slack > 0 ✓ (+1 latency)' },
      ],
      caption: 'The universal trade: insert a pipeline register → shorter paths, higher ' +
        'f_clk, +1 cycle latency, II unchanged. The parent project applied exactly this ' +
        '(its own synthesis logs report the sync chain at WNS −0.568 ns vs a 250 MHz ' +
        'target on xczu9eg — a parent-repo result, not re-verified here).',
    }));
    vis.appendChild(W.blockDiagram({
      title: 'Clock-domain crossing: 2-flop synchronizer & async FIFO — Conceptual Example',
      width: 880, height: 190,
      boxes: [
        { id: 'a', x: 15, y: 20, w: 120, h: 44, label: 'clkA domain', sub: 'level signal' },
        { id: 'f1', x: 200, y: 20, w: 60, h: 44, label: 'FF₁', cls: 'mem' },
        { id: 'f2', x: 290, y: 20, w: 60, h: 44, label: 'FF₂', cls: 'mem' },
        { id: 'b', x: 400, y: 20, w: 150, h: 44, label: 'clkB logic', sub: 'metastability contained' },
        { id: 'wr', x: 15, y: 110, w: 120, h: 50, label: 'write side', sub: 'gray-coded wr_ptr' },
        { id: 'ram', x: 200, y: 110, w: 150, h: 50, label: 'dual-port RAM', cls: 'mem' },
        { id: 'rd', x: 400, y: 110, w: 120, h: 50, label: 'read side', sub: 'gray-coded rd_ptr' },
        { id: 'cmp', x: 580, y: 110, w: 270, h: 50, label: 'synchronized pointer compare', sub: 'full/empty never glitch', cls: 'dsp' },
      ],
      arrows: [
        { from: 'a', to: 'f1' }, { from: 'f1', to: 'f2' }, { from: 'f2', to: 'b' },
        { from: 'wr', to: 'ram' }, { from: 'ram', to: 'rd' },
        { from: 'rd', to: 'cmp' }, { from: 'wr', to: 'cmp', fromSide: 'b', toSide: 'l' },
      ],
      caption: 'Conceptual Example. This design is single-clock (aclk) end-to-end, so no ' +
        'CDC exists in the verified RTL; on a real board the RF ADC/DAC interface and ' +
        'the AXI/DMA side would typically meet exactly these structures.',
    }));
    root.appendChild(W.section('visual', vis, { badge: 'Conceptual Example', badgeKind: 'concept' }));

    root.appendChild(W.section('equation', W.equationBox(
      'slack = T<sub>clk</sub> − (t<sub>cq</sub> + t<sub>logic</sub> + t<sub>route</sub> + t<sub>setup</sub>) &nbsp;·&nbsp; MTBF ∝ e<sup>t_res/τ</sup> / (f<sub>clk</sub> f<sub>data</sub>)',
      'Left: why pipelining raises f_max. Right: why ONE flop is not a synchronizer — ' +
      'resolution time drives mean-time-between-failures exponentially.')));

    root.appendChild(W.section('rtl', W.rtlRef([
      card(ctx, 'ofdm_transceiver_top', 'ofdm_transceiver_top.v', {
        decision: 'Single aclk domain throughout the verified design; all streaming ' +
          'seams are synchronous AXI-Stream, so tier-2 correctness claims are purely ' +
          'cycle-behavioral. No Zynq-7020 synthesis or timing run exists for this tree ' +
          '— and none is claimed.' }),
    ])));

    const ev = h('<div></div>');
    ev.appendChild(h(`<div class="small"><b>No measured timing data exists in this workspace.</b>
      Known parent-repo synthesis context (ZU9EG, 2026-07): sync chain best WNS −0.568 ns
      at a 250 MHz target; the Meyr core closes 302 MHz OOC. These are parent-project
      reports, included for context only — not reproduced here, and not applicable to
      Zynq-7020 without a new synthesis run.</div>`));
    ev.appendChild(W.provenance({ report: 'parent repo docs/p5_04_status.md (context only)',
      commit: COMMITS.baseline, conditions: 'Vivado 2022.2, xczu9eg — NOT run in this environment' }));
    root.appendChild(W.section('evidence', ev, { badge: 'No local timing data', badgeKind: 'warn' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'What is the difference between passing RTL simulation and achieving FPGA timing closure?',
        a: 'Simulation validates the register-transfer BEHAVIOR with idealized zero-delay ' +
          'logic between edges. Timing closure validates that, after synthesis, placement ' +
          'and routing on a specific device at a specific corner, every path meets setup/' +
          'hold — a physical property simulation cannot observe. A design can be ' +
          'cycle-perfect in Verilator and fail at 250 MHz in hardware, or close timing ' +
          'yet be functionally wrong. They are orthogonal proofs; our reports are ' +
          'explicit that the Verilator tier claims only the former.',
      },
      advanced: {
        q: 'An engineer proposes crossing a multi-bit bus with per-bit 2-flop synchronizers. What do you say?',
        a: 'Reject it: each bit resolves independently, so a multi-bit value can be ' +
          'captured half-old half-new. Correct options: gray-code the value if it is a ' +
          'counter (one bit changes per step — the async-FIFO pointer trick), use a ' +
          'handshake (synchronize a single req/ack and sample the stable bus), or an ' +
          'async FIFO for streams. Per-bit synchronizers are only valid for independent ' +
          'single-bit levels.',
      },
      model: 'slack = T − (t_cq + t_logic + t_route + t_setup); pipeline to shorten ' +
        'cones; CDC: 2-flop for levels, gray code for counters, async FIFO for data; ' +
        'simulation ⊥ timing closure.',
      spoken: 'I keep the two proofs separate in my head. Verilator told us our ' +
        'receiver takes one sample per clock, cycle by cycle, for a hundred frames — ' +
        'that is behavior. Whether a 250-megahertz clock is achievable is a question ' +
        'for synthesis and place-and-route on the target part, with its own report. ' +
        'Conflating them is how teams ship designs that "worked in sim". Our documents ' +
        'state the boundary explicitly: behavioral results from the digital twin, ' +
        'timing only ever from Vivado on the locked part.',
      mistake: 'Claiming megahertz from a simulator, or "fixing" a CDC by adding one ' +
        'flop without analyzing MTBF and multi-bit coherence.',
    })));
    return root;
  },
};

// ===========================================================================
// Chapter 8 — RTL Verification & cocotb
// ===========================================================================
export const ch8 = {
  id: 'verification',
  title: 'RTL Verification & cocotb',
  subtitle: 'Golden references, scoreboards, and why BER = 0 is not enough',
  render(ctx) {
    const root = h('<div></div>');
    root.appendChild(W.section('concept', `
      The verification stack drives the REAL RTL with cocotb on Verilator,
      checks it against a hardware-proven golden model, and — separately —
      records every clock of every handshake. Functional correctness and
      real-time capability are different claims with different evidence.`));

    const vis = h('<div></div>');
    vis.appendChild(W.blockDiagram({
      title: 'Actual tier-2 verification architecture',
      width: 900, height: 230,
      boxes: [
        { id: 'gold', x: 15, y: 20, w: 170, h: 50, label: 'Tier-1 golden model', sub: 'float OFDM (Python)' },
        { id: 'vec', x: 15, y: 100, w: 170, h: 50, label: 'bits + pilots', sub: 'deterministic vectors', cls: 'mem' },
        { id: 'drv', x: 240, y: 100, w: 130, h: 50, label: 'cocotb drivers', sub: 'AXI-Lite + streams' },
        { id: 'dut', x: 420, y: 100, w: 170, h: 50, label: 'DUT (unmodified RTL)', sub: '49 files, Verilator', cls: 'dsp' },
        { id: 'mon', x: 640, y: 40, w: 160, h: 50, label: 'probe monitor', sub: '32-bit bus, every clock', cls: 'mem' },
        { id: 'sb', x: 640, y: 130, w: 160, h: 50, label: 'scoreboard', sub: 'bits vs golden, per frame' },
        { id: 'rep', x: 700, y: 200, w: 160, h: 24, label: 'reports + npz traces', cls: 'dim' },
      ],
      arrows: [
        { from: 'gold', to: 'vec', fromSide: 'b', toSide: 't' },
        { from: 'vec', to: 'drv' }, { from: 'drv', to: 'dut' },
        { from: 'dut', to: 'mon', label: 'tap_probe' },
        { from: 'dut', to: 'sb', label: 'm_bits' },
        { from: 'gold', to: 'sb', fromSide: 'r', toSide: 't', label: 'expected' },
      ],
      caption: 'The xfft vendor cores are replaced by FUNCTIONAL behavioral BFP models ' +
        '(unit-tested 0 LSB vs numpy, II=1) — disclosed in every report; the real IP ' +
        'remains the silicon acceptance gate.',
    }));
    vis.appendChild(W.waveform({
      title: 'The case study: functional PASS, throughput FAIL — same DUT, same stimulus',
      cycles: 12, cw: 56,
      signals: [
        { name: 'rx_in.tvalid', kind: 'bit', wave: [1,1,1,1,1,1,1,1,1,1,1,1] },
        { name: 'rx_in.tready (baseline)', kind: 'bit', wave: [1,1,1,1,0,0,0,0,0,1,1,1], cls: 'amber' },
        { name: 'BER scoreboard', kind: 'bus', wave: [null,null,'0',null,null,null,null,null,null,null,'0',null] },
      ],
      highlights: [{ from: 4, to: 9, label: '645-650 cycle stall at EVERY frame boundary', cls: 'bad' }],
      caption: 'Measured baseline behavior (compressed): the scoreboard said BER=0 while ' +
        'the handshake trace showed the receiver refusing input 13.5% of the time. Only ' +
        'the per-cycle monitor caught it — the functional scoreboard never could.',
    }));
    vis.appendChild(h(`<table class="tbl">
      <tr><th>claim</th><th>instrument</th><th>actual result</th></tr>
      <tr><td>bits correct</td><td>scoreboard vs golden bits</td><td>BER 0 — all 4 modulations</td></tr>
      <tr><td>constellation quality</td><td>stage compare (EVM/NMSE)</td><td>EVM ${STAGE_METRICS.evmPct}%, TX NMSE ${STAGE_METRICS.txNmseDb} dB</td></tr>
      <tr><td>real-time capable</td><td>per-cycle valid/ready trace</td><td>baseline 0.896 → fix 1.000 smp/clk</td></tr>
      <tr><td>no loss under RF source</td><td>unstoppable driver + drop counter</td><td>0/416,000 lost (after fix)</td></tr>
      <tr><td>bit-exact where claimed</td><td>integer reference model</td><td>CORDIC 0 LSB on 400/400</td></tr>
    </table>`));
    root.appendChild(W.section('visual', vis));

    root.appendChild(W.section('equation', W.equationBox(
      'coverage of a claim = (what the monitor can observe) ∩ (what the checker compares)',
      'A checker only proves what it measures: a bit scoreboard is blind to stalls; a ' +
      'throughput counter is blind to data corruption. Both ran on every regression.')));

    root.appendChild(W.section('rtl', W.rtlRef([
      { module: 'ofdm_tb_harness', file: 'hw_sim/ofdm/ofdm_tb_harness.v',
        explorerLink: null,
        decision: 'Testbench-only wrapper: pilot ROM, read-only hierarchical probes ' +
          '(tap_probe/tap_probe2 incl. bank-ownership state) — frozen RTL untouched.',
        github: null, localNote: 'digital-twin repo (not parent RTL)' },
      { module: 'test_ofdm_throughput.py', file: 'hw_sim/ofdm/test_ofdm_throughput.py',
        explorerLink: null,
        decision: '8 scenarios: cont5/cont100, txkick/txchain/txbp, rxb2b, rxrf100 ' +
          '(non-backpressurable source), contbp — each saves raw npz traces.',
        github: null, localNote: 'digital-twin repo' },
    ])));

    const ev = h('<div></div>');
    ev.appendChild(h(`<div class="small">Current regression (streaming-fix branch): tier-2
      loopback 6/6 PASS · cont100 100 frames BER 0 · rxrf100 0 lost · tier-1 selftests
      PASS · CORDIC gates PROMOTED · explorer suites 25 pytest + 13 node PASS.
      Golden stage metrics identical to baseline to the printed digit — proof the fix
      changed scheduling only.</div>`));
    ev.appendChild(W.provenance(provFix));
    root.appendChild(W.section('evidence', ev, { badge: 'MEASURED', badgeKind: 'measured' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'Why is BER = 0 insufficient to prove an OFDM transceiver is ready for real-time operation?',
        a: 'Because AXI handshakes make a too-slow design look correct: when the DUT ' +
          'stalls, a polite testbench waits, and every bit still arrives eventually. Our ' +
          'baseline passed BER=0 on all modulations while demanding 650 idle cycles per ' +
          'frame — 13.5% below line rate, which on a real ADC means dropped samples and ' +
          'lost sync. Real-time capability needs its own instrument: count ' +
          'valid-and-ready transfers per clock against an input source that cannot be ' +
          'back-pressured.',
      },
      advanced: {
        q: 'How do you keep a golden-model comparison honest when the RTL is fixed-point and the model is float?',
        a: 'Three disciplines: feed IDENTICAL stimuli (same bits, same pilots — we even ' +
          'inject the golden pilot bits into the float model because the CE ROM is ' +
          'hardwired to them); compare at the right abstraction per stage with derived ' +
          'tolerances (≤2 LSB TX, phase-ramp-compensated FFT) rather than one global ' +
          'epsilon; and where bit-exactness is the claim, build an integer reference — ' +
          'our CORDIC gate moved from a float±2 criterion it could never meet to ' +
          'bit-exact==0, which is both stricter and correct.',
      },
      model: 'Driver/monitor/scoreboard + golden reference for function; per-cycle ' +
        'handshake recording + unstoppable-source model for throughput; bit-exact ' +
        'references for exactness claims; disclose every stub.',
      spoken: 'Our receiver passed every bit-error test and was still unshippable. The ' +
        'testbench was polite — it waited whenever the DUT stalled — so BER stayed ' +
        'zero while the design silently demanded six hundred fifty idle cycles per ' +
        'frame. We added a second instrument: a probe bus sampled every clock, ' +
        'counting valid-and-ready, plus a driver that behaves like an ADC and drops ' +
        'what is not accepted. That turned "works" into "works at line rate", and ' +
        'after the architecture fix the same instrument proved one sample per clock ' +
        'for a hundred straight frames.',
      mistake: 'Letting the testbench adapt to the DUT (waiting on ready, pacing ' +
        'stimulus) and then quoting the result as performance; and hiding vendor-IP ' +
        'stubs instead of disclosing their timing differences.',
    })));
    return root;
  },
};

// ===========================================================================
// Chapter 9 — FPGA Resource Architecture
// ===========================================================================
export const ch9 = {
  id: 'resources',
  title: 'FPGA Resource Architecture',
  subtitle: 'LUTs, FFs, BRAM and DSP — and what the third bank actually costs',
  render(ctx) {
    const R = RESOURCES;
    const root = h('<div></div>');
    root.appendChild(W.section('concept', `
      FPGA logic maps to four currencies: LUTs (combinational), flip-flops
      (state), BRAM (bulk memory) and DSP slices (multipliers). Architecture
      choices are trades between them and time: replicate for throughput,
      share for area, re-time for frequency.`));

    const vis = h('<div></div>');
    vis.appendChild(W.blockDiagram({
      title: 'FPGA fabric — Conceptual Example',
      width: 860, height: 160,
      boxes: [
        { id: 'clb1', x: 20, y: 25, w: 150, h: 50, label: 'CLB', sub: 'LUT6 + FFs' },
        { id: 'clb2', x: 20, y: 90, w: 150, h: 50, label: 'CLB', sub: 'LUT6 + FFs' },
        { id: 'bram', x: 240, y: 25, w: 130, h: 115, label: 'BRAM36', sub: '36 Kb dual-port', cls: 'mem' },
        { id: 'dsp', x: 430, y: 25, w: 130, h: 115, label: 'DSP48', sub: '25×18 MAC', cls: 'dsp' },
        { id: 'route', x: 620, y: 25, w: 220, h: 115, label: 'programmable routing', sub: 'dominates delay at high utilization', cls: 'dim' },
      ],
      arrows: [],
      caption: 'Zynq-7020 budget: ' + `${R.zynq7020.lut.toLocaleString()} LUT · ${R.zynq7020.ff.toLocaleString()} FF · ${R.zynq7020.bram36} BRAM36 · ${R.zynq7020.dsp} DSP48.`,
    }));
    vis.appendChild(h(`<div class="ins-wave"><div class="ins-wave-title">BRAM capacity math — the capture banks (estimate from RTL)</div>
      <table class="tbl">
        <tr><th>architecture</th><th>banks × depth × width</th><th>bits</th><th>RAMB36 (36,864 b)</th></tr>
        <tr><td>ping-pong (baseline)</td><td>2 × ${R.bankDepth} × ${R.bankWidth}</td>
            <td>${(2 * R.bankDepth * R.bankWidth).toLocaleString()}</td><td>${R.pingpongBram}</td></tr>
        <tr><td>multibank (fix, as coded)</td><td>3 × ${R.bankDepth} × ${R.bankWidth}</td>
            <td>${(3 * R.bankDepth * R.bankWidth).toLocaleString()}</td><td><b>${R.multibankBram}</b> (+8)</td></tr>
        <tr><td>multibank, right-sized</td><td>3 × ${R.optimizedDepth} × ${R.bankWidth}</td>
            <td>${(3 * R.optimizedDepth * R.bankWidth).toLocaleString()}</td><td><b>${R.optimizedBram}</b> — LESS than baseline</td></tr>
      </table>
      <div class="ins-caption small">Frames are ≤${FRAME.frame} samples; the 8192 depth is a 2×
      legacy margin. Right-sizing to 4608 beats the original ping-pong — more banks ≠ more
      BRAM if each bank stops wasting half its depth. All values are ESTIMATES from RTL
      inspection; no synthesis has been run on this tree.</div></div>`));
    vis.appendChild(W.blockDiagram({
      title: 'Sharing vs replication — actual choices in this design',
      width: 880, height: 170,
      boxes: [
        { id: 's1', x: 15, y: 25, w: 240, h: 54, label: 'SHARED: NCO + rotator', sub: '1 playback engine serves all frames', cls: 'dsp' },
        { id: 's2', x: 15, y: 100, w: 240, h: 54, label: 'SHARED: one read port / bank', sub: 'owner-muxed (ana XOR play)', cls: 'mem' },
        { id: 'r1', x: 330, y: 25, w: 250, h: 54, label: 'REPLICATED: 3 capture banks', sub: 'throughput requires concurrency', cls: 'mem' },
        { id: 'r2', x: 330, y: 100, w: 250, h: 54, label: 'REPLICATED: TX body RAM ×2', sub: 'CP needs whole-symbol buffering', cls: 'mem' },
        { id: 'note', x: 650, y: 55, w: 215, h: 60, label: 'rule of thumb', sub: 'replicate state, share arithmetic', cls: 'dim' },
      ],
      arrows: [],
      caption: 'DSP delta of the streaming fix = 0: only MEMORY and control were ' +
        'replicated; every multiplier stayed single-instance.',
    }));
    root.appendChild(W.section('visual', vis));

    root.appendChild(W.section('equation', W.equationBox(
      'RAMB36 = ⌈ depth·width / 36,864 ⌉ (per port config) &nbsp;·&nbsp; banks ≥ ⌈T<sub>own</sub>/T<sub>frame</sub>⌉',
      'The two formulas that sized the capture memory: capacity per hard block, and the ' +
      'bank-count rule from Chapter 4.')));

    root.appendChild(W.section('rtl', W.rtlRef([
      card(ctx, 'iq_capture_multibank', 'iq_capture_multibank.v', {
        gh: { localOnly: true },
        decision: 'The +1 bank is pure BRAM + a small arbiter (~+250 LUT / +150 FF ' +
          'estimated); per-bank RAMs make the second read port free (each BRAM is ' +
          'natively dual-port).' }),
      card(ctx, 'ram_2port', 'ram_2port.v', {
        decision: 'Inferred BRAM template used across the design — synchronous read, ' +
          '1-cycle latency, the reason every reader needs a pend/hold stage.' }),
    ])));

    const ev = h('<div></div>');
    ev.appendChild(h(`<table class="tbl">
      <tr><th>class</th><th>status in this project</th></tr>
      <tr><td>Estimated (RTL inspection)</td><td>streaming-fix delta: +8 RAMB36 (as coded), ~+250 LUT, ~+150 FF, +0 DSP</td></tr>
      <tr><td>Synthesis-reported</td><td><b>none for this tree</b> (no Vivado run on streaming-fix)</td></tr>
      <tr><td>Post-implementation</td><td><b>none</b>; parent repo has ZU9EG runs for the pre-fix sync chain only</td></tr>
    </table>`));
    ev.appendChild(W.provenance({ report: REPORTS.fix + ' §Hardware feasibility',
      commit: COMMITS.fix, conditions: 'estimates only — explicitly NOT synthesis results' }));
    root.appendChild(W.section('evidence', ev, { badge: 'ESTIMATES — not synthesis', badgeKind: 'warn' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'How would you optimize BRAM consumption without reducing the required streaming throughput?',
        a: 'First right-size depths to the actual frame (4608 vs 8192 halves the bank ' +
          'cost — our 3-bank design then uses LESS BRAM than the original 2-bank one), ' +
          'then check width/aspect packing against the physical block, then look at ' +
          'lifetime: a bank is only needed while owned, so shortening ownership ' +
          '(overlapping stages) reduces the required pool. What you must NOT do is mux ' +
          'away concurrent read ports that the throughput depends on.',
      },
      advanced: {
        q: 'When do you spend a DSP slice vs LUTs for a multiplier, and what did this design do?',
        a: 'DSP48s give a fast, power-efficient 25×18 MAC with internal pipeline ' +
          'registers — use them for real datapath multipliers (rotators, CE multiply, ' +
          'equalizer). LUT multipliers only make sense for tiny constants or when DSP ' +
          'columns are exhausted or poorly placed. The streaming fix deliberately added ' +
          'ZERO multipliers: the playback engine is single-instance, so the NCO/rotator ' +
          'DSPs are shared across frames by scheduling, not replicated.',
      },
      model: 'Four currencies (LUT/FF/BRAM/DSP) + routing; RAMB36 = ⌈bits/36,864⌉; ' +
        'replicate state for concurrency, share arithmetic via scheduling; label ' +
        'estimates vs synthesis vs post-route honestly.',
      spoken: 'When we added the third capture bank, the knee-jerk reaction was "that ' +
        'is fifty percent more BRAM". The honest math said otherwise: each bank was ' +
        'declared twice as deep as a frame needs, so right-sizing three banks lands ' +
        'below the original two. And the fix added zero DSPs — we replicated memory, ' +
        'which is cheap, and kept sharing the arithmetic through the job queue. The ' +
        'numbers I quote are RTL estimates; I would never present them as synthesis ' +
        'results — that column in our report literally says "none yet".',
      mistake: 'Quoting estimated utilization as if it were post-route fact, and ' +
        'forgetting that BRAM ports — not just bits — are the scarce resource for ' +
        'streaming designs.',
    })));
    return root;
  },
};

// ===========================================================================
// Chapter 10 — Engineering Trade-offs & Design Review
// ===========================================================================
export const ch10 = {
  id: 'tradeoffs',
  title: 'Engineering Trade-offs & Design Review',
  subtitle: 'The whole story: functionally perfect, architecturally not ready — then fixed and proven',
  render(ctx) {
    const root = h('<div></div>');
    const ba = ctx.m.ba;
    root.appendChild(W.section('concept', `
      One design, four separate proofs: functionality (BER), throughput
      (samples/clock), latency (cycles, jitter) and resources (four currencies).
      This project passed the first while failing the second — the audit, the
      architecture change and the re-verification are a complete case study.`));

    const vis = h('<div></div>');
    vis.appendChild(W.blockDiagram({
      title: 'Architecture before → after',
      width: 900, height: 230,
      boxes: [
        { id: 'b1', x: 15, y: 30, w: 190, h: 46, label: 'BEFORE: 2-bank ping-pong', sub: 'capture XOR process', cls: 'mem' },
        { id: 'b2', x: 15, y: 90, w: 190, h: 46, label: 'one serial FSM', sub: 'fill→detect→CFO→replay' },
        { id: 'b3', x: 15, y: 150, w: 190, h: 46, label: 'TX readout re-arm', sub: '11 bubbles/slot' },
        { id: 'a1', x: 540, y: 30, w: 200, h: 46, label: 'AFTER: 3-bank pool', sub: 'cap ∥ ana ∥ play', cls: 'mem' },
        { id: 'a2', x: 540, y: 90, w: 200, h: 46, label: 'analysis + playback engines', sub: 'job queue, ownership pass', cls: 'dsp' },
        { id: 'a3', x: 540, y: 150, w: 200, h: 46, label: 'seamless handover + chaining', sub: '0 bubbles, 0 idle' },
        { id: 'mid', x: 290, y: 90, w: 180, h: 46, label: 'throughput audit', sub: 'per-cycle traces', cls: 'dim' },
      ],
      arrows: [
        { from: 'b1', to: 'mid' }, { from: 'b2', to: 'mid' }, { from: 'b3', to: 'mid', fromSide: 'r', toSide: 'b' },
        { from: 'mid', to: 'a1' }, { from: 'mid', to: 'a2' }, { from: 'mid', to: 'a3', fromSide: 'r', toSide: 'l' },
      ],
    }));
    if (ba) {
      vis.appendChild(W.beforeAfter([
        { label: 'RX sustained (smp/clk ×1000)', before: Math.round(ba.rx_in_steady_rate.before * 1000), after: 1000 },
        { label: 'RX stall cycles / 3 frames', before: ba.rxb2b_input_stall_cycles.before, after: ba.rxb2b_input_stall_cycles.after },
        { label: 'TX bubbles / slot', before: ba.tx_slot_internal_gaps.before, after: ba.tx_slot_internal_gaps.after },
        { label: 'frame latency (cycles)', before: ba.frame_latency_steady.before, after: ba.frame_latency_steady.after },
      ], 'Measured outcome of the architecture change'));
    }
    vis.appendChild(W.stateDiagram({
      title: 'The design decision tree (as it actually happened)',
      width: 880, height: 240,
      states: [
        { id: 'q1', x: 90, y: 50, label: 'BER=0?' },
        { id: 'q2', x: 280, y: 50, label: '1 smp/clk?' },
        { id: 'q3', x: 470, y: 50, label: 'who stalls?' },
        { id: 'tx', x: 400, y: 160, label: 'TX: FSM' },
        { id: 'rx', x: 560, y: 160, label: 'RX: banks' },
        { id: 'f1', x: 690, y: 50, label: 'fix+verify', cls: 'hot' },
        { id: 'done', x: 820, y: 110, label: '100-frame', cls: 'hot' },
      ],
      edges: [
        { from: 'q1', to: 'q2', label: 'yes (6/6)' },
        { from: 'q2', to: 'q3', label: 'NO (audit)' },
        { from: 'q3', to: 'tx', label: '11 bubbles' },
        { from: 'q3', to: 'rx', label: '650/frame' },
        { from: 'tx', to: 'f1', curve: -40 }, { from: 'rx', to: 'f1', curve: 20 },
        { from: 'f1', to: 'done', label: 'regress + RF-source' },
      ],
      caption: 'Each edge is a report: tier-2 (functional) → throughput audit (localize ' +
        'to exact cycles) → streaming-fix (change + re-verify, no thresholds weakened).',
    }));
    vis.appendChild(h(`<div class="ins-wave"><div class="ins-wave-title">Engineering trade-off matrix</div>
      <table class="tbl">
      <tr><th>decision</th><th>gained</th><th>paid</th><th>rejected alternative (why)</th></tr>
      <tr><td>3rd capture bank + split engines</td><td>1.000 smp/clk sustained, −650 cyc latency</td>
        <td>+8 RAMB36 (as coded), 2nd FSM</td><td>bigger elastic FIFO — cannot fix a PERIODIC deficit</td></tr>
      <tr><td>seamless TX handover (1 line)</td><td>exact 1 smp/clk slots</td><td>1 extra mux term</td>
        <td>output skid register — more state for the same effect</td></tr>
      <tr><td>stream-derived slot-start pulse</td><td>overlap-safe meyr trigger</td><td>none measurable</td>
        <td>keeping start-keyed pulse — re-triggers mid-slot under overlap</td></tr>
      <tr><td>behavioral xfft models in tier-2</td><td>Vivado-free CI, functional FFT math</td>
        <td>absolute latencies model-dependent</td><td>inert stubs — would fake both function AND throughput</td></tr>
      <tr><td>bit-exact CORDIC gate (not float±2)</td><td>stricter AND achievable criterion</td><td>extra reference model</td>
        <td>relaxing float tolerance — hides real translation bugs</td></tr>
      </table></div>`));
    vis.appendChild(W.blockDiagram({
      title: 'Three-tier Digital Twin roadmap (current status)',
      width: 880, height: 120,
      boxes: [
        { id: 't1', x: 15, y: 30, w: 230, h: 60, label: 'Tier 1 — algorithm (float)', sub: 'selftests PASS', cls: 'dsp' },
        { id: 't2', x: 310, y: 30, w: 250, h: 60, label: 'Tier 2 — RTL digital twin', sub: 'BER 0 + 1 smp/clk PROVEN', cls: 'dsp' },
        { id: 't3', x: 630, y: 30, w: 235, h: 60, label: 'Tier 3 — ZedBoard HW', sub: 'pending: real-IP xsim, 7020 synth, JTAG', cls: 'dim' },
      ],
      arrows: [{ from: 't1', to: 't2', label: 'golden vectors' },
               { from: 't2', to: 't3', label: 'blocked items listed in reports' }],
    }));
    root.appendChild(W.section('visual', vis));

    root.appendChild(W.section('equation', W.equationBox(
      'ship-readiness = functionality ∧ throughput ∧ latency ∧ resources ∧ timing — proven SEPARATELY',
      'Each conjunct had its own instrument in this project; any one alone was misleading.')));

    root.appendChild(W.section('rtl', W.rtlRef([
      card(ctx, 'frac_cfo_frame_corrector_top', 'frac_cfo_frame_corrector_top.v', { gh: { modified: true },
        decision: 'The centerpiece of the RX story — read Ch. 4/5 for the mechanism.' }),
      card(ctx, 'iq_capture_multibank', 'iq_capture_multibank.v', { gh: { localOnly: true },
        decision: 'The new memory architecture.' }),
      card(ctx, 'tx_ifft_frontend', 'tx_ifft_frontend.v', { gh: { modified: true },
        decision: 'The one-line throughput fix.' }),
    ])));

    const ev = h('<div></div>');
    ev.appendChild(h(`<div class="ins-body"><b>Interview-ready architecture summary
      (60–90 s):</b> “This is a mode-selectable OFDM transceiver: a ROM-preamble + 12-symbol
      TX through a streaming inverse FFT with block-floating-point recovery and CP
      insertion, and an RX that captures 4160-sample frames, estimates frame timing and
      fractional CFO, replays the corrected slot through a rotator, then FFT, pilot
      channel estimation, zero-forcing equalization and Gray demapping. Functionally it
      was bit-clean from day one — BER zero on four modulations against a
      hardware-proven golden model. The interesting engineering came from the throughput
      audit: per-cycle handshake traces showed the TX losing one cycle per symbol
      boundary in a readout FSM, and the RX refusing input 650 cycles per frame because
      analysis and replay were serialized on a two-bank capture. We fixed both —
      a boundary-cycle buffer handover on TX, and on RX a third bank plus independent
      analysis and playback engines passing ownership through a job queue. Re-verified:
      one sample per clock for 100 back-to-back frames from a source that cannot be
      back-pressured, zero sample loss, constant 10,023-cycle frame latency, and the
      golden-model metrics unchanged to the digit.”</div>`));
    ev.appendChild(W.provenance(provFix));
    root.appendChild(W.section('evidence', ev, { badge: 'MEASURED', badgeKind: 'measured' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'Walk me through a bug that only appeared at an architectural level — not in any unit test.',
        a: 'Every unit was correct: capture worked, frame detect worked, replay worked, ' +
          'BER was zero. The system still could not take continuous input, because the ' +
          'SCHEDULE — analysis then replay, serialized per frame — exceeded the frame ' +
          'period. No unit owns a schedule; only a multi-frame, cycle-accurate ' +
          'system-level measurement exposes it. The fix was also architectural: ' +
          'pipeline the stages across three memory banks.',
      },
      advanced: {
        q: 'You changed a proven design. How did you guarantee you did not break it?',
        a: 'Three guards: (1) the datapath was untouched by construction — only control ' +
          'FSMs and memory scheduling changed, and the golden stage metrics (EVM, NMSE, ' +
          'LSB bounds) came back IDENTICAL to the digit; (2) the full functional ' +
          'regression — four modulations, golden payload, on-chip BER checker — ran ' +
          'unchanged with unweakened thresholds; (3) new hazards introduced by overlap ' +
          '(pulse latches, trigger semantics, bank overwrite) each got an explicit ' +
          'mechanism and a trace-level check, e.g. recorded bank-ownership vectors ' +
          'proving no conflict in 100 frames. Baseline traces were preserved for ' +
          'before/after diffing.',
      },
      model: 'Functionality, throughput, latency, resources, timing: five separate ' +
        'claims, five instruments. Architecture bugs live in schedules; find them with ' +
        'multi-frame cycle traces and fix them with pipelining + ownership.',
      spoken: 'If I had one slide for this project it would show two numbers: BER zero ' +
        'on day one, and 0.896 samples per clock. Correct and not ready are different ' +
        'things. The path between them — audit with per-cycle traces, localize to the ' +
        'exact modules and cycles, change the scheduling without touching the math, ' +
        'and re-prove both correctness and rate over a hundred frames — is, to me, ' +
        'what RTL engineering actually is.',
      mistake: 'Declaring an architecture done because every block passed its ' +
        'unit test — integration schedules, not blocks, are where streaming designs die.',
    })));
    return root;
  },
};
