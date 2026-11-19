// Design Insights — Chapters 1-5
// Pipelining · AXI-Stream · FFT architecture · Multi-bank memory · FSM design
import * as W from '../widgets.js';
import { COMMITS, CONDITIONS, REPORTS, FRAME, ghLink } from '../data.js';

const h = W.h;
const provFix = { report: `${REPORTS.fix} + ${REPORTS.auditJson}`, commit: COMMITS.fix,
                  conditions: CONDITIONS };
const provBase = { report: REPORTS.audit, commit: COMMITS.baseline, conditions: CONDITIONS };

function card(ctx, module, file, extra) {
  const gh = ghLink(file, extra && extra.gh ? extra.gh : {});
  return { module, file, explorerLink: ctx.explorerLink(module),
           github: gh.github, localNote: gh.localNote, ...extra };
}

// ===========================================================================
// Chapter 1 — Pipelining, Latency & Throughput
// ===========================================================================
export const ch1 = {
  id: 'pipelining',
  title: 'Pipelining, Latency & Throughput',
  subtitle: 'Why hundreds of cycles of latency and one sample per clock are not a contradiction',
  render(ctx) {
    const root = h('<div></div>');
    root.appendChild(W.section('concept', `
      <b>Latency</b> is how long ONE sample takes to cross the pipeline;
      <b>initiation interval (II)</b> is how often a NEW sample can enter.
      A deeply pipelined datapath can have hundreds of cycles of latency and
      still accept and emit one sample every clock (II = 1) — throughput is set
      by the II, not by the latency.`));

    // --- interactive pipeline animation (3 stages) ---
    const STAGES = ['QAM map', 'IFFT + BFP recover', 'CP read-out'];
    const CYC = 14;
    const anim = W.animator({
      frames: CYC,
      interval: 650,
      caption: 'Conceptual 3-stage model of the TX data path: after the fill ' +
        'phase (latency), every stage holds a DIFFERENT sample on every cycle — ' +
        'one enters and one leaves per clock. Pause/step to inspect any cycle.',
      render(cyc) {
        const Wd = 760, Hd = 170;
        const svg = W.svgEl('svg', { viewBox: `0 0 ${Wd} ${Hd}`, class: 'ins-wave-svg' });
        // input queue on the left, output count on the right, one occupancy
        // box per stage: stage si holds sample (cyc - si) once filled.
        STAGES.forEach((s, si) => {
          const y = 14 + si * 42;
          const t = W.svgEl('text', { x: 6, y: y + 20, class: 'ins-wave-label' }, svg);
          t.textContent = s;
          const sample = cyc - si;
          W.svgEl('rect', { x: 230, y, width: 150, height: 30, rx: 5,
            class: `ins-span ${sample >= 0 ? 'play' : ''}` }, svg);
          const tt = W.svgEl('text', { x: 305, y: y + 19,
            'text-anchor': 'middle', class: 'ins-span-label' }, svg);
          tt.textContent = sample >= 0 ? `sample #${sample}` : 'filling…';
          if (si < STAGES.length - 1) {
            W.svgEl('line', { x1: 305, y1: y + 30, x2: 305, y2: y + 42,
              class: 'ins-edge' }, svg);
          }
        });
        // arrows in/out
        W.svgEl('line', { x1: 160, y1: 29, x2: 228, y2: 29, class: 'ins-edge hot' }, svg);
        const tin = W.svgEl('text', { x: 160, y: 20, class: 'ins-cycle-num' }, svg);
        tin.textContent = `in: sample #${cyc} (1/clk)`;
        W.svgEl('line', { x1: 382, y1: 113, x2: 470, y2: 113, class: 'ins-edge hot' }, svg);
        const outS = cyc - (STAGES.length - 1);
        const tout = W.svgEl('text', { x: 400, y: 104, class: 'ins-cycle-num' }, svg);
        tout.textContent = outS >= 0 ? `out: sample #${outS}` : 'out: — (latency)';
        const sum = W.svgEl('text', { x: 470, y: Hd - 10, class: 'ins-cycle-num' }, svg);
        sum.textContent = `cycle ${cyc}: samples in = ${cyc + 1}, samples out = ` +
          `${Math.max(0, cyc - STAGES.length + 2)}, in flight = ` +
          `${Math.min(cyc + 1, STAGES.length)}  (latency ${STAGES.length - 1} cyc, II = 1)`;
        return svg;
      },
    });
    const vis = h('<div></div>');
    vis.appendChild(anim);
    vis.appendChild(W.waveform({
      title: 'Latency vs throughput — the two are independent',
      cycles: 12,
      signals: [
        { name: 'in.valid&&ready', kind: 'bit', wave: [1,1,1,1,1,1,1,1,1,1,1,1] },
        { name: 'out (latency 4)', kind: 'bit', wave: [0,0,0,0,1,1,1,1,1,1,1,1], cls: 'amber' },
      ],
      highlights: [{ from: 0, to: 4, label: 'startup latency', cls: '' },
                   { from: 4, to: 12, label: 'steady state: II = 1', cls: 'good' }],
      caption: 'Conceptual Example — once the pipe is full, output sustains one transfer per clock forever.',
    }));
    root.appendChild(W.section('visual', vis, { badge: 'interactive', badgeKind: 'info' }));

    root.appendChild(W.section('equation', W.equationBox(
      `T<sub>throughput</sub> = <span class="frac"><span>N<sub>valid transfers</sub></span><span>N<sub>clock cycles</sub></span></span> &nbsp; samples/clock`,
      'All throughput numbers in this project are computed exactly this way from ' +
      'recorded per-cycle traces, counting a transfer only when tvalid && tready.')));

    root.appendChild(W.section('rtl', W.rtlRef([
      card(ctx, 'tx_ifft_frontend', 'tx_ifft_frontend.v', {
        gh: { modified: true },
        signals: ['m_valid/m_ready', 'rc', 'rd_active', 'filled[1:0]'],
        decision: 'Double-buffered body RAM lets the IFFT fill symbol k+1 while the ' +
          'CP read-out streams symbol k — the structure that makes II = 1 possible. ' +
          'The baseline readout FSM still cost 1 bubble per symbol (fixed in Ch. 5).',
      }),
      card(ctx, 'tx_ofdm_top', 'tx_ofdm_top.v', {
        gh: { modified: true },
        signals: ['start', 'busy', 'start_pend', 'slot_pos'],
        decision: 'Slot-level pipelining: a pending start chains the next 4032-sample ' +
          'slot with zero idle cycles.',
      }),
    ])));

    const ev = h('<div></div>');
    const ba = ctx.m.ba;
    ev.appendChild(W.beforeAfter([
      { label: 'TX cycles per 4032-sample slot', before: 4043, after: 4032 },
      { label: 'TX in-slot bubbles (cycles)', before: ba ? ba.tx_slot_internal_gaps.before : 11,
        after: ba ? ba.tx_slot_internal_gaps.after : 0 },
    ], 'Measured TX throughput — baseline vs streaming-fix'));
    ev.appendChild(h(`<div class="small">Startup latency: <b>2–3 cycles</b> from the start
      pulse to the first sync-ROM sample (measured, txkick). Chained slots: 12,096
      samples in 12,096 cycles (txchain) — slot-level II = 1.</div>`));
    ev.appendChild(W.provenance(provFix));
    root.appendChild(W.section('evidence', ev, { badge: 'MEASURED', badgeKind: 'measured' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'How can a circuit have hundreds of cycles of latency but still process one sample per clock?',
        a: 'Because latency and initiation interval are different quantities. A pipeline ' +
          'holds many samples in flight simultaneously — each register stage holds a ' +
          'different one. Latency counts the stages a single sample crosses; throughput ' +
          'counts how often a new sample enters. With no structural hazards the II is 1 ' +
          'regardless of depth. In this project the RX frame latency is 10,023 cycles, ' +
          'yet the input accepts exactly one sample every clock for 100 straight frames.',
      },
      advanced: {
        q: 'Your measured steady-state throughput is 0.9973 instead of 1.0. Where do you look first?',
        a: 'At control-path boundaries, not the datapath: a datapath that is II=1 ' +
          'everywhere still stalls if an FSM takes an extra cycle at a block boundary. ' +
          'Here the 11 missing cycles per slot were exactly the 11 data-symbol ' +
          'boundaries — a read-enable that dropped for one cycle during buffer handover. ' +
          'Counting transfers per window and diffing transfer timestamps localizes it immediately.',
      },
      model: 'Latency = pipeline depth (cycles per sample); II = cycles between new ' +
        'samples; throughput = 1/II × f_clk. Deep pipelines trade latency for clock ' +
        'frequency while II stays 1.',
      spoken: 'I would say: think of a car factory. A car takes eight hours to cross the ' +
        'line — that is latency. But a finished car leaves every two minutes — that is ' +
        'throughput. RTL pipelines are the same: our TX slot has a few cycles of fill ' +
        'latency, but once streaming it delivers exactly one IQ sample per clock, and we ' +
        'proved it by counting valid-and-ready transfers against clock cycles over a ' +
        'hundred back-to-back frames.',
      mistake: 'Measuring throughput over a short burst that fits in internal buffers — ' +
        'burst rate ≠ sustained rate. Always measure across multiple frame boundaries, ' +
        'where control FSMs re-arm.',
    })));
    return root;
  },
};

