// Search index over modules, instances, ports and nets (pure logic).

export function buildIndex(store) {
  const items = [];
  // instances (every tree node)
  for (const node of store.allNodes()) {
    const path = store.pathOf(node);
    items.push({ kind: 'instance', label: node.inst, detail: node.module_base,
                 path, sel: null, key: `${node.inst} ${node.module_base} ${path}` });
  }
  // modules + ports + nets (per variant; navigate to first instance)
  const firstInstance = new Map();
  for (const node of store.allNodes()) {
    if (!firstInstance.has(node.module)) {
      firstInstance.set(node.module, store.pathOf(node));
    }
  }
  for (const [spec, mod] of Object.entries(store.modules)) {
    const where = firstInstance.get(spec);
    if (where === undefined) continue;
    items.push({ kind: 'module', label: mod.base,
                 detail: spec !== mod.base ? `variant ${spec}` : 'module',
                 path: where, sel: null, key: `${mod.base} ${spec}` });
    for (const p of mod.ports) {
      items.push({ kind: 'port', label: `${mod.base}.${p.name}`,
                   detail: `${p.dir} ${p.width === 1 ? '1 bit' : '[' + (p.width - 1) + ':0]'}`,
                   path: where, sel: `port:${p.name}`, key: `${p.name} ${mod.base}` });
    }
    const conn = store.conn(spec);
    if (conn) {
      for (const n of conn.internal_nets) {
        items.push({ kind: 'net', label: `${mod.base}.${n.name}`,
                     detail: `net, ${n.width} bit`, path: where,
                     sel: `net:${n.name}`, key: `${n.name} ${mod.base}` });
      }
    }
  }
  return items;
}

export function search(items, query, limit = 40) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const it of items) {
    const k = it.key.toLowerCase();
    const lbl = it.label.toLowerCase();
    let score = -1;
    if (lbl === q) score = 100;
    else if (lbl.startsWith(q)) score = 80;
    else if (lbl.includes(q)) score = 60;
    else if (k.includes(q)) score = 30;
    if (score >= 0) scored.push({ ...it, score });
  }
  const kindRank = { instance: 0, module: 1, port: 2, net: 3 };
  scored.sort((a, b) => b.score - a.score ||
    kindRank[a.kind] - kindRank[b.kind] || a.label.localeCompare(b.label));
  return scored.slice(0, limit);
}
