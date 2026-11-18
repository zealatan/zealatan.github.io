// Data store: loads generated/*.json and provides lookups.
// Pure of DOM so it is testable under `node --test`.

export class Store {
  constructor(data) {
    this.hierarchy = data.hierarchy;
    this.modules = data.modules;
    this.connections = data.connections;
    this.verification = data.verification;
    this.report = data.extraction_report || null;
    this.throughput = data.throughput || null;
    this._byHier = new Map();
    this._indexTree(this.hierarchy.tree, null);
  }

  static async load(base = 'generated') {
    const names = ['hierarchy', 'modules', 'connections', 'verification',
                   'extraction_report', 'throughput'];
    const out = {};
    await Promise.all(names.map(async n => {
      const r = await fetch(`${base}/${n}.json`);
      out[n] = r.ok ? await r.json() : null;
    }));
    return new Store(out);
  }

  _indexTree(node, parent) {
    node.parent = parent;
    const key = this.pathOf(node);
    this._byHier.set(key, node);
    for (const c of node.children) this._indexTree(c, node);
  }

  // path relative to top: '' for top, 'u_rx/u_sync' etc.
  pathOf(node) {
    const parts = [];
    let n = node;
    while (n && n.parent) { parts.unshift(n.inst); n = n.parent; }
    return parts.join('/');
  }

  nodeAt(path) {
    return this._byHier.get(path || '') || null;
  }

  module(spec) { return this.modules[spec] || null; }

  conn(spec) { return this.connections[spec] || null; }

  verif(base) {
    return (this.verification && this.verification.modules[base]) || null;
  }

  // breadcrumb items for a path: [{label, path}]
  crumbs(path) {
    const items = [{ label: this.hierarchy.top, path: '' }];
    if (!path) return items;
    const parts = path.split('/');
    for (let i = 0; i < parts.length; i++) {
      items.push({ label: parts[i], path: parts.slice(0, i + 1).join('/') });
    }
    return items;
  }

  allNodes() { return [...this._byHier.values()]; }
}
