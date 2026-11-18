// Diagram model + automatic layout (pure functions, no DOM).
//
// buildDiagram(store, node) -> {
//   spec, base, parentPorts: {left:[port], right:[port]},
//   nodes: [{id, inst, spec, base, vendorIP, x, y, w, h,
//            inPorts:[{name,width,class,y}], outPorts:[...] , hasChildren}],
//   edges: [{id, net, width, cls, segs:[{x1,y1,x2,y2,...bezier}],
//            from:{...}, to:{...}, unresolvedDirection}],
//   width, height
// }
// Clock/reset nets are modeled separately (badges) to keep diagrams readable;
// callers may include them with opts.showClocks.

const NODE_W = 230;
const ROW_H = 16;
const HEAD_H = 30;
const COL_GAP = 150;
const ROW_GAP = 34;
const MARGIN = 70;
const PPORT_W = 150;

export function classOf(edgeOrName) {
  return typeof edgeOrName === 'string' ? 'data' : (edgeOrName.class || 'data');
}

export function buildDiagram(store, treeNode, opts = {}) {
  const showClk = !!opts.showClocks;
  const spec = treeNode.module;
  const mod = store.module(spec);
  const conn = store.conn(spec) || { edges: [], pinmap: {} };
  const childByInst = new Map(treeNode.children.map(c => [c.inst, c]));

  // ---- nodes ----
  const expanded = opts.expanded || new Set();
  const nodes = (mod.instances || []).map(inst => {
    const cmod = store.module(inst.module) || { ports: [] };
    const inP = cmod.ports.filter(p => p.dir !== 'out');
    const outP = cmod.ports.filter(p => p.dir === 'out');
    const clkP = showClk ? [] : inP.filter(p => p.class === 'clock' || p.class === 'reset');
    const inPorts = showClk ? inP : inP.filter(p => p.class !== 'clock' && p.class !== 'reset');
    let h = HEAD_H + Math.max(inPorts.length, outP.length, 1) * ROW_H + 8;
    let w = NODE_W;
    const child = childByInst.get(inst.name) || null;
    const node = {
      id: inst.name, inst: inst.name, spec: inst.module, base: inst.module_base,
      vendorIP: !!inst.vendor_ip, loc: inst.loc,
      hasChildren: (child?.children.length || 0) > 0,
      treeChild: child,
      inPorts: inPorts.map((p, i) => ({ ...p, y: HEAD_H + (i + 0.5) * ROW_H })),
      outPorts: outP.map((p, i) => ({ ...p, y: HEAD_H + (i + 0.5) * ROW_H })),
      clkBadges: clkP.map(p => p.name),
      w, h, x: 0, y: 0, sub: null, subScale: 1,
    };
    // expand-in-place: embed the one-level child diagram, scaled to fit
    if (expanded.has(inst.name) && child && child.children.length) {
      const sub = buildDiagram(store, child, { showClocks: showClk });
      const targetW = NODE_W * 2.6;
      const s = Math.min(targetW / sub.width, 0.6);
      node.sub = sub;
      node.subScale = s;
      node.w = Math.max(NODE_W, sub.width * s + 16);
      node.h = h + sub.height * s + 16;
      const portH = h;
      node.subOffsetY = portH;
    }
    return node;
  });
  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // ---- edge endpoint resolution ----
  const keep = e => showClk || (e.class !== 'clock' && e.class !== 'reset');
  const edges = [];
  for (const e of (conn.edges || [])) {
    if (!keep(e)) continue;
    for (const d of e.drivers) {
      for (const s of e.sinks) {
        if (d.kind === 'inst' && s.kind === 'inst' &&
            d.inst === s.inst && d.port === s.port) continue;
        edges.push({
          net: e.net, width: e.width, cls: e.class,
          from: d, to: s,
          viaExpr: (d.simple === false && d.kind === 'inst') ||
                   (s.simple === false && s.kind === 'inst'),
          unresolvedDirection: !e.direction_resolved,
        });
      }
    }
    if (!e.drivers.length) {
      for (const s of e.sinks) {
        edges.push({ net: e.net, width: e.width, cls: e.class,
                     from: { kind: 'unresolved' }, to: s,
                     unresolvedDirection: true });
      }
    }
  }

  // ---- ranking (BFS from parent inputs along inst->inst dataflow) ----
  const rank = new Map(nodes.map(n => [n.id, 0]));
  const adj = new Map(nodes.map(n => [n.id, new Set()]));
  for (const e of edges) {
    if (e.from.kind === 'inst' && e.to.kind === 'inst' && e.from.inst !== e.to.inst) {
      adj.get(e.from.inst)?.add(e.to.inst);
    }
  }
  let changed = true, iter = 0;
  while (changed && iter++ < nodes.length + 2) {   // cycle-safe longest path
    changed = false;
    for (const [src, dsts] of adj) {
      for (const dst of dsts) {
        if (rank.get(dst) <= rank.get(src) && rank.get(src) + 1 <= nodes.length) {
          const nr = rank.get(src) + 1;
          if (nr > rank.get(dst)) { rank.set(dst, nr); changed = true; }
        }
      }
    }
  }

  // ---- place nodes in rank columns ----
  const cols = new Map();
  for (const n of nodes) {
    const r = rank.get(n.id) || 0;
    if (!cols.has(r)) cols.set(r, []);
    cols.get(r).push(n);
  }
  const sortedRanks = [...cols.keys()].sort((a, b) => a - b);
  let x = MARGIN + PPORT_W + COL_GAP / 2;
  let maxY = 0;
  for (const r of sortedRanks) {
    let y = MARGIN;
    const colW = Math.max(...cols.get(r).map(n => n.w));
    for (const n of cols.get(r)) {
      n.x = x; n.y = y;
      y += n.h + ROW_GAP;
    }
    maxY = Math.max(maxY, y);
    x += colW + COL_GAP;
  }

  // ---- parent ports ----
  const pp = (mod.ports || []).filter(p => showClk ||
    (p.class !== 'clock' && p.class !== 'reset'));
  const left = pp.filter(p => p.dir === 'in');
  const right = pp.filter(p => p.dir !== 'in');
  const H = Math.max(maxY, MARGIN + Math.max(left.length, right.length) * (ROW_H + 2)) + MARGIN;
  const W = x - COL_GAP / 2 + PPORT_W + MARGIN;
  left.forEach((p, i) => { p.x = MARGIN + PPORT_W; p.y = MARGIN + (i + 0.5) * (ROW_H + 2); });
  right.forEach((p, i) => { p.x = W - MARGIN - PPORT_W; p.y = MARGIN + (i + 0.5) * (ROW_H + 2); });
  const clkBadgesTop = (mod.ports || []).filter(p => !showClk &&
    (p.class === 'clock' || p.class === 'reset')).map(p => p.name);

  // ---- edge geometry ----
  const leftByName = new Map(left.map(p => [p.name, p]));
  const rightByName = new Map(right.map(p => [p.name, p]));
  function anchor(ep, isSource) {
    if (ep.kind === 'inst') {
      const n = nodeById.get(ep.inst);
      if (!n) return null;
      const port = (isSource ? n.outPorts : n.inPorts).find(p => p.name === ep.port)
        || (isSource ? n.inPorts : n.outPorts).find(p => p.name === ep.port);
      if (!port) return { x: n.x + (isSource ? n.w : 0), y: n.y + HEAD_H / 2, node: n };
      const onRight = n.outPorts.includes(port);
      return { x: n.x + (onRight ? n.w : 0), y: n.y + port.y, node: n, port };
    }
    if (ep.kind === 'port') {
      const p = leftByName.get(ep.port) || rightByName.get(ep.port);
      if (!p) return null;
      return { x: p.x, y: p.y, parentPort: p };
    }
    return null; // logic / const / unresolved -> floating marker near target
  }
  let eid = 0;
  const geomEdges = [];
  for (const e of edges) {
    const a = anchor(e.from, true);
    const b = anchor(e.to, false);
    if (!b && !a) continue;
    let A = a, B = b;
    if (!A && B) A = { x: B.x - 46, y: B.y, marker: e.from.kind || 'logic' };
    if (!B && A) B = { x: A.x + 46, y: A.y, marker: e.to.kind || 'logic' };
    geomEdges.push({ ...e, id: `e${eid++}`, a: A, b: B });
  }

  return {
    spec, base: mod.base, mod, treeNode,
    parentPorts: { left, right }, clkBadgesTop,
    nodes, edges: geomEdges, width: W, height: H,
  };
}

// Edge path (cubic bezier)
export function edgePath(e) {
  const { a, b } = e;
  const dx = Math.max(40, Math.abs(b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function widthLabel(w) {
  if (w === null || w === undefined) return '';
  if (w === 'Unresolved') return 'Unresolved';
  return w === 1 ? '1 bit' : `[${w - 1}:0]`;
}
