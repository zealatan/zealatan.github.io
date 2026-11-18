// Navigation controller: history, breadcrumbs, URL-hash deep links.
// Hash format:  #/u_rx/u_sync            (hierarchy path from top)
//               #/u_rx?sel=net:aclk      (with selection)
// Pure logic; callers wire it to window.location / popstate.

export function encodeHash(path, sel = null) {
  let h = '#/' + (path || '');
  if (sel) h += `?sel=${encodeURIComponent(sel)}`;
  return h;
}

export function decodeHash(hash) {
  if (!hash || !hash.startsWith('#/')) return { path: '', sel: null };
  const body = hash.slice(2);
  const [path, q] = body.split('?');
  let sel = null;
  if (q) {
    const m = new URLSearchParams(q);
    sel = m.get('sel');
  }
  return { path: path.replace(/\/+$/, ''), sel };
}

export class Navigator {
  constructor() {
    this.stack = [];     // entries {path, sel}
    this.pos = -1;
    this.listeners = [];
  }

  onChange(fn) { this.listeners.push(fn); }

  current() { return this.pos >= 0 ? this.stack[this.pos] : { path: '', sel: null }; }

  go(path, sel = null, { replace = false } = {}) {
    const cur = this.current();
    if (cur && cur.path === path && cur.sel === sel && this.pos >= 0) return;
    if (replace && this.pos >= 0) {
      this.stack[this.pos] = { path, sel };
    } else {
      this.stack = this.stack.slice(0, this.pos + 1);
      this.stack.push({ path, sel });
      this.pos++;
    }
    this._emit();
  }

  back() { if (this.canBack()) { this.pos--; this._emit(); } }
  forward() { if (this.canForward()) { this.pos++; this._emit(); } }
  canBack() { return this.pos > 0; }
  canForward() { return this.pos < this.stack.length - 1; }

  _emit() {
    const c = this.current();
    for (const fn of this.listeners) fn(c);
  }
}