// ===========================================================================
// Chapter 2 — AXI-Stream & Backpressure
// ===========================================================================
export const ch2 = {
  id: 'axi-stream',
  title: 'AXI-Stream & Backpressure',
  subtitle: 'tvalid/tready as a distributed flow-control protocol',
  render(ctx) {
    const root = h('<div></div>');
    root.appendChild(W.section('concept', `
      A beat transfers on a rising clock edge where <code>TVALID && TREADY</code>.
      The source must HOLD tdata/tvalid stable while stalled; the sink may drop
      tready at any time. Backpressure propagates upstream hop by hop — every
      module must either stall its producer or buffer.`));

    // --- interactive valid/ready editor ---
    const vis = h('<div></div>');
    const N = 12;
    const state = { tvalid: [0,1,1,1,1,1,0,1,1,1,1,0], tready: [1,1,0,0,1,1,1,1,0,1,1,1] };
    const holder = h('<div></div>');
    function dataWave() {
      // D advances only on transfers; held while stalled
      const out = []; let dIdx = 0, active = false;
      for (let c = 0; c < N; c++) {
        if (state.tvalid[c]) { out.push('D' + dIdx); active = true;
          if (state.tready[c]) dIdx++; }
        else { out.push(null); }
      }
      return out;
    }
    function redraw() {
      holder.innerHTML = '';
      const xfers = state.tvalid.map((v, i) => v && state.tready[i]);
      const wf = W.waveform({
        title: `Interactive handshake — click any tready/tvalid cell to toggle it · transfers = ${xfers.filter(Boolean).length}`,
        cycles: N,
        signals: [
          { name: 'aclk', kind: 'clk' },
          { name: 'tvalid', kind: 'bit', wave: state.tvalid },
          { name: 'tready', kind: 'bit', wave: state.tready, cls: 'amber' },
          { name: 'tdata', kind: 'bus', wave: dataWave() },
          { name: 'transfer', kind: 'bit', wave: xfers.map(x => x ? 1 : 0), cls: 'blue' },
        ],
        highlights: state.tvalid.map((v, i) => v && !state.tready[i] ?
          { from: i, to: i + 1, cls: 'bad' } : null).filter(Boolean),
        caption: 'Red columns: stall (tvalid && !tready) — the source HOLDS the same ' +
          'tdata word; no beat is lost, none is duplicated. Conceptual Example (editable).',
      });
      // click-to-toggle: overlay invisible cells
      const svg = wf.querySelector('svg');
      const vb = svg.getAttribute('viewBox').split(' ').map(Number);
      ['tvalid', 'tready'].forEach((sig, row) => {
        for (let c = 0; c < N; c++) {
          const r = W.svgEl('rect', {
            x: 120 + c * 34, y: (row + 1) * 26 + 6, width: 34, height: 26,
            fill: 'transparent', style: 'cursor:pointer' }, svg);
          r.addEventListener('click', () => { state[sig][c] ^= 1; redraw(); });
        }
      });
      holder.appendChild(wf);
    }
    redraw();
    vis.appendChild(holder);
    vis.appendChild(W.blockDiagram({
      title: 'Backpressure propagation through the RX chain (actual module order)',
      width: 900, height: 120,
      boxes: [
        { id: 'src', x: 10, y: 35, w: 95, h: 46, label: 'RF source', sub: 'cannot stall' },
        { id: 'cap', x: 140, y: 35, w: 130, h: 46, label: 'capture banks', sub: 'absorbs', cls: 'mem' },
        { id: 'sync', x: 305, y: 35, w: 120, h: 46, label: 'sync corrector' },
        { id: 'fft', x: 460, y: 35, w: 110, h: 46, label: 'FFT frontend' },
        { id: 'eq', x: 605, y: 35, w: 100, h: 46, label: 'CE + EQ' },
        { id: 'dm', x: 740, y: 35, w: 110, h: 46, label: 'demod (m_bits)' },
      ],
      arrows: [
        { from: 'src', to: 'cap', label: 'data →' },
        { from: 'cap', to: 'sync' }, { from: 'sync', to: 'fft' },
        { from: 'fft', to: 'eq' }, { from: 'eq', to: 'dm' },
        { from: 'dm', to: 'eq', fromSide: 'l', toSide: 'r', label: '← tready', cls: 'hot' },
        { from: 'eq', to: 'fft', fromSide: 'l', toSide: 'r', cls: 'hot' },
        { from: 'fft', to: 'sync', fromSide: 'l', toSide: 'r', cls: 'hot' },
        { from: 'sync', to: 'cap', fromSide: 'l', toSide: 'r', cls: 'hot' },
      ],
      caption: 'tready (amber) flows hop-by-hop upstream. The RF boundary cannot be ' +
        'backpressured, so the capture banks are the final absorber — if they fill, ' +
        'samples are lost. That is why bank scheduling (Ch. 4) is a correctness issue, ' +
        'not a performance nicety.',
    }));
    root.appendChild(W.section('visual', vis, { badge: 'interactive', badgeKind: 'info' }));

    root.appendChild(W.section('equation', W.equationBox(
      'transfer ⇔ TVALID ∧ TREADY (same rising edge)',
      'Formal protocol properties the design honors: (1) once TVALID is high, tdata/tlast ' +
      'are stable until the transfer; (2) TVALID must not wait for TREADY (no deadlock); ' +
      '(3) a skid register lets a module deassert its upstream ready one cycle late ' +
      'without losing the in-flight beat (used at the wrapper int-rotator input).')));

    root.appendChild(W.section('rtl', W.rtlRef([
      card(ctx, 'ofdm_transceiver_top', 'ofdm_transceiver_top.v', {
        signals: ['tx_out_t*', 'ext_s_axis_t*', 'm_bits_t*'],
        decision: 'Every inter-module seam in the design is plain AXI-Stream; the ' +
          'throughput audit counts transfers at 11 of these seams every clock.',
      }),
      card(ctx, 'frac_cfo_frame_corrector_top', 'frac_cfo_frame_corrector_top.v', {
        gh: { modified: true },
        signals: ['s_axis_tready', 'play_hold*', 'corr_tready'],
        decision: 'H1b 2-deep playback FIFO absorbs 1-cycle BRAM read latency AND ' +
          'downstream backpressure while keeping 1 read issued per clock.',
      }),
    ])));

    const ev = h('<div></div>');
    ev.appendChild(h(`<table class="tbl">
      <tr><th>test</th><th>condition</th><th>result</th></tr>
      <tr><td>txbp</td><td>TX output tready duty-cycled 3-of-4</td>
        <td>4032/4032 samples delivered · 1344 held cycles · 0 corrupted (sync region byte-exact)</td></tr>
      <tr><td>contbp</td><td>downstream m_bits tready 3-of-4, continuous loopback</td>
        <td>5 frames, BER 0 — backpressure propagated cleanly through the whole RX chain</td></tr>
      <tr><td>rxrf100</td><td>source that CANNOT be backpressured, 100 frames</td>
        <td>${ctx.m.sf.rxrf100 ? ctx.m.sf.rxrf100.rf_samples_lost : '—'} of 416,000 samples lost (after fix)</td></tr>
    </table>`));
    ev.appendChild(W.provenance(provFix));
    root.appendChild(W.section('evidence', ev, { badge: 'MEASURED', badgeKind: 'measured' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'What happens when TREADY goes low while TVALID is asserted?',
        a: 'Nothing transfers. The source must keep TVALID high and hold tdata/tlast ' +
          'unchanged until the sink raises TREADY again; the beat completes on the first ' +
          'edge with both high. Dropping TVALID or changing tdata mid-stall violates the ' +
          'protocol and corrupts data. In our txbp test the TX held beats through 1344 ' +
          'stall cycles and delivered all 4032 samples byte-exact.',
      },
      advanced: {
        q: 'Your source is an ADC that cannot be stalled. How do you design the ingest?',
        a: 'The tready chain must terminate in a buffer sized for the worst-case ' +
          'downstream busy period, and the scheduler must guarantee that bound. We ' +
          'measured the old receiver demanding 650 idle cycles per frame — no finite ' +
          'elastic buffer fixes a PERIODIC deficit; the fix must be architectural ' +
          '(overlap processing so steady-state demand is ≤ 1 sample/clock), then a ' +
          'modest bank pool absorbs jitter. Detection matters too: count drops loudly ' +
          'instead of silently wrapping.',
      },
      model: 'AXI-Stream = distributed credit-less flow control: transfer on ' +
        'valid&&ready, source-side stability under stall, hop-by-hop upstream ' +
        'propagation, skid/FIFO at latency boundaries.',
      spoken: 'I explain the handshake as a two-way contract. Valid says "I have a ' +
        'word"; ready says "I can take it"; only the AND moves data. The subtle part is ' +
        'what stalls do: the producer freezes its word, and the stall ripples upstream ' +
        'one hop per module. At an RF boundary nobody can stall the antenna, so the ' +
        'chain must end in a buffer plus a scheduler that keeps the average demand at ' +
        'one sample per clock — which is exactly what our three-bank capture does.',
      mistake: 'Gating TVALID on TREADY ("I will assert valid when you are ready") — ' +
        'it deadlocks against sinks that wait for valid, and it hides throughput bugs ' +
        'in simulation where both sides idle politely.',
    })));
    return root;
  },
};

