// Timing view: AXI-Stream / AXI4-Lite handshake protocol examples (clearly
// labeled - no captured VCD/FST traces exist in this workspace) plus the REAL
// measured event latencies from the tier-2 capture reports.
const NS = 'http://www.w3.org/2000/svg';

// waveform spec: name -> array of levels per cycle (0,1) or values (strings)
const AXIS_EXAMPLE = {
  title: 'AXI-Stream handshake - Protocol Example (not simulation data)',
  cycles: 10,
  signals: [
    { name: 'aclk', kind: 'clk' },
    { name: 'tvalid', kind: 'bit', wave: [0, 1, 1, 1, 1, 0, 1, 1, 1, 0] },
    { name: 'tready', kind: 'bit', wave: [1, 1, 0, 0, 1, 1, 1, 1, 1, 1] },
    { name: 'tdata', kind: 'bus', wave: [null, 'D0', 'D1', 'D1', 'D1', null, 'D2', 'D3', 'D4', null] },
    { name: 'tlast', kind: 'bit', wave: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0] },
  ],
  notes: [
    'A beat transfers when tvalid && tready on a rising clock edge.',
    'Cycle 2-3: the sink back-pressures (tready=0); the source must HOLD tdata/tvalid (D1 held).',
    'tlast marks the final beat of a frame/packet (here D4).',
    'tuser (where present) carries per-beat sideband, e.g. the xfft blk_exp or the equalizer bin index.',
  ],
};

const AXIL_EXAMPLE = {
  title: 'AXI4-Lite write - Protocol Example (not simulation data)',
  cycles: 8,
  signals: [
    { name: 'aclk', kind: 'clk' },
    { name: 'awvalid', kind: 'bit', wave: [0, 1, 1, 0, 0, 0, 0, 0] },
    { name: 'awready', kind: 'bit', wave: [0, 0, 1, 0, 0, 0, 0, 0] },
    { name: 'wvalid', kind: 'bit', wave: [0, 1, 1, 0, 0, 0, 0, 0] },
    { name: 'wready', kind: 'bit', wave: [0, 0, 1, 0, 0, 0, 0, 0] },
    { name: 'bvalid', kind: 'bit', wave: [0, 0, 0, 1, 1, 0, 0, 0] },
    { name: 'bready', kind: 'bit', wave: [1, 1, 1, 1, 1, 1, 1, 1] },
  ],
  notes: [
    'Address and data channels handshake independently; the write response (bvalid/bready) completes the transaction.',
    'In this design the AXI4-Lite slave is phase3_axi_lite_regs (sync control/status; 0x04 enable, 0x0C frame_len, ...).',
  ],
};

export class TimingView {
  constructor(container, store) {
    this.el = container;
    this.store = store;
  }

  show(signalName = null, cls = null) {
    const scen = (this.store.verification?.scenarios) || [];
    const h = [];
    h.push(`<div class="timing-head"><h2>Timing view</h2>
      <button class="btn" id="btn-close-timing">✕ close</button></div>`);
    if (signalName) {
      h.push(`<p>Selected signal: <code>${signalName}</code> (${cls || 'signal'}). ` +
        `No captured waveform traces (VCD/FST) exist under ~/zedboard-digital-twin, ` +
        `so the diagrams below are labeled protocol examples.</p>`);
    }
    h.push('<div id="wave-axis"></div>');
    h.push('<div id="wave-axil"></div>');
    if (scen.length) {
      h.push(`<h3>Measured tier-2 latencies (REAL data from cocotb captures)</h3>
        <table class="tbl"><tr><th>scenario</th><th>event</th><th>cycle (from start)</th></tr>` +
        scen.map(s => {
          const lat = s.latency_from_start_cycles || {};
          return Object.entries(lat).map(([k, v]) =>
            `<tr><td>${s.scenario}</td><td>${k.replace('_from_start', '')}</td><td>${v}</td></tr>`).join('');
        }).join('') + `</table>
        <div class="small muted">Clock = 250 MHz. End-to-end last demod bit:
        ${scen[0]?.latency_bits_last_us_at_250mhz} µs. Source: ${scen.map(s => s.source_report).join(', ')}</div>`);
    }
    this.el.innerHTML = h.join('\n');
    this.el.querySelector('#wave-axis').appendChild(renderWave(AXIS_EXAMPLE));
    this.el.querySelector('#wave-axil').appendChild(renderWave(AXIL_EXAMPLE));
    this.el.querySelector('#btn-close-timing').onclick = () => this.hide();
    this.el.classList.add('open');
  }

