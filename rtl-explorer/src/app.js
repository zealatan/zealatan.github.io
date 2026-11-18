// Application glue: wires store, navigation, tree, diagram, details, search,
// timing, toolbar and URL-hash deep links together.
import { Store } from './core/store.js';
import { buildDiagram } from './core/graph.js';
import { Navigator, encodeHash, decodeHash } from './core/navigation.js';
import { buildIndex, search } from './core/search.js';
import { DiagramView } from './components/diagram.js';
import { TreeView } from './components/tree.js';
import { DetailsView } from './components/details.js';
import { TimingView } from './components/timing.js';

const $ = sel => document.querySelector(sel);

async function main() {
  const store = await Store.load('generated');
  const nav = new Navigator();
  const tree = new TreeView($('#tree'), store);
  const diagram = new DiagramView($('#diagram'), $('#minimap'));
  const details = new DetailsView($('#details'), store);
  const timing = new TimingView($('#timing'), store);
  const index = buildIndex(store);
  const expanded = new Map();          // path -> Set(inst) expanded in place
  let showClocks = false;
  let current = { path: '', sel: null };

  function expandSet(path) {
    if (!expanded.has(path)) expanded.set(path, new Set());
    return expanded.get(path);
  }

  function renderAll() {
    const { path, sel } = current;
    const node = store.nodeAt(path) || store.nodeAt('');
    const d = buildDiagram(store, node, {
      showClocks, expanded: expandSet(path),
    });
    diagram.render(d, sel);
    diagram.fit();
    tree.setActive(path);
    renderCrumbs(path);
    if (sel && sel.startsWith('net:')) {
      const e = d.edges.find(x => x.net === sel.slice(4));
      if (e) details.showEdge(e, d);
      else details.showModule(node, path);
    } else if (sel && sel.startsWith('inst:')) {
      const child = node.children.find(c => c.inst === sel.slice(5));
      if (child) details.showModule(child, path ? `${path}/${child.inst}` : child.inst);
      else details.showModule(node, path);
    } else {
      details.showModule(node, path);
    }
    $('#btn-back').disabled = !nav.canBack();
    $('#btn-fwd').disabled = !nav.canForward();
    document.title = `${node.module_base} - OFDM RTL Explorer`;
  }

  function renderCrumbs(path) {
    const bc = $('#crumbs');
    bc.innerHTML = '';
    const items = store.crumbs(path);
    items.forEach((it, i) => {
      const a = document.createElement('a');
      a.textContent = it.label;
      a.href = encodeHash(it.path);
      a.onclick = ev => { ev.preventDefault(); navigate(it.path); };
      bc.appendChild(a);
      if (i < items.length - 1) bc.appendChild(document.createTextNode(' › '));
    });
  }

  function navigate(path, sel = null) {
    nav.go(path, sel);
  }

  nav.onChange(entry => {
    current = entry;
    history.replaceState(null, '', encodeHash(entry.path, entry.sel));
    renderAll();
  });

  // ---- diagram events ----
  diagram
    .on('drill', n => {
      const base = current.path;
      navigate(base ? `${base}/${n.inst}` : n.inst);
    })
    .on('selectInst', n => navigate(current.path, `inst:${n.inst}`))
    .on('selectEdge', e => { if (e.net) navigate(current.path, `net:${e.net}`); })
    .on('selectPort', p => {
      const node = store.nodeAt(current.path);
      const d = buildDiagram(store, node, { showClocks, expanded: expandSet(current.path) });
      const e = d.edges.find(x => x.net === p.name);
      if (e) navigate(current.path, `net:${p.name}`);
    })
    .on('selectInstPort', (n, p) => {
      // find the net attached to this instance pin
      const conn = store.conn(store.nodeAt(current.path).module);
      const pin = conn?.pinmap?.[n.inst]?.[p.name];
      if (pin && pin.refs && pin.refs.length) {
        navigate(current.path, `net:${pin.refs[0]}`);
      }
    })
    .on('toggleExpand', n => {
      const s = expandSet(current.path);
      s.has(n.inst) ? s.delete(n.inst) : s.add(n.inst);
      renderAll();
    });

  tree.onNavigate = p => navigate(p);
  details.onNavigate = p => navigate(p);
  details.onShowTiming = (sig, cls) => timing.show(sig, cls);

  // ---- toolbar ----
  $('#btn-back').onclick = () => nav.back();
  $('#btn-fwd').onclick = () => nav.forward();
  $('#btn-fit').onclick = () => diagram.fit();
  $('#btn-zin').onclick = () => diagram.zoomAt(
    diagram.vb.x + diagram.vb.w / 2, diagram.vb.y + diagram.vb.h / 2, 1 / 1.25);
  $('#btn-zout').onclick = () => diagram.zoomAt(
    diagram.vb.x + diagram.vb.w / 2, diagram.vb.y + diagram.vb.h / 2, 1.25);
  $('#btn-full').onclick = () => {
    const pane = $('#diagram-pane');
    document.fullscreenElement ? document.exitFullscreen() : pane.requestFullscreen();
  };
  $('#btn-svg').onclick = () => diagram.exportSVG(`${store.nodeAt(current.path).module_base}.svg`);
  $('#btn-png').onclick = () => diagram.exportPNG(`${store.nodeAt(current.path).module_base}.png`);
  $('#btn-timing').onclick = () => timing.show();
  $('#btn-theme').onclick = () => {
    const r = document.documentElement;
    r.dataset.theme = r.dataset.theme === 'light' ? 'dark' : 'light';
  };
  $('#chk-clocks').onchange = ev => { showClocks = ev.target.checked; renderAll(); };
  $('#btn-source').onclick = () => {
    const node = store.nodeAt(current.path);
    const mod = store.module(node.module);
    alert(`RTL source:\n${mod.file}\nline ${mod.line}\n\n(open locally; static hosting cannot link into your filesystem)`);
  };

  // ---- search ----
  const si = $('#search');
  const sr = $('#search-results');
  si.addEventListener('input', () => {
    const res = search(index, si.value);
    sr.innerHTML = '';
    sr.style.display = res.length ? 'block' : 'none';
    for (const r of res) {
      const div = document.createElement('div');
      div.className = 'search-item';
      div.innerHTML = `<span class="search-kind k-${r.kind}">${r.kind}</span>
        <b>${r.label}</b> <span class="muted">${r.detail}</span>`;
      div.onclick = () => {
        sr.style.display = 'none'; si.value = '';
        navigate(r.path, r.sel);
      };
      sr.appendChild(div);
    }
  });
  document.addEventListener('click', ev => {
    if (!sr.contains(ev.target) && ev.target !== si) sr.style.display = 'none';
  });

  // ---- deep link on load + hash navigation ----
  window.addEventListener('hashchange', () => {
    const { path, sel } = decodeHash(location.hash);
    if (store.nodeAt(path)) navigate(path, sel);
  });
  const init = decodeHash(location.hash);
  navigate(store.nodeAt(init.path) ? init.path : '', init.sel);

  // ---- header stats ----
  const rep = store.report;
  if (rep) {
    $('#stats').textContent =
      `${rep.unique_modules} modules · ${rep.total_instances} instances · ` +
      `depth ${rep.max_hierarchy_depth} · ${rep.total_ports} ports · rev ${String(rep.source_revision.revision).slice(0, 8)}`;
  }
}

main().catch(err => {
  document.body.innerHTML =
    `<div style="padding:2em;font-family:monospace">Failed to load generated data: ${err}<br>
     Serve this directory over HTTP (e.g. <code>python3 -m http.server</code>) -
     browsers block fetch() from file:// URLs.</div>`;
  throw err;
});