// ===========================================================================
// Chapter 3 — FFT/IFFT Hardware Architecture
// ===========================================================================
export const ch3 = {
  id: 'fft',
  title: 'FFT/IFFT Hardware Architecture',
  subtitle: 'Streaming transforms, block floating point, and why buffers surround the FFT',
  render(ctx) {
    const root = h('<div></div>');
    root.appendChild(W.section('concept', `
      A pipelined-streaming FFT accepts one sample per clock continuously, with
      ~N-cycle latency, by chaining log₂N butterfly stages with inter-stage delay
      memories. The hard part in a real system is everything AROUND it: framing,
      reordering, scaling recovery and CP handling — all solved with buffers.`));

    const vis = h('<div></div>');
    vis.appendChild(W.blockDiagram({
      title: 'TX IFFT frontend — actual RTL structure around the vendor FFT',
      width: 900, height: 150,
      boxes: [
        { id: 'map', x: 8, y: 48, w: 110, h: 50, label: 'QAM mapper', sub: '256 bins/sym' },
        { id: 'fft', x: 160, y: 48, w: 170, h: 50, label: 'xfft_N (INVERSE)', sub: 'Vendor IP · BFP · natural order', cls: 'dim' },
        { id: 'rec', x: 380, y: 48, w: 165, h: 50, label: 'BFP recover', sub: '(out≪blk_exp + 2³) ≫ 4', cls: 'dsp' },
        { id: 'ram', x: 590, y: 48, w: 140, h: 50, label: 'body RAM ×2', sub: '256×32b ping-pong', cls: 'mem' },
        { id: 'cp', x: 775, y: 48, w: 115, h: 50, label: 'CP read-out', sub: '288 samples/sym' },
      ],
      arrows: [
        { from: 'map', to: 'fft', label: 'spec, tlast/256' },
        { from: 'fft', to: 'rec', label: '+ blk_exp (tuser)' },
        { from: 'rec', to: 'ram' },
        { from: 'ram', to: 'cp', label: '[224..255]+[0..255]' },
      ],
      caption: 'The dashed box is the Xilinx xfft 9.1 IP (.xci: 256-pt, 16-bit, ' +
        'pipelined_streaming_io, block_floating_point, truncation, natural order). ' +
        'Its internals are vendor IP — everything else is project RTL, verified at ' +
        'tier 2 against the golden model.',
    }));
    vis.appendChild(W.blockDiagram({
      title: 'Radix-2 butterfly — Conceptual Example (vendor IP internals are not RTL-visible)',
      width: 620, height: 170,
      boxes: [
        { id: 'a', x: 10, y: 20, w: 70, h: 36, label: 'a' },
        { id: 'b', x: 10, y: 104, w: 70, h: 36, label: 'b' },
        { id: 'add', x: 250, y: 20, w: 110, h: 36, label: 'a + b·W', cls: 'dsp' },
        { id: 'sub', x: 250, y: 104, w: 110, h: 36, label: 'a − b·W', cls: 'dsp' },
        { id: 'oa', x: 480, y: 20, w: 90, h: 36, label: "a'" },
        { id: 'ob', x: 480, y: 104, w: 90, h: 36, label: "b'" },
      ],
      arrows: [
        { from: 'a', to: 'add' }, { from: 'a', to: 'sub', cls: '' },
        { from: 'b', to: 'add', label: '×W (twiddle)' }, { from: 'b', to: 'sub' },
        { from: 'add', to: 'oa' }, { from: 'sub', to: 'ob' },
      ],
      caption: 'log₂256 = 8 such stages, each with delay memory, give a streaming FFT: ' +
        'values can grow ×2 per stage — the reason scaling (BFP) exists.',
    }));
    vis.appendChild(W.waveform({
      title: 'IFFT → CP insertion scheduling (one 288-sample symbol)',
      cycles: 14, cw: 46, lbl: 150,
      signals: [
        { name: 'IFFT out (body n)', kind: 'bus',
          wave: ['0','1','…','254','255', null, null, null, null, null, null, null, null, null] },
        { name: 'RAM write buf A', kind: 'bit', wave: [1,1,1,1,1,0,0,0,0,0,0,0,0,0] },
        { name: 'CP read-out', kind: 'bus',
          wave: [null,null,null,null,null,'224','…','255','0','1','…','254','255','→'] , cls: 'held' },
      ],
      highlights: [{ from: 5, to: 8, label: 'CP = last 32 body samples first', cls: 'good' }],
      caption: 'Conceptual Example (compressed time axis). Because CP = the LAST 32 body ' +
        'samples, the full symbol must be buffered before output can start — this is the ' +
        'fundamental reason the TX needs the double body RAM: buffer symbol k+1 while ' +
        'streaming symbol k keeps II = 1.',
    }));
    root.appendChild(W.section('visual', vis));

    root.appendChild(W.section('equation', W.equationBox(
      'body<sub>q15</sub>[n] = ((out16 ≪ blk_exp) + 2<sup>3</sup>) ≫ 4',
      'BFP recovery implemented in RTL: the xfft reports a per-frame block exponent ' +
      '(tuser); ≫4 applies the golden 1/√256 scale with round-half-up. The RX frontend ' +
      'uses the identical recovery plus fftshift reordering. For the OFDM math itself ' +
      'see the existing <a href="https://zealatan.github.io/ofdm-e2e/theory.html" target="_blank" rel="noopener">Math Theory</a> pages — not repeated here.')));

    root.appendChild(W.section('rtl', W.rtlRef([
      card(ctx, 'tx_ifft_frontend', 'tx_ifft_frontend.v', {
        gh: { modified: true },
        signals: ['ifft_dout_tuser (blk_exp)', 'sat16()', 'raddr', 'filled[]'],
        decision: 'One-shot FWD_INV=0 config gated BEFORE data (a real silicon bug class: ' +
          'data racing an unconfigured core), 2-stage registered BFP recover, ' +
          'CP-insert addressing raddr = rc<32 ? 224+rc : rc−32.',
      }),
      card(ctx, 'rx_fft_frontend', 'rx_fft_frontend.v', {
        signals: ['cfg_done', 'blk_exp', 'fftshift reorder', 's_ready'],
        decision: 'Drops per-symbol CP before the FFT, recovers BFP, fftshifts — and ' +
          'tolerates the xfft\'s variable output timing by design (ping-pong bins buffer).',
      }),
      card(ctx, 'xfft_N', 'xfft_N/xfft_N.xci', {
        decision: 'Vendor IP / Black Box. Tier-2 uses a functional behavioral BFP model ' +
          '(unit-tested 0 LSB vs numpy, II=1); the real IP remains the silicon ' +
          'acceptance gate.',
      }),
    ])));

    const ev = h('<div></div>');
    ev.appendChild(h(`<div class="small">Verified RTL-visible behavior (NOT vendor internals):
      TX data region matches the floating-point golden within <b>≤2 LSB</b>
      (NMSE −78.2 dB) across all 12 symbols — i.e. the BFP recover + scaling chain is
      correct; FFT-path symbol latency measured 518 cycles (constant across symbols;
      absolute value depends on the behavioral FFT model's latency).</div>`));
    ev.appendChild(W.provenance({ report: 'reports/tier2_ofdm_qam16_tier1.json',
      scenario: 'qam16_tier1', commit: COMMITS.fix, conditions: CONDITIONS }));
    root.appendChild(W.section('evidence', ev, { badge: 'MEASURED', badgeKind: 'measured' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'Why does a streaming FFT require buffering, and how can it maintain an initiation interval of one?',
        a: 'Two reasons: (1) a transform is defined over a BLOCK — output bin 0 depends ' +
          'on input sample 255, so at least one frame of state must exist inside or ' +
          'around the core; (2) system framing — CP insertion needs the END of the ' +
          'symbol first, and fftshift changes ordering. II=1 is kept by overlapping: the ' +
          'FFT pipeline processes frame k while frame k+1 streams in, and double ' +
          'buffering on the output lets read-out of k overlap the fill of k+1.',
      },
      advanced: {
        q: 'Why block floating point instead of fixed scaling per stage, and what does the design do with blk_exp?',
        a: 'Fixed 1/2-per-stage scaling destroys SNR on low-amplitude frames; full-width ' +
          'growth needs 8 extra bits. BFP scales only when a stage would overflow and ' +
          'reports the total shift as a per-frame exponent, preserving precision for the ' +
          'common case. The cost is that downstream math must re-align frames: our ' +
          'recover stage computes (out ≪ blk_exp) ≫ 4, so every frame returns to one ' +
          'global Q15 scale before the channel estimator compares symbols.',
      },
      model: 'Streaming FFT = log₂N butterfly stages + delay lines → II 1, latency ~N. ' +
        'Buffers exist for block semantics, reordering and CP; BFP trades a per-frame ' +
        'exponent for preserved mantissa precision.',
      spoken: 'I would walk through the TX path: QAM bins stream into the inverse FFT ' +
        'one per clock; the core is pipelined so it never stalls; it hands back time ' +
        'samples plus a block exponent. We multiply the exponent back, apply the 1/16 ' +
        'unitary scale with rounding, and land samples in a double buffer — because the ' +
        'cyclic prefix is the tail of the symbol, you cannot emit sample 0 until sample ' +
        '255 exists. Two buffers mean the IFFT fills one while the output drains the ' +
        'other, so the stream never gaps.',
      mistake: 'Treating blk_exp as constant across frames (it is data-dependent), or ' +
        'feeding data before the FWD/INV config handshake completes — invisible with a ' +
        'config-ignoring sim stub, dead on silicon.',
    })));
    return root;
  },
};

