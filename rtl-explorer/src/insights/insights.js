// Design Insights view controller: chapter navigation + rendering + deep
// links (#/insights/<chapter-id>). Keeps all explorer functionality intact -
// this view simply overlays the explorer panes while active.
import { CHAPTERS } from './chapters/index.js';
import { measured, COMMITS, CONDITIONS, REPORTS } from './data.js';

export class InsightsView {
  constructor(container, store, { navigate, encodeHash }) {
    this.el = container;
    this.store = store;
    this.navigate = navigate;
    this.encodeHash = encodeHash;
    this.active = null;
    this._built = false;
    // module -> first hierarchy path (for "open in explorer" links)
    this.modulePath = new Map();
    for (const n of store.allNodes()) {
      if (!this.modulePath.has(n.module_base)) {
        this.modulePath.set(n.module_base, store.pathOf(n));
      }
    }
  }

  chapterIds() { return CHAPTERS.map(c => c.id); }

  explorerLink(moduleBase) {
    const p = this.modulePath.get(moduleBase);
    return p === undefined ? null : this.encodeHash(p);
  }

  _build() {
    this.el.innerHTML = `
      <aside id="ins-nav">
        <div class="ins-nav-head">Design Insights
          <div class="small muted">RTL Architecture & Engineering Concepts</div></div>
        <nav id="ins-nav-list"></nav>
        <div class="ins-nav-foot small muted">
          Measured results: ${CONDITIONS}.<br>
          Baseline ${COMMITS.baseline} → fix ${COMMITS.fix}.<br>
          Reports: <code>${REPORTS.audit}</code>, <code>${REPORTS.fix}</code>.
        </div>
      </aside>
      <main id="ins-content"></main>`;
    const list = this.el.querySelector('#ins-nav-list');
    CHAPTERS.forEach((c, i) => {
      const a = document.createElement('a');
      a.className = 'ins-nav-item';
      a.dataset.ch = c.id;
      a.href = `#/insights/${c.id}`;
      a.innerHTML = `<span class="ins-nav-num">${i + 1}</span> ${c.title}`;
      a.onclick = ev => { ev.preventDefault(); this.navigate(`insights/${c.id}`); };
      list.appendChild(a);
    });
    this._built = true;
  }

  show(chapterId) {
    if (!this._built) this._build();
    this.el.classList.add('open');
    const ch = CHAPTERS.find(c => c.id === chapterId) || CHAPTERS[0];
    this.active = ch.id;
    for (const a of this.el.querySelectorAll('.ins-nav-item')) {
      a.classList.toggle('active', a.dataset.ch === ch.id);
    }
    const main = this.el.querySelector('#ins-content');
    main.innerHTML = '';
    const idx = CHAPTERS.indexOf(ch);
    const head = document.createElement('div');
    head.className = 'ins-ch-head';
    head.innerHTML = `<h2>Chapter ${idx + 1} — ${ch.title}</h2>
      <div class="muted">${ch.subtitle || ''}</div>`;
    main.appendChild(head);
    const ctx = {
      store: this.store,
      m: measured(this.store),
      explorerLink: b => this.explorerLink(b),
      navigate: this.navigate,
    };
    main.appendChild(ch.render(ctx));
    // prev/next footer
    const foot = document.createElement('div');
    foot.className = 'ins-ch-foot';
    const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
    foot.innerHTML =
      `${prev ? `<a href="#/insights/${prev.id}">← ${prev.title}</a>` : '<span></span>'}
       ${next ? `<a href="#/insights/${next.id}">${next.title} →</a>` : '<span></span>'}`;
    for (const a of foot.querySelectorAll('a')) {
      a.onclick = ev => { ev.preventDefault();
        this.navigate(a.getAttribute('href').slice(2)); };
    }
    main.appendChild(foot);
    main.scrollTop = 0;
    return ch;
  }

  hide() { this.el.classList.remove('open'); }
}
