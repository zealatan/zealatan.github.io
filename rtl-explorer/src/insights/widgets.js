// Shared visual widgets for the Design Insights chapters.
// Pure DOM/SVG, no dependencies. All animations expose play/pause/step/reset
// and start PAUSED when the user prefers reduced motion.

const NS = 'http://www.w3.org/2000/svg';

export function svgEl(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export function h(html) {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.childElementCount === 1 ? d.firstElementChild : d;
}

export const reducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Chapter section scaffolding (layout A-F)
// ---------------------------------------------------------------------------
const SECTION_META = {
  concept:  { label: 'The Core Concept',               cls: 'concept'  },
  visual:   { label: 'Interactive Visual Explanation', cls: 'visual'   },
  equation: { label: 'Key Equation',                   cls: 'equation' },
  rtl:      { label: 'Where It Exists in Our RTL',     cls: 'rtl'      },
  evidence: { label: 'Measured Evidence',              cls: 'evidence' },
  interview:{ label: 'Interview Preparation',          cls: 'interview'},
};

export function section(kind, content, opts = {}) {
  const meta = SECTION_META[kind];
  const sec = h(`<section class="ins-sec ins-${meta.cls}">
    <h3 class="ins-sec-title">${meta.label}
      ${opts.badge ? `<span class="ins-badge ins-badge-${opts.badgeKind || 'info'}">${opts.badge}</span>` : ''}
    </h3></section>`);
  if (typeof content === 'string') sec.appendChild(h(`<div class="ins-body">${content}</div>`));
  else sec.appendChild(content);
  return sec;
}

export function equationBox(htmlEq, note) {
  return h(`<div><div class="ins-eq">${htmlEq}</div>
    ${note ? `<div class="small muted">${note}</div>` : ''}</div>`);
}

export function provenance(p) {
  // p: {report, scenario, commit, conditions}
  return h(`<div class="ins-prov small">Provenance — report: <code>${p.report}</code>
    ${p.scenario ? ` · scenario: <code>${p.scenario}</code>` : ''}
    · commit: <code>${p.commit}</code><br>conditions: ${p.conditions}</div>`);
}

// RTL reference card. links: [{label, href}] built by the chapter context.
export function rtlRef(items) {
  const wrap = h('<div class="ins-rtl-cards"></div>');
  for (const it of items) {
    wrap.appendChild(h(`<div class="ins-rtl-card">
      <div class="ins-rtl-mod">${it.explorerLink
        ? `<a href="${it.explorerLink}">${it.module}</a>` : it.module}
        <span class="muted small">${it.file}</span></div>
      ${it.signals ? `<div class="small">signals: ${it.signals.map(s => `<code>${s}</code>`).join(' ')}</div>` : ''}
      ${it.decision ? `<div class="small">${it.decision}</div>` : ''}
      <div class="small">${it.github
        ? `<a href="${it.github}" target="_blank" rel="noopener">GitHub source ↗</a>` : ''}
        ${it.localNote ? ` <span class="ins-badge ins-badge-warn">${it.localNote}</span>` : ''}</div>
    </div>`));
  }
  return wrap;
}

export function interview(qa) {
  // qa: {fundamental, advanced, model, spoken, mistake}
  const wrap = h('<div class="ins-qa"></div>');
  const block = (title, body, open = false) => {
    const d = h(`<details class="ins-qa-item"${open ? ' open' : ''}>
      <summary>${title}</summary><div class="ins-qa-body">${body}</div></details>`);
    wrap.appendChild(d);
  };
  block(`Q (fundamental): ${qa.fundamental.q}`, qa.fundamental.a, true);
  block(`Q (advanced): ${qa.advanced.q}`, qa.advanced.a);
  block('Model answer (concise)', qa.model);
  block('30–60 s spoken explanation', `<em>${qa.spoken}</em>`);
  block('Common design mistake', `⚠ ${qa.mistake}`);
  return wrap;
}

// ---------------------------------------------------------------------------
// Waveform renderer (static, annotated)
// spec: {cycles, signals:[{name, kind:'clk'|'bit'|'bus', wave, cls}],
//        annotations:[{cycle,text}], highlights:[{from,to,label,cls}], title, caption}
// bit wave: array of 0/1; bus wave: array of (string|null)
// ---------------------------------------------------------------------------
export function waveform(spec) {
  const CW = spec.cw || 34, RH = 26, LBL = spec.lbl || 120, PAD = 6;
  const n = spec.cycles;
  const W = LBL + n * CW + PAD * 2;
  const hasHlLabels = (spec.highlights || []).some(x => x.label);
  const H = spec.signals.length * RH + 30 + (hasHlLabels ? 16 : 0);
  const wrap = h(`<div class="ins-wave">${spec.title ?
    `<div class="ins-wave-title">${spec.title}</div>` : ''}</div>`);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ins-wave-svg' });
  // highlights behind everything
  for (const hl of spec.highlights || []) {
    svgEl('rect', { x: LBL + hl.from * CW, y: 0, width: (hl.to - hl.from) * CW,
                    height: spec.signals.length * RH + 8,
                    class: `ins-hl ${hl.cls || ''}` }, svg);
    if (hl.label) {
      const t = svgEl('text', { x: LBL + (hl.from + (hl.to - hl.from) / 2) * CW,
        y: spec.signals.length * RH + 28, 'text-anchor': 'middle',
        class: 'ins-hl-label' }, svg);
      t.textContent = hl.label;
    }
  }
  spec.signals.forEach((sig, si) => {
    const y0 = si * RH + 6, hi = y0 + 2, lo = y0 + RH - 9;
    const lab = svgEl('text', { x: 4, y: lo - 2, class: 'ins-wave-label' }, svg);
    lab.textContent = sig.name;
    if (sig.kind === 'clk') {
      let d = '';
      for (let c = 0; c < n; c++) {
        const x = LBL + c * CW;
        d += `M ${x} ${lo} L ${x} ${hi} L ${x + CW / 2} ${hi} L ${x + CW / 2} ${lo} L ${x + CW} ${lo} `;
      }
      svgEl('path', { d, class: 'ins-wl ins-wl-clk', fill: 'none' }, svg);
    } else if (sig.kind === 'bit') {
      let prev = sig.wave[0];
      let d = `M ${LBL} ${prev ? hi : lo} `;
      for (let c = 0; c < n; c++) {
        const v = sig.wave[c], x = LBL + c * CW;
        if (v !== prev) d += `L ${x} ${prev ? hi : lo} L ${x} ${v ? hi : lo} `;
        d += `L ${x + CW} ${v ? hi : lo} `;
        prev = v;
      }
      svgEl('path', { d, class: `ins-wl ${sig.cls || ''}`, fill: 'none' }, svg);
    } else { // bus
      for (let c = 0; c < n; c++) {
        const v = sig.wave[c], x = LBL + c * CW;
        if (v === null || v === undefined) {
          svgEl('line', { x1: x, x2: x + CW, y1: (hi + lo) / 2, y2: (hi + lo) / 2,
                          class: 'ins-wl-idle' }, svg);
        } else {
          svgEl('rect', { x: x + 1, y: hi, width: CW - 2, height: lo - hi,
                          class: `ins-bus ${sig.cls || ''}` }, svg);
          const t = svgEl('text', { x: x + CW / 2, y: (hi + lo) / 2 + 3.5,
            'text-anchor': 'middle', class: 'ins-busval' }, svg);
          t.textContent = v;
        }
      }
    }
  });
  // cycle ruler
  for (let c = 0; c < n; c++) {
    const t = svgEl('text', { x: LBL + c * CW + CW / 2, y: spec.signals.length * RH + 14,
      'text-anchor': 'middle', class: 'ins-cycle-num' }, svg);
    t.textContent = spec.cycle0 !== undefined ? spec.cycle0 + c : c;
  }
  wrap.appendChild(svg);
  if (spec.caption) wrap.appendChild(h(`<div class="ins-caption small">${spec.caption}</div>`));
  return wrap;
}

// ---------------------------------------------------------------------------
// Animator: generic frame-stepped animation with controls.
// render(frameIdx) redraws into its own container.
// ---------------------------------------------------------------------------
export function animator({ frames, render, interval = 600, caption = null }) {
  const wrap = h('<div class="ins-anim"></div>');
  const stage = h('<div class="ins-anim-stage"></div>');
  const bar = h(`<div class="ins-anim-bar">
      <button class="btn" data-a="play">▶</button>
      <button class="btn" data-a="pause">⏸</button>
      <button class="btn" data-a="step">⭢ step</button>
      <button class="btn" data-a="reset">↺ reset</button>
      <span class="ins-anim-pos small muted"></span>
    </div>`);
  wrap.appendChild(stage);
  wrap.appendChild(bar);
  if (caption) wrap.appendChild(h(`<div class="ins-caption small">${caption}</div>`));
  let idx = 0, timer = null;
  const pos = bar.querySelector('.ins-anim-pos');
  function draw() {
    stage.innerHTML = '';
    stage.appendChild(render(idx));
    pos.textContent = `cycle ${idx} / ${frames - 1}`;
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function play() {
    if (timer) return;
    timer = setInterval(() => {
      idx = (idx + 1) % frames;
      draw();
    }, interval);
  }
  bar.addEventListener('click', ev => {
    const a = ev.target.dataset && ev.target.dataset.a;
    if (!a) return;
    if (a === 'play') play();
    if (a === 'pause') stop();
    if (a === 'step') { stop(); idx = (idx + 1) % frames; draw(); }
    if (a === 'reset') { stop(); idx = 0; draw(); }
  });
  draw();
  if (!reducedMotion()) play();      // reduced-motion users start paused
  wrap.destroy = stop;
  return wrap;
}

// ---------------------------------------------------------------------------
// Before/after horizontal bars.
// items: [{label, before, after, unit, betterLow}]
// ---------------------------------------------------------------------------
export function beforeAfter(items, title) {
  const wrap = h(`<div class="ins-ba">${title ? `<div class="ins-wave-title">${title}</div>` : ''}</div>`);
  for (const it of items) {
    const max = Math.max(it.before, it.after, 1e-9);
    const row = h(`<div class="ins-ba-row">
      <div class="ins-ba-label">${it.label}</div>
      <div class="ins-ba-bars">
        <div class="ins-ba-bar before" style="width:${100 * it.before / max}%">
          <span>before: ${it.before}${it.unit || ''}</span></div>
        <div class="ins-ba-bar after" style="width:${Math.max(100 * it.after / max, 2)}%">
          <span>after: ${it.after}${it.unit || ''}</span></div>
      </div></div>`);
    wrap.appendChild(row);
  }
  return wrap;
}

// ---------------------------------------------------------------------------
// Simple state diagram: states [{id,x,y,label}], edges [{from,to,label,curve}]
// ---------------------------------------------------------------------------
export function stateDiagram({ states, edges, width = 640, height = 220, title, caption }) {
  const wrap = h(`<div class="ins-wave">${title ? `<div class="ins-wave-title">${title}</div>` : ''}</div>`);
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'ins-wave-svg' });
  const defs = svgEl('defs', {}, svg);
  const mk = svgEl('marker', { id: 'ins-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5,
    markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'ins-arrowhead' }, mk);
  const byId = Object.fromEntries(states.map(s => [s.id, s]));
  for (const e of edges) {
    const a = byId[e.from], b = byId[e.to];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const ux = dx / len, uy = dy / len;
    const r = 26;
    const x1 = a.x + ux * r, y1 = a.y + uy * r;
    const x2 = b.x - ux * (r + 4), y2 = b.y - uy * (r + 4);
    const c = e.curve || 0;
    const mx = (x1 + x2) / 2 - uy * c, my = (y1 + y2) / 2 + ux * c;
    svgEl('path', { d: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`,
      class: `ins-edge ${e.cls || ''}`, fill: 'none', 'marker-end': 'url(#ins-arrow)' }, svg);
    if (e.label) {
      const t = svgEl('text', { x: mx, y: my - 4, 'text-anchor': 'middle',
        class: 'ins-edge-label' }, svg);
      t.textContent = e.label;
    }
  }
  for (const s of states) {
    svgEl('circle', { cx: s.x, cy: s.y, r: 26, class: `ins-state ${s.cls || ''}` }, svg);
    const t = svgEl('text', { x: s.x, y: s.y + 4, 'text-anchor': 'middle',
      class: 'ins-state-label' }, svg);
    t.textContent = s.label || s.id;
  }
  wrap.appendChild(svg);
  if (caption) wrap.appendChild(h(`<div class="ins-caption small">${caption}</div>`));
  return wrap;
}

// ---------------------------------------------------------------------------
// Gantt chart: rows [{label, spans:[{from,to,cls,label}]}], axis in cycles.
// ---------------------------------------------------------------------------
export function gantt({ rows, total, title, caption, marks = [], playhead = null, width = 860 }) {
  const RH = 30, LBL = 130, PADR = 10;
  const H = rows.length * RH + 34;
  const sx = x => LBL + (x / total) * (width - LBL - PADR);
  const wrap = h(`<div class="ins-wave">${title ? `<div class="ins-wave-title">${title}</div>` : ''}</div>`);
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${H}`, class: 'ins-wave-svg' });
  rows.forEach((r, i) => {
    const y = i * RH + 6;
    const t = svgEl('text', { x: 4, y: y + RH / 2 + 2, class: 'ins-wave-label' }, svg);
    t.textContent = r.label;
    svgEl('line', { x1: LBL, x2: width - PADR, y1: y + RH - 8, y2: y + RH - 8,
      class: 'ins-gantt-rail' }, svg);
    for (const sp of r.spans) {
      svgEl('rect', { x: sx(sp.from), y, width: Math.max(sx(sp.to) - sx(sp.from), 2),
        height: RH - 12, rx: 3, class: `ins-span ${sp.cls || ''}` }, svg);
      if (sp.label && sx(sp.to) - sx(sp.from) > 40) {
        const tt = svgEl('text', { x: (sx(sp.from) + sx(sp.to)) / 2, y: y + RH / 2 - 1,
          'text-anchor': 'middle', class: 'ins-span-label' }, svg);
        tt.textContent = sp.label;
      }
    }
  });
  for (const m of marks) {
    svgEl('line', { x1: sx(m.at), x2: sx(m.at), y1: 0, y2: rows.length * RH,
      class: 'ins-gantt-mark' }, svg);
    const t = svgEl('text', { x: sx(m.at), y: rows.length * RH + 14,
      'text-anchor': 'middle', class: 'ins-cycle-num' }, svg);
    t.textContent = m.label;
  }
  if (playhead !== null) {
    svgEl('line', { x1: sx(playhead), x2: sx(playhead), y1: 0, y2: rows.length * RH,
      class: 'ins-playhead' }, svg);
  }
  wrap.appendChild(svg);
  if (caption) wrap.appendChild(h(`<div class="ins-caption small">${caption}</div>`));
  return wrap;
}

// Generic labeled-box SVG diagram builder for architecture figures.
// boxes [{id,x,y,w,h,label,sub,cls}], arrows [{from,to,label,fromSide,toSide,cls}]
export function blockDiagram({ boxes, arrows, width = 860, height = 240, title, caption }) {
  const wrap = h(`<div class="ins-wave">${title ? `<div class="ins-wave-title">${title}</div>` : ''}</div>`);
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, class: 'ins-wave-svg' });
  const defs = svgEl('defs', {}, svg);
  const mk = svgEl('marker', { id: 'ins-arrow2', viewBox: '0 0 10 10', refX: 9, refY: 5,
    markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, defs);
  svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'ins-arrowhead' }, mk);
  const byId = Object.fromEntries(boxes.map(b => [b.id, b]));
  const anchor = (b, side) => {
    if (side === 'r') return [b.x + b.w, b.y + b.h / 2];
    if (side === 'l') return [b.x, b.y + b.h / 2];
    if (side === 't') return [b.x + b.w / 2, b.y];
    return [b.x + b.w / 2, b.y + b.h];
  };
  for (const a of arrows || []) {
    const f = byId[a.from], t = byId[a.to];
    const [x1, y1] = anchor(f, a.fromSide || 'r');
    const [x2, y2] = anchor(t, a.toSide || 'l');
    const mx = (x1 + x2) / 2;
    svgEl('path', { d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`,
      class: `ins-edge ${a.cls || ''}`, fill: 'none', 'marker-end': 'url(#ins-arrow2)' }, svg);
    if (a.label) {
      const tt = svgEl('text', { x: mx, y: (y1 + y2) / 2 - 5, 'text-anchor': 'middle',
        class: 'ins-edge-label' }, svg);
      tt.textContent = a.label;
    }
  }
  for (const b of boxes) {
    svgEl('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 7,
      class: `ins-block ${b.cls || ''}` }, svg);
    const t = svgEl('text', { x: b.x + b.w / 2, y: b.y + (b.sub ? b.h / 2 - 4 : b.h / 2 + 4),
      'text-anchor': 'middle', class: 'ins-block-label' }, svg);
    t.textContent = b.label;
    if (b.sub) {
      const s = svgEl('text', { x: b.x + b.w / 2, y: b.y + b.h / 2 + 12,
        'text-anchor': 'middle', class: 'ins-block-sub' }, svg);
      s.textContent = b.sub;
    }
  }
  wrap.appendChild(svg);
  if (caption) wrap.appendChild(h(`<div class="ins-caption small">${caption}</div>`));
  return wrap;
}