  hide() { this.el.classList.remove('open'); }
}

function renderWave(spec) {
  const CW = 46, RH = 26, LBL = 90, PAD = 8;
  const W = LBL + spec.cycles * CW + PAD * 2;
  const H = spec.signals.length * RH + 70 + spec.notes.length * 16;
  const wrap = document.createElement('div');
  wrap.className = 'wave-block';
  const title = document.createElement('div');
  title.className = 'wave-title';
  title.textContent = spec.title;
  wrap.appendChild(title);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${spec.signals.length * RH + 20}`);
  svg.setAttribute('class', 'wave-svg');
  spec.signals.forEach((sig, si) => {
    const y0 = si * RH + 6, hi = y0 + 2, lo = y0 + RH - 8;
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', 4); t.setAttribute('y', lo - 2);
    t.setAttribute('class', 'wave-label');
    t.textContent = sig.name;
    svg.appendChild(t);
    let dpath = '';
    if (sig.kind === 'clk') {
      for (let c = 0; c < spec.cycles; c++) {
        const x = LBL + c * CW;
        dpath += `M ${x} ${lo} L ${x} ${hi} L ${x + CW / 2} ${hi} L ${x + CW / 2} ${lo} L ${x + CW} ${lo} `;
      }
    } else if (sig.kind === 'bit') {
      let prev = sig.wave[0];
      dpath = `M ${LBL} ${prev ? hi : lo} `;
      for (let c = 0; c < spec.cycles; c++) {
        const v = sig.wave[c], x = LBL + c * CW;
        if (v !== prev) dpath += `L ${x} ${prev ? hi : lo} L ${x} ${v ? hi : lo} `;
        dpath += `L ${x + CW} ${v ? hi : lo} `;
        prev = v;
      }
    }
    if (dpath) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', dpath); p.setAttribute('class', `wave-line wave-${sig.kind}`);
      p.setAttribute('fill', 'none');
      svg.appendChild(p);
    }
    if (sig.kind === 'bus') {
      for (let c = 0; c < spec.cycles; c++) {
        const v = sig.wave[c], x = LBL + c * CW;
        if (v === null) {
          const l = document.createElementNS(NS, 'line');
          l.setAttribute('x1', x); l.setAttribute('x2', x + CW);
          l.setAttribute('y1', (hi + lo) / 2); l.setAttribute('y2', (hi + lo) / 2);
          l.setAttribute('class', 'wave-idle');
          svg.appendChild(l);
        } else {
          const r = document.createElementNS(NS, 'rect');
          r.setAttribute('x', x + 1); r.setAttribute('y', hi);
          r.setAttribute('width', CW - 2); r.setAttribute('height', lo - hi);
          r.setAttribute('class', 'wave-bus');
          svg.appendChild(r);
          const tv = document.createElementNS(NS, 'text');
          tv.setAttribute('x', x + CW / 2); tv.setAttribute('y', (hi + lo) / 2 + 4);
          tv.setAttribute('text-anchor', 'middle'); tv.setAttribute('class', 'wave-busval');
          tv.textContent = v;
          svg.appendChild(tv);
        }
      }
    }
  });
  wrap.appendChild(svg);
  const notes = document.createElement('ul');
  notes.className = 'wave-notes';
  for (const n of spec.notes) {
    const li = document.createElement('li'); li.textContent = n; notes.appendChild(li);
  }
  wrap.appendChild(notes);
  return wrap;
}
