// SVG diagram renderer + interactions: zoom/pan, fit, minimap, selection,
// drill-down, expand-in-place, SVG/PNG export.
import { edgePath, widthLabel } from '../core/graph.js';

const NS = 'http://www.w3.org/2000/svg';
const CLS_COLOR = {
  data: 'var(--c-data)', control: 'var(--c-ctrl)', clock: 'var(--c-clk)',
  reset: 'var(--c-clk)', axis: 'var(--c-axis)', axil: 'var(--c-axil)',
};

function el(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

export class DiagramView {
  constructor(svg, minimapSvg) {
    this.svg = svg;
    this.minimap = minimapSvg;
    this.vb = { x: 0, y: 0, w: 100, h: 100 };
    this.diagram = null;
    this.handlers = {};
    this._bindPanZoom();
  }

  on(name, fn) { this.handlers[name] = fn; return this; }
  _fire(name, ...a) { this.handlers[name] && this.handlers[name](...a); }

  render(diagram, selection = null) {
    this.diagram = diagram;
    this.selection = selection;
    this.svg.innerHTML = '';
    const root = el('g', { class: 'dg-root' }, this.svg);
    this._drawEdges(root, diagram, selection);
    this._drawParentPorts(root, diagram, selection);
    for (const n of diagram.nodes) this._drawNode(root, n, diagram, selection);
    if (diagram.clkBadgesTop.length) {
      const t = el('text', { x: 16, y: 24, class: 'clk-badge' }, root);
      t.textContent = `⏱ ${diagram.clkBadgesTop.join(', ')} (clock/reset nets hidden - toggle in toolbar)`;
    }
    this._renderMinimap();
  }

  // ---------- drawing ----------
  _drawParentPorts(root, d, sel) {
    for (const side of ['left', 'right']) {
      for (const p of d.parentPorts[side]) {
        const g = el('g', { class: 'pport' + (sel === `port:${p.name}` ? ' selected' : ''),
                            transform: `translate(${p.x},${p.y})` }, root);
        const w = 150, dirIn = p.dir === 'in';
        const rx = side === 'left' ? -w : 0;
        el('rect', { x: rx, y: -9, width: w, height: 18, rx: 4,
                     class: `pport-box cls-${p.class}` }, g);
        const label = el('text', { x: rx + 6, y: 4, class: 'pport-text' }, g);
        label.textContent = `${dirIn ? '▸' : p.dir === 'inout' ? '◂▸' : '◂'} ${p.name}  ${widthLabel(p.width)}`;
        g.addEventListener('click', ev => {
          ev.stopPropagation(); this._fire('selectPort', p);
        });
        const t = el('title', {}, g);
        t.textContent = `${p.dir} ${p.name} ${widthLabel(p.width)} - declared ${p.declared}`;
      }
    }
  }

  _drawNode(root, n, d, sel) {
    const selected = sel === `inst:${n.inst}`;
    const g = el('g', { class: 'node' + (n.vendorIP ? ' vendor' : '') +
                        (selected ? ' selected' : ''),
                        transform: `translate(${n.x},${n.y})` }, root);
    el('rect', { width: n.w, height: n.h, rx: 8, class: 'node-box' }, g);
    el('rect', { width: n.w, height: 24, rx: 8, class: 'node-head' }, g);
    const title = el('text', { x: 8, y: 16, class: 'node-title' }, g);
    title.textContent = n.inst;
    const sub = el('text', { x: n.w - 8, y: 16, class: 'node-sub', 'text-anchor': 'end' }, g);
    sub.textContent = n.vendorIP ? `${n.base} · IP` : n.base;
    if (n.vendorIP) {
      const b = el('text', { x: 8, y: n.h - 6, class: 'vendor-tag' }, g);
      b.textContent = 'Vendor IP / Black Box';
    }
    for (const p of n.inPorts) {
      const t = el('text', { x: 6, y: p.y + 3.5, class: `port-text cls-${p.class}` }, g);
      t.textContent = p.name;
      el('circle', { cx: 0, cy: p.y, r: 2.6, class: `pin cls-${p.class}` }, g);
      t.addEventListener('click', ev => { ev.stopPropagation(); this._fire('selectInstPort', n, p, 'in'); });
    }
    for (const p of n.outPorts) {
      const t = el('text', { x: n.w - 6, y: p.y + 3.5, 'text-anchor': 'end',
                             class: `port-text cls-${p.class}` }, g);
      t.textContent = p.name;
      el('circle', { cx: n.w, cy: p.y, r: 2.6, class: `pin cls-${p.class}` }, g);
      t.addEventListener('click', ev => { ev.stopPropagation(); this._fire('selectInstPort', n, p, 'out'); });
    }
    if (n.clkBadges.length) {
      const t = el('text', { x: 8, y: n.h - (n.vendorIP ? 18 : 6), class: 'clk-badge' }, g);
      t.textContent = `⏱ ${n.clkBadges.join(', ')}`;
    }
    // drill-down / expand buttons
    if (n.hasChildren) {
      const open = el('g', { class: 'node-btn', transform: `translate(${n.w - 40},${n.h - 20})` }, g);
      el('rect', { width: 16, height: 14, rx: 3 }, open);
      const ot = el('text', { x: 8, y: 11, 'text-anchor': 'middle' }, open); ot.textContent = '▼';
      el('title', {}, open).textContent = 'Open internal diagram';
      open.addEventListener('click', ev => { ev.stopPropagation(); this._fire('drill', n); });
      const ex = el('g', { class: 'node-btn', transform: `translate(${n.w - 20},${n.h - 20})` }, g);
      el('rect', { width: 16, height: 14, rx: 3 }, ex);
      const xt = el('text', { x: 8, y: 11, 'text-anchor': 'middle' }, ex);
      xt.textContent = n.sub ? '⊟' : '⊞';
      el('title', {}, ex).textContent = n.sub ? 'Collapse' : 'Expand in place';
      ex.addEventListener('click', ev => { ev.stopPropagation(); this._fire('toggleExpand', n); });
    }
    // embedded sub-diagram
    if (n.sub) {
      const sg = el('g', { class: 'subdiagram',
        transform: `translate(8,${n.subOffsetY}) scale(${n.subScale})` }, g);
      this._drawEdges(sg, n.sub, null, true);
      for (const c of n.sub.nodes) this._drawNode(sg, c, n.sub, null);
    }
    g.addEventListener('click', () => this._fire('selectInst', n));
    g.addEventListener('dblclick', () => n.hasChildren && this._fire('drill', n));
  }

  _drawEdges(root, d, sel, mini = false) {
    const layer = el('g', { class: 'edges' }, root);
    for (const e of d.edges) {
      const selected = sel && e.net && sel === `net:${e.net}`;
      const g = el('g', { class: 'edge' + (selected ? ' selected' : '') +
                          (e.unresolvedDirection ? ' unresolved' : '') }, layer);
      const path = el('path', { d: edgePath(e), class: `edge-line cls-${e.cls}`,
                                fill: 'none' }, g);
      if (!mini) {
        const hit = el('path', { d: edgePath(e), class: 'edge-hit', fill: 'none' }, g);
        hit.addEventListener('click', ev => { ev.stopPropagation(); this._fire('selectEdge', e); });
        el('title', {}, g).textContent =
          `${e.net || e.from.expr || 'const'}  ${widthLabel(e.width)}` +
          (e.unresolvedDirection ? '  [direction unresolved]' : '');
        if (e.width && e.width !== 1 && e.net) {
          const mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2 - 4;
          const lbl = el('text', { x: mx, y: my, class: 'edge-label',
                                   'text-anchor': 'middle' }, g);
          lbl.textContent = `${e.net} ${widthLabel(e.width)}`;
        }
        if (e.a.marker) this._marker(g, e.a, e.from);
        if (e.b.marker) this._marker(g, e.b, e.to);
      }
      el('path', { d: `M ${e.b.x - 7} ${e.b.y - 3.5} L ${e.b.x} ${e.b.y} L ${e.b.x - 7} ${e.b.y + 3.5}`,
                   class: `edge-arrow cls-${e.cls}`, fill: 'none' }, g);
      void path;
    }
  }

  _marker(g, pt, ep) {
    const m = el('g', { class: 'logic-marker', transform: `translate(${pt.x},${pt.y})` }, g);
    el('circle', { r: 7 }, m);
    const t = el('text', { y: 3.5, 'text-anchor': 'middle' }, m);
    t.textContent = ep.kind === 'const' ? 'K' : ep.kind === 'unresolved' ? '?' : 'ƒ';
    el('title', {}, m).textContent =
      ep.kind === 'const' ? `constant ${ep.expr || ''}` :
      ep.kind === 'unresolved' ? 'driver unresolved' :
      `internal logic (${(ep.assigns && ep.assigns[0] && ep.assigns[0].kind) || 'assign'})`;
  }

  // ---------- view control ----------
  fit() {
    if (!this.diagram) return;
    const pad = 20;
    this.vb = { x: -pad, y: -pad,
                w: this.diagram.width + 2 * pad, h: this.diagram.height + 2 * pad };
    this._applyVB();
  }

  reset() { this.fit(); }

  zoomAt(cx, cy, factor) {
    const { x, y, w, h } = this.vb;
    const nx = cx - (cx - x) * factor;
    const ny = cy - (cy - y) * factor;
    this.vb = { x: nx, y: ny, w: w * factor, h: h * factor };
    this._applyVB();
  }

  _applyVB() {
    const { x, y, w, h } = this.vb;
    this.svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`);
    this._renderMinimapViewport();
  }

  _bindPanZoom() {
    const svg = this.svg;
    svg.addEventListener('wheel', ev => {
      ev.preventDefault();
      const pt = this._svgPoint(ev);
      this.zoomAt(pt.x, pt.y, ev.deltaY > 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    // pan with a 4px drag threshold; pointer capture only once dragging so
    // plain clicks still reach node/edge/port child elements.
    let drag = null, dragging = false;
    svg.addEventListener('pointerdown', ev => {
      drag = { x: ev.clientX, y: ev.clientY, vb: { ...this.vb }, id: ev.pointerId };
      dragging = false;
    });
    svg.addEventListener('pointermove', ev => {
      if (!drag) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      if (!dragging && Math.hypot(dx, dy) > 4) {
        dragging = true;
        svg.setPointerCapture(drag.id);
      }
      if (!dragging) return;
      const r = svg.getBoundingClientRect();
      const sx = this.vb.w / r.width, sy = this.vb.h / r.height;
      this.vb.x = drag.vb.x - dx * sx;
      this.vb.y = drag.vb.y - dy * sy;
      this._applyVB();
    });
    svg.addEventListener('pointerup', () => { drag = null; });
    // swallow the click that follows a drag
    svg.addEventListener('click', ev => {
      if (dragging) { ev.stopPropagation(); dragging = false; }
    }, true);
  }

  _svgPoint(ev) {
    const r = this.svg.getBoundingClientRect();
    return { x: this.vb.x + (ev.clientX - r.left) / r.width * this.vb.w,
             y: this.vb.y + (ev.clientY - r.top) / r.height * this.vb.h };
  }

  // ---------- minimap ----------
  _renderMinimap() {
    if (!this.minimap || !this.diagram) return;
    this.minimap.innerHTML = '';
    const d = this.diagram;
    this.minimap.setAttribute('viewBox', `0 0 ${d.width} ${d.height}`);
    const g = el('g', {}, this.minimap);
    for (const n of d.nodes) {
      el('rect', { x: n.x, y: n.y, width: n.w, height: n.h, rx: 6,
                   class: 'mini-node' + (n.vendorIP ? ' vendor' : '') }, g);
    }
    this.vpRect = el('rect', { class: 'mini-viewport' }, this.minimap);
    this._renderMinimapViewport();
    this.minimap.onclick = ev => {
      const r = this.minimap.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width * d.width;
      const y = (ev.clientY - r.top) / r.height * d.height;
      this.vb.x = x - this.vb.w / 2; this.vb.y = y - this.vb.h / 2;
      this._applyVB();
    };
  }

  _renderMinimapViewport() {
    if (!this.vpRect) return;
    this.vpRect.setAttribute('x', this.vb.x);
    this.vpRect.setAttribute('y', this.vb.y);
    this.vpRect.setAttribute('width', this.vb.w);
    this.vpRect.setAttribute('height', this.vb.h);
  }

  // ---------- export ----------
  exportSVG(filename = 'diagram.svg') {
    const clone = this.svg.cloneNode(true);
    clone.setAttribute('xmlns', NS);
    inlineStyles(this.svg, clone);
    const blob = new Blob([new XMLSerializer().serializeToString(clone)],
                          { type: 'image/svg+xml' });
    download(blob, filename);
  }

  exportPNG(filename = 'diagram.png', scale = 2) {
    const clone = this.svg.cloneNode(true);
    clone.setAttribute('xmlns', NS);
    inlineStyles(this.svg, clone);
    const d = this.diagram;
    clone.setAttribute('viewBox', `0 0 ${d.width} ${d.height}`);
    clone.setAttribute('width', d.width); clone.setAttribute('height', d.height);
    const url = URL.createObjectURL(new Blob(
      [new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = d.width * scale; c.height = d.height * scale;
      const ctx = c.getContext('2d');
      ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => { download(b, filename); URL.revokeObjectURL(url); });
    };
    img.src = url;
  }
}

function inlineStyles(srcRoot, dstRoot) {
  const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity',
                 'font-size', 'font-family', 'font-weight'];
  const src = [srcRoot, ...srcRoot.querySelectorAll('*')];
  const dst = [dstRoot, ...dstRoot.querySelectorAll('*')];
  for (let i = 0; i < src.length && i < dst.length; i++) {
    const cs = getComputedStyle(src[i]);
    for (const p of PROPS) dst[i].style[p] = cs.getPropertyValue(p);
  }
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