// ===========================================================================
// Chapter 4 — Multi-Bank Memory Architecture
// ===========================================================================
export const ch4 = {
  id: 'multibank',
  title: 'Multi-Bank Memory Architecture',
  subtitle: 'Why two banks could not hide the work, and three banks give exactly 1 sample/clock',
  render(ctx) {
    const root = h('<div></div>');
    const F = FRAME.frame, ANA = 650, PLAY = 4052;
    root.appendChild(W.section('concept', `
      A bank can be recycled only after every consumer has finished with it.
      With capture (${F} cycles), analysis (~${ANA}) and replay (~${PLAY}) per frame,
      a bank stays owned ≈ 2.1 frame periods — more than two banks can hide.
      Three banks + split ownership let capture(k+2) ∥ analysis(k+1) ∥ replay(k).`));

    const vis = h('<div></div>');
    // Gantt: before (2-bank serialized)
    vis.appendChild(W.gantt({
      title: 'BEFORE — 2-bank ping-pong, serialized FSM (measured behavior)',
      total: 3 * F + 2 * 650,
      rows: [
        { label: 'bank A', spans: [
          { from: 0, to: F, cls: 'cap', label: 'capture k' },
          { from: F, to: F + 650, cls: 'ana', label: 'analyze' },
          { from: F + 650, to: F + 650 + PLAY, cls: 'play', label: 'replay k' }] },
        { label: 'bank B', spans: [
          { from: F, to: 2 * F, cls: 'cap', label: 'capture k+1' },
          { from: F + 650 + PLAY, to: F + 650 + PLAY + 650, cls: 'ana', label: 'analyze' }] },
        { label: 's_axis input', spans: [
          { from: 0, to: 2 * F, cls: 'cap', label: 'accepting 1 smp/clk' },
          { from: 2 * F, to: 2 * F + 648, cls: 'stall', label: 'STALL 645–650' }] },
      ],
      marks: [{ at: F, label: 'frame' }, { at: 2 * F, label: '2·frame' }],
      caption: 'Measured baseline: one FSM did analyze→replay back-to-back, so bank A ' +
        'freed only after ~4810 cycles of work per 4160-cycle frame. Every frame the ' +
        'input stalled 645–650 cycles (trace: stall interval [8324–8968]).',
    }));
    vis.appendChild(W.gantt({
      title: 'AFTER — 3 banks, split analysis/playback engines (measured: 0 stalls)',
      total: 3 * F + 800,
      rows: [
        { label: 'bank 0', spans: [
          { from: 0, to: F, cls: 'cap', label: 'cap k' },
          { from: F, to: F + ANA, cls: 'ana', label: 'ana k' },
          { from: F + ANA + 20, to: F + ANA + 20 + PLAY, cls: 'play', label: 'replay k' }] },
        { label: 'bank 1', spans: [
          { from: F, to: 2 * F, cls: 'cap', label: 'cap k+1' },
          { from: 2 * F, to: 2 * F + ANA, cls: 'ana', label: 'ana k+1' },
          { from: 2 * F + ANA + 20, to: 2 * F + ANA + 20 + PLAY, cls: 'play', label: 'replay k+1' }] },
        { label: 'bank 2', spans: [
          { from: 2 * F, to: 3 * F, cls: 'cap', label: 'cap k+2' },
          { from: 3 * F, to: 3 * F + ANA, cls: 'ana', label: 'ana k+2' }] },
        { label: 's_axis input', spans: [
          { from: 0, to: 3 * F + 800, cls: 'cap', label: 'accepting 1 smp/clk — continuous' }] },
      ],
      marks: [{ at: F, label: 'frame' }, { at: 2 * F, label: '2·frame' }, { at: 3 * F, label: '3·frame' }],
      caption: 'Replay k overlaps capture/analysis of k+1 (different banks, independent ' +
        'read ports). Measured over 100 frames: bank-stage concurrency max 3 / mean 2.13, ' +
        'input gap total = 0 cycles.',
    }));
    vis.appendChild(W.stateDiagram({
      title: 'Bank ownership lifecycle (iq_capture_multibank)',
      width: 760, height: 150,
      states: [
        { id: 'FREE', x: 60, y: 75 }, { id: 'CAP', x: 210, y: 75, label: 'CAPTURING' },
        { id: 'OCC', x: 360, y: 75, label: 'OCCUPIED' },
        { id: 'ANA', x: 500, y: 75, label: 'ANALYSIS' },
        { id: 'PLAY', x: 640, y: 75, label: 'PLAYBACK', cls: 'hot' },
      ],
      edges: [
        { from: 'FREE', to: 'CAP', label: 'pre-arm' },
        { from: 'CAP', to: 'OCC', label: 'tlast (0-cycle switch)' },
        { from: 'OCC', to: 'ANA', label: 'ana_take' },
        { from: 'ANA', to: 'PLAY', label: 'ana_pass (job queue)' },
        { from: 'PLAY', to: 'FREE', label: 'play_free', curve: 90 },
        { from: 'ANA', to: 'FREE', label: 'ana_abort (no frame)', curve: -70 },
      ],
      caption: 'Ownership moves forward only; a bank in ANALYSIS/PLAYBACK is excluded from ' +
        'the capture pre-arm pool — a frame can never be overwritten before it is consumed.',
    }));
    // animated bank pipeline
    const FR = 24;
    vis.appendChild(W.animator({
      frames: FR, interval: 420,
      caption: 'Animated bank rotation (1 frame ≈ 8 ticks): colors = CAP (blue) / ANA ' +
        '(amber) / PLAY (teal). Note three different banks busy simultaneously in steady state.',
      render(f) {
        const svg = W.svgEl('svg', { viewBox: '0 0 700 120', class: 'ins-wave-svg' });
        for (let b = 0; b < 3; b++) {
          const t = W.svgEl('text', { x: 8, y: 34 + b * 32, class: 'ins-wave-label' }, svg);
          t.textContent = `bank ${b}`;
          // schedule: capture of frame j uses bank j%3 during ticks [8j, 8j+8)
          // analysis [8j+8, 8j+9.3), play [8j+9.4, 8j+17)
          let cls = '', label = 'FREE';
          for (let j = 0; j < 6; j++) {
            if (j % 3 !== b) continue;
            const c0 = 8 * j;
            if (f >= c0 && f < c0 + 8) { cls = 'cap'; label = `CAP k${j ? '+' + j : ''}`; }
            else if (f >= c0 + 8 && f < c0 + 10) { cls = 'ana'; label = 'ANA'; }
            else if (f >= c0 + 10 && f < c0 + 17) { cls = 'play'; label = 'PLAY'; }
          }
          W.svgEl('rect', { x: 90, y: 18 + b * 32, width: 560, height: 24, rx: 4,
            class: `ins-span ${cls}` }, svg);
          const tt = W.svgEl('text', { x: 370, y: 34 + b * 32,
            'text-anchor': 'middle', class: 'ins-span-label' }, svg);
          tt.textContent = label;
        }
        return svg;
      },
    }));
    root.appendChild(W.section('visual', vis, { badge: 'interactive', badgeKind: 'info' }));

    root.appendChild(W.section('equation', W.equationBox(
      'N<sub>banks</sub> ≥ ⌈ (T<sub>cap</sub> + T<sub>ana</sub> + T<sub>play</sub>) / T<sub>frame</sub> ⌉ = ⌈(4160+650+4052)/4160⌉ = 3',
      'Bank-count rule: a bank is owned for the whole pipeline latency; the pool must ' +
      'cover that lifetime measured in frame periods. Two banks ⇒ sustained deficit of ' +
      '~650 cycles/frame — no elastic buffer fixes a periodic deficit.')));

    root.appendChild(W.section('rtl', W.rtlRef([
      card(ctx, 'iq_capture_multibank', 'iq_capture_multibank.v', {
        gh: { localOnly: true },
        signals: ['bank_free[]', 'ana_take/ana_pass/play_free', 'a_rd_*/b_rd_*', 'cap_armed'],
        decision: 'Three iq_frame_buffer banks; the NEXT bank is pre-armed during capture ' +
          'so the active bank switches ON the tlast beat (zero-cycle handover); two read ' +
          'ports because analysis and playback read different banks concurrently.',
      }),
      card(ctx, 'frac_cfo_frame_corrector_top', 'frac_cfo_frame_corrector_top.v', {
        gh: { modified: true },
        signals: ['state (analysis)', 'pstate (playback)', 'job_v/job_pop'],
        decision: '1-deep job queue {slot_start, frac_phase} carries both the NCO ' +
          'parameters and the bank ownership from analysis to playback.',
      }),
    ])));

    const ev = h('<div></div>');
    const ba = ctx.m.ba;
    if (ba) {
      ev.appendChild(W.beforeAfter([
        { label: 'RX sustained rate (smp/clk ×1000)', before: Math.round(ba.rx_in_steady_rate.before * 1000), after: Math.round(ba.rx_in_steady_rate.after * 1000) },
        { label: 'input stall cycles (3 b2b frames)', before: ba.rxb2b_input_stall_cycles.before, after: ba.rxb2b_input_stall_cycles.after },
        { label: 'steady frame latency (cycles)', before: ba.frame_latency_steady.before, after: ba.frame_latency_steady.after },
      ], 'Measured before/after (same stimulus, same testbench)'));
    }
    ev.appendChild(h(`<div class="small">100-frame runs: cont100 — ${ctx.m.sf.cont100 ? ctx.m.sf.cont100.rx_stall_cycles : '—'} stall cycles,
      max gap ${ctx.m.sf.cont100 ? ctx.m.sf.cont100.rx_max_gap : '—'}; rxrf100 (unstoppable source) —
      ${ctx.m.sf.rxrf100 ? ctx.m.sf.rxrf100.rf_samples_lost : '—'}/416,000 samples lost, total bit errors
      ${ctx.m.sf.rxrf100 ? ctx.m.sf.rxrf100.total_bit_errors : '—'}/1,060,800.</div>`));
    ev.appendChild(W.provenance(provFix));
    root.appendChild(W.section('evidence', ev, { badge: 'MEASURED', badgeKind: 'measured' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'Why was double buffering insufficient here, and how did triple buffering eliminate the inter-frame stalls?',
        a: 'Double buffering hides processing only if processing ≤ one fill period. Our ' +
          'per-frame work was capture-exclusive analysis (~650) plus a 4032-cycle replay ' +
          '≈ 4700 > 4160, so each bank was owned ~2.1 frame periods and the ingest ' +
          'starved ~650 cycles/frame — measured, not theoretical. A third bank extends ' +
          'the pool to cover the ownership lifetime, and splitting analysis from replay ' +
          'into independent engines lets the three phases run on three different banks ' +
          'simultaneously. Measured result: zero stall cycles over 100 frames.',
      },
      advanced: {
        q: 'How do you prevent a bank from being overwritten while the replay engine still reads it?',
        a: 'Ownership, not timing. A bank leaves the free pool at capture pre-arm and ' +
          'returns only on play_free; the capture arbiter simply cannot select an owned ' +
          'bank, so correctness does not depend on any latency assumption. If every bank ' +
          'were owned, tready drops — data is delayed, never silently corrupted. We also ' +
          'exposed the ownership vector to the testbench and recorded it every cycle to ' +
          'prove max concurrency 3 with no conflicts.',
      },
      model: 'banks ≥ ⌈pipeline ownership time / frame period⌉; split producers/consumers ' +
        'into per-stage engines with explicit ownership handoff; per-bank RAMs give the ' +
        'independent read ports for free.',
      spoken: 'The receiver captures a frame, analyzes where it starts and what its CFO ' +
        'is, then replays the corrected slot. Originally one state machine did those in ' +
        'series — longer than a frame — so every new frame had to wait at the door. The ' +
        'fix is a classic pipeline: give each stage its own bank. While bank 0 replays ' +
        'frame k, bank 1 is being analyzed and bank 2 is catching frame k+2 off the ' +
        'antenna. Three banks because a bank is busy for about 2.1 frame times. After ' +
        'the change we pushed 100 gapless frames through at exactly one sample per clock.',
      mistake: 'Sizing buffers for the AVERAGE rather than the bank ownership lifetime, ' +
        'and muxing one physical read port between stages that must read concurrently — ' +
        'that silently halves stage throughput and reintroduces the stall.',
    })));
    return root;
  },
};

