// Collapsible hierarchy tree (left pane).
export class TreeView {
  constructor(container, store) {
    this.el = container;
    this.store = store;
    this.open = new Set(['']);           // open paths
    this.active = '';
    this.onNavigate = () => {};
  }

  setActive(path) {
    this.active = path;
    // open all ancestors
    const parts = (path || '').split('/').filter(Boolean);
    for (let i = 0; i <= parts.length; i++) {
      this.open.add(parts.slice(0, i).join('/'));
    }
    this.render();
  }

  render() {
    this.el.innerHTML = '';
    this.el.appendChild(this._renderNode(this.store.hierarchy.tree));
  }

  _renderNode(node) {
    const path = this.store.pathOf(node);
    const li = document.createElement('div');
    li.className = 'tree-node';
    const row = document.createElement('div');
    row.className = 'tree-row' + (path === this.active ? ' active' : '');
    const hasKids = node.children.length > 0;
    const caret = document.createElement('span');
    caret.className = 'tree-caret';
    caret.textContent = hasKids ? (this.open.has(path) ? '▾' : '▸') : '·';
    if (hasKids) {
      caret.onclick = ev => {
        ev.stopPropagation();
        this.open.has(path) ? this.open.delete(path) : this.open.add(path);
        this.render();
      };
    }
    const label = document.createElement('span');
    label.className = 'tree-label';
    label.innerHTML = `<b>${node.inst}</b> <i>${node.module_base}</i>` +
      (node.vendor_ip ? ' <span class="tag-ip">IP</span>' : '');
    row.appendChild(caret); row.appendChild(label);
    row.onclick = () => this.onNavigate(path);
    li.appendChild(row);
    if (hasKids && this.open.has(path)) {
      const kids = document.createElement('div');
      kids.className = 'tree-kids';
      for (const c of node.children) kids.appendChild(this._renderNode(c));
      li.appendChild(kids);
    }
    return li;
  }
}