// ===========================================================================
// Chapter 5 — FSM Design & Scheduling
// ===========================================================================
export const ch5 = {
  id: 'fsm',
  title: 'FSM Design & Scheduling',
  subtitle: 'How innocent state transitions cost cycles — and how to remove them',
  render(ctx) {
    const root = h('<div></div>');
    root.appendChild(W.section('concept', `
      With nonblocking assignments, a decision made in state S takes effect one
      clock later. Any control hop of the form "stop → decide → restart" inserts
      a bubble even when data is ready. The cure is to make the decision IN the
      boundary cycle itself (Mealy-style look-ahead on registered state).`));

    const vis = h('<div></div>');
    vis.appendChild(W.waveform({
      title: 'BEFORE — TX CP-readout handover (reconstructed from RTL; bubble measured at every symbol boundary)',
      cycles: 8, cycle0: 285,
      signals: [
        { name: 'rc (sample idx)', kind: 'bus', wave: ['285','286','287', null, '0','1','2','3'] },
        { name: 'rd_active', kind: 'bit', wave: [1,1,1,0,1,1,1,1], cls: 'amber' },
        { name: 'm_valid', kind: 'bit', wave: [1,1,1,1,0,1,1,1] },
        { name: "filled[~rbuf]", kind: 'bit', wave: [1,1,1,1,1,1,1,1], cls: 'blue' },
      ],
      highlights: [{ from: 3, to: 5, label: '1-cycle bubble (re-arm)', cls: 'bad' }],
      caption: 'At rc==287 the FSM cleared rd_active; a SEPARATE statement re-armed it ' +
        'next cycle. The next buffer was already filled (blue) — the bubble was pure ' +
        'control. Measured: exactly 11 bubbles/slot at samples 863, 1151, …, 3743.',
    }));
    vis.appendChild(W.waveform({
      title: 'AFTER — seamless handover: decide at the boundary cycle',
      cycles: 8, cycle0: 285,
      signals: [
        { name: 'rc (sample idx)', kind: 'bus', wave: ['285','286','287','0','1','2','3','4'] },
        { name: 'rd_active', kind: 'bit', wave: [1,1,1,1,1,1,1,1], cls: 'amber' },
        { name: 'm_valid', kind: 'bit', wave: [1,1,1,1,1,1,1,1] },
      ],
      highlights: [{ from: 2, to: 4, label: "rd_active <= filled[~rbuf]; rbuf <= ~rbuf", cls: 'good' }],
      caption: 'One line: at the last sample, flip to the other buffer IF it is already ' +
        'filled — rd_active never drops. Measured after: 4032 samples in 4032 cycles.',
    }));
    vis.appendChild(W.waveform({
      title: 'Start-pending slot chaining (tx_ofdm_top)',
      cycles: 10, cycle0: 4028,
      signals: [
        { name: 'start (pulse mid-slot)', kind: 'bit', wave: [0,0,0,0,0,0,0,0,0,0] },
        { name: 'start_pend', kind: 'bit', wave: [1,1,1,1,0,0,0,0,0,0], cls: 'amber' },
        { name: 'slot_pos', kind: 'bus', wave: ['4028','..','4031','0','1','2','3','4','5','6'] },
        { name: 'm_valid', kind: 'bit', wave: [1,1,1,1,1,1,1,1,1,1] },
      ],
      highlights: [{ from: 2, to: 4, label: 'S_DATA → S_SYNC directly (no S_IDLE)', cls: 'good' }],
      caption: 'A start received while busy is latched; at the last slot sample the FSM ' +
        're-enters S_SYNC in the same cycle. Measured: 3 chained slots, 12,096 samples ' +
        'in 12,096 cycles (0 idle).',
    }));
    vis.appendChild(W.waveform({
      title: 'Race class: a state-gated pulse latch (phase3_sync_top Meyr latch)',
      cycles: 9,
      signals: [
        { name: 'FSM state', kind: 'bus', wave: ['RUN','RUN','DONE','IDLE','RUN','RUN','RUN','RUN','RUN'] },
        { name: 'meyr_cfo_valid', kind: 'bit', wave: [0,0,0,1,0,0,0,0,0], cls: 'amber' },
        { name: 'latched (old, gated)', kind: 'bit', wave: [0,0,0,0,0,0,0,0,0] },
        { name: 'latched (new, uncond.)', kind: 'bit', wave: [0,0,0,1,1,1,1,1,1], cls: 'blue' },
      ],
      highlights: [{ from: 3, to: 4, label: 'pulse lands outside S_RUN', cls: 'bad' }],
      caption: 'Conceptual Example of a real fix: when `done` moved earlier (overlap), a ' +
        '1-cycle result pulse could land while the FSM was between states. A latch for a ' +
        'single-cycle pulse must not be gated by FSM state unless the pulse is ' +
        'guaranteed inside that state.',
    }));
    root.appendChild(W.section('visual', vis));

    root.appendChild(W.section('equation', W.equationBox(
      'bubble ⇔ ∃ cycle c: data_ready(c) ∧ ¬issue(c) — with NBA: issue(c) = f(state(c−1))',
      'Nonblocking semantics: everything you decide this edge is visible NEXT edge. ' +
      'Zero-bubble handover therefore requires computing the next grant from ' +
      'current-cycle conditions at the boundary itself.')));

    root.appendChild(W.section('rtl', W.rtlRef([
      card(ctx, 'tx_ifft_frontend', 'tx_ifft_frontend.v', {
        gh: { modified: true }, signals: ['rd_active', 'rbuf', 'filled[1:0]', 'rc'],
        decision: 'Seamless handover: `rd_active <= filled[~rbuf]` at rc==SYM_LEN−1 ' +
          '(legacy re-arm kept as fallback for the empty-buffer case).' }),
      card(ctx, 'tx_ofdm_top', 'tx_ofdm_top.v', {
        gh: { modified: true }, signals: ['start_pend', 'state', 'slot_done'],
        decision: 'Pending-start latch + direct S_DATA→S_SYNC transition; same-cycle ' +
          'new-start race handled (`start_pend <= start` at consume).' }),
      card(ctx, 'phase3_sync_top', 'phase3_sync_top.v', {
        gh: { modified: true }, signals: ['meyr_cfo_valid', 'frac_m_first_beat'],
        decision: 'Pulse latch made unconditional; slot-start pulse re-derived from the ' +
          'stream (tlast) instead of a control pulse that now fires mid-replay.' }),
    ])));

    const ev = h('<div></div>');
    ev.appendChild(h(`<table class="tbl">
      <tr><th>FSM change</th><th>measured effect</th></tr>
      <tr><td>readout handover (tx_ifft_frontend)</td><td>11 bubbles/slot → 0 (txkick)</td></tr>
      <tr><td>start_pend chaining (tx_ofdm_top)</td><td>inter-slot idle 2–3 → 0 (txchain)</td></tr>
      <tr><td>analysis/playback split + latch fixes (RX)</td><td>645–650 stall/frame → 0; 100-frame BER 0 (cont100)</td></tr>
    </table>`));
    ev.appendChild(W.provenance(provFix));
    root.appendChild(W.section('evidence', ev, { badge: 'MEASURED', badgeKind: 'measured' }));

    root.appendChild(W.section('interview', W.interview({
      fundamental: {
        q: 'How can a seemingly harmless FSM state transition introduce a one-cycle throughput bubble?',
        a: 'Because with nonblocking assignments a decision is observable one clock ' +
          'later. If the boundary cycle only CLEARS the grant and a separate arm ' +
          'condition re-raises it, there is necessarily one cycle where data was ready ' +
          'but nothing issued. Our TX readout did exactly that at every symbol boundary ' +
          '— 11 one-cycle bubbles per slot, found by diffing transfer timestamps, fixed ' +
          'by granting the next buffer in the boundary cycle itself.',
      },
      advanced: {
        q: 'When you split one FSM into two cooperating engines, what new hazard classes appear?',
        a: 'Three: (1) pulse-crossing — one-cycle events from engine A can land while ' +
          'engine B is between states (our Meyr latch; fix: unconditional latches or ' +
          'level+ack); (2) shared-resource handoff — ownership must transfer explicitly ' +
          '(job queue + bank pass), never inferred from timing; (3) control signals ' +
          'whose MEANING shifted — frac_start used to mark "stream begins", after the ' +
          'split it fires mid-replay of the previous frame, so the slot-start pulse had ' +
          'to be re-derived from the data stream itself. All three bit us and were ' +
          'caught in multi-frame simulation.',
      },
      model: 'Moore output = f(state) is a cycle late by construction; zero-bubble ' +
        'scheduling needs Mealy-style issue = f(state, current conditions) at ' +
        'boundaries, explicit ownership handoff, and no state-gated pulse latches.',
      spoken: 'My favorite example: our transmitter lost exactly eleven cycles per ' +
        'slot, one at every symbol boundary. The data was ready — the double buffer ' +
        'was full — but the FSM first cleared its read-enable, and a separate rule ' +
        're-armed it a cycle later. The fix is one line: at the last sample, assign ' +
        'read-enable from whether the OTHER buffer is filled. Nonblocking assignments ' +
        'make the value appear at the right edge, so the stream never gaps. The lesson ' +
        'is to design handovers inside the boundary cycle, not after it.',
      mistake: 'Returning to IDLE "for cleanliness" between back-to-back operations; ' +
        'and latching a 1-cycle done/valid pulse inside a specific state — any ' +
        'scheduling change silently drops the pulse.',
    })));
    return root;
  },
};
