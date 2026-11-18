// Right-hand module/selection details panel.
import { widthLabel } from '../core/graph.js';

// Signal-processing context: equations shown for selected modules.  The
// "implemented" lines document what the RTL actually computes (fixed-point
// scaling included); the generic equation is textbook context.
const EQUATIONS = {
  tx_ifft_frontend: {
    generic: 'x[n] = (1/N) · Σ<sub>k=0</sub><sup>N-1</sup> X[k] · e<sup>j2πkn/N</sup>',
    implemented: 'RTL: xfft 9.1 INVERSE in block-floating-point computes the UNSCALED '
      + 'inverse sum (no 1/N); recover = ((out16 ≪ blk_exp) + 2³) ≫ 4, i.e. the '
      + 'golden 1/√256 = 1/16 scale with round-half-up, then CP insert (last 32 body samples prepended).',
  },
  rx_fft_frontend: {
    generic: 'X[k] = Σ<sub>n=0</sub><sup>N-1</sup> x[n] · e<sup>-j2πkn/N</sup>',
    implemented: 'RTL: xfft 9.1 FORWARD BFP; recover = ((out16 ≪ blk_exp) + 2³) ≫ 4 '
      + '(1/√256 scale), then fftshift reorder; per-symbol CP (32 samples) dropped before the FFT.',
  },
  rx_equalizer: {
    generic: 'X̂[k] = Y[k] · Ĥ*[k] / |Ĥ[k]|²',
    implemented: 'RTL: zero-forcing via reciprocal lookup of |H|² (rx_eq_complex_div, '
      + 'LUT + Newton-Raphson refinement), output at the project Q15 scale (5090.697).',
  },
  rx_ch_est: {
    generic: 'Ĥ<sub>p</sub>[k] = Y[k] · p*[k] / |p[k]|²  → interpolate to all bins',
    implemented: 'RTL: Hp = rx · W[k] with W = conj(p)/|p|² · Q15 precomputed per pilot '
      + '(ce_pilot_recip ROM, 18-bit coeffs, 16 frac bits, round-half-up); 32-tap '
      + 'interp-FFT interpolation ROM (ce_interp_W) to all 256 bins. W-ROM is '
      + 'hardwired to the committed pilot_rom.hex pilot values.',
  },
  cordic_atan2: {
    generic: 'φ = atan2(Q, I), output Q1.15: φ<sub>q15</sub> = round(φ/π · 2¹⁵)',
    implemented: 'RTL: vectoring CORDIC, N_ITER=14 truncating ≫ micro-rotations + '
      + '16-entry atan LUT; quadrant pre-rotation to ±π. Intrinsic deviation vs '
      + 'float atan2 ≤5 LSB (measured over 20k points); bit-exact Python replica in '
      + 'algorithm_sim/cordic_bitexact.py.',
  },
  frac_cfo_estimator: {
    generic: 'ε = -(1/2π) · ∠( Σ<sub>m</sub> r[m] · r*[m-N] )  (CP correlation)',
    implemented: 'RTL: CP-lag autocorrelation accumulated over the CP window; angle '
      + 'via cordic_atan2 (Q1.15); sign convention ε = -angle/2π (Van de Beek).',
  },
  streaming_cp_autocorr: {
    generic: 'P[n] = Σ<sub>m=0</sub><sup>L-1</sup> r[n-m] · r*[n-m-N],  L = CP_LEN',
    implemented: 'RTL: running sum update P[n] = P[n-1] + prod[n] - prod[n-L] at '
      + '1 sample/clock, lag N = 256, window L = 32.',
  },
  meyr_cfo_top: {
    generic: 'k̂ = argmax<sub>m</sub> | IFFT<sub>2N</sub>( FFT<sub>2N</sub>(a·window) · B*[k] ) |',
    implemented: 'RTL: FFT-correlation Meyr integer-CFO: N-pt FFT of the captured sync, '
      + 'zero-pad to 2N=512, multiply by conj(B[k]) ROM (bk_conj_fft512), 2N IFFT, '
      + 'peak index → integer CFO estimate. All three transforms are xfft 9.1 BFP.',
  },
};

export class DetailsView {
  constructor(container, store) {
    this.el = container;
    this.store = store;
    this.onNavigate = () => {};
    this.onShowTiming = () => {};
  }

  showModule(treeNode, path) {
    const mod = this.store.module(treeNode.module);
    const verif = this.store.verif(treeNode.module_base);
    const eq = EQUATIONS[treeNode.module_base];
    const childCount = treeNode.children.length;
    const file = mod.file.split('/').slice(-1)[0];
    const h = [];
    h.push(`<h2>${treeNode.module_base}</h2>`);
    if (mod.variant) h.push(`<div class="muted">elaborated variant: <code>${mod.variant}</code></div>`);
    h.push(`<table class="kv">
      <tr><td>Instance</td><td><code>${treeNode.inst}</code></td></tr>
      <tr><td>Hierarchy</td><td><code>${this.store.hierarchy.top}${path ? '/' + path : ''}</code></td></tr>
      <tr><td>Source</td><td><code>${file}:${mod.line}</code></td></tr>
      <tr><td>Child instances</td><td>${childCount}</td></tr>
    </table>`);
    if (mod.vendor_ip) {
      h.push(`<div class="callout warn"><b>Vendor IP / Black Box.</b> ${mod.vendor_note}</div>`);
    }
    if (mod.summary) {
      h.push(`<h3>Functional summary</h3><p>${mod.summary}</p>
        <div class="muted small">${mod.summary_kind}</div>`);
    }
    if (eq) {
      h.push(`<h3>Signal-processing context</h3>
        <div class="equation">${eq.generic}</div>
        <div class="small">${eq.implemented}</div>`);
    }
    if (mod.params.length) {
      h.push(`<h3>Parameters (resolved)</h3><table class="tbl"><tr><th>name</th><th>value</th></tr>` +
        mod.params.map(p => `<tr><td><code>${p.name}</code></td><td>${p.value ?? p.raw}</td></tr>`).join('') +
        `</table>`);
    }
    h.push(`<h3>Ports (${mod.ports.length})</h3>
      <table class="tbl"><tr><th>dir</th><th>name</th><th>width</th><th>declared</th><th>class</th></tr>` +
      mod.ports.map(p =>
        `<tr><td class="dir-${p.dir}">${p.dir}</td><td><code>${p.name}</code></td>
         <td>${widthLabel(p.width)}${p.signed ? ' s' : ''}</td>
         <td><code>${p.declared}</code></td>
         <td><span class="chip cls-${p.class}">${p.class}</span></td></tr>`).join('') +
      `</table>`);
    if (mod.memories.length) {
      h.push(`<h3>Memories / ROMs (RTL-derived)</h3><table class="tbl">
        <tr><th>name</th><th>depth</th><th>width</th></tr>` +
        mod.memories.map(m => `<tr><td><code>${m.name}</code></td><td>${m.depth}</td><td>${m.width}</td></tr>`).join('') +
        `</table>`);
    }
    const sc = mod.source_scan || {};
    if (Object.keys(sc).length) {
      h.push(`<h3>Internal structure (source scan)</h3>
        <div class="small">reg decls: ${sc.reg_decls ?? '-'} · wire decls: ${sc.wire_decls ?? '-'} ·
        always blocks: ${sc.always_blocks ?? '-'} · assigns: ${sc.assign_statements ?? '-'} ·
        case stmts: ${sc.case_statements ?? '-'}</div>`);
      if ((sc.readmemh_files || []).length) {
        h.push(`<div class="small">ROM init files: ${sc.readmemh_files.map(f => `<code>${f}</code>`).join(', ')}</div>`);
      }
    }
    if (verif) {
      h.push(`<h3>Verification (Tier-2)</h3>
        <div><span class="status status-${verif.status.replace(/ /g, '-')}">${verif.status}</span></div>
        <p class="small">${verif.detail}</p>
        <div class="muted small">source: ${verif.source_report}</div>`);
      if (verif.parent_testbenches) {
        h.push(`<div class="small muted">${verif.parent_testbenches.note}<br>` +
          verif.parent_testbenches.files.map(f => `<code>${f}</code>`).join(' ') + `</div>`);
      }
    }
    if (mod.header_comment) {
      h.push(`<details><summary>RTL header comment (verbatim)</summary>
        <pre class="hdr">${escapeHtml(mod.header_comment)}</pre></details>`);
    }
    this.el.innerHTML = h.join('\n');
  }

  showEdge(edge, diagram) {
    const fmt = ep => ep.kind === 'inst' ? `<code>${ep.inst}.${ep.port}</code>` :
      ep.kind === 'port' ? `parent port <code>${ep.port}</code>` :
      ep.kind === 'logic' ? `internal logic${ep.assigns && ep.assigns[0]?.loc ? ` (assign @ line ${ep.assigns[0].loc.line})` : ''}` :
      ep.kind === 'const' ? `constant <code>${ep.expr || ''}</code>` : 'unresolved';
    const srcLoc = edge.to.loc ? `${(diagram.mod.file || '').split('/').slice(-1)[0]}:${edge.to.loc.line}` : null;
    this.el.innerHTML = `
      <h2>Connection</h2>
      <table class="kv">
        <tr><td>Net</td><td><code>${edge.net || '(expression/constant)'}</code></td></tr>
        <tr><td>Width</td><td>${widthLabel(edge.width)}</td></tr>
        <tr><td>Class</td><td><span class="chip cls-${edge.cls}">${edge.cls}</span></td></tr>
        <tr><td>Source</td><td>${fmt(edge.from)}</td></tr>
        <tr><td>Destination</td><td>${fmt(edge.to)}</td></tr>
        ${srcLoc ? `<tr><td>RTL location</td><td><code>${srcLoc}</code></td></tr>` : ''}
        ${edge.unresolvedDirection ? '<tr><td>Direction</td><td><b>Unresolved - shown neutral</b></td></tr>' : ''}
        ${edge.viaExpr ? '<tr><td>Note</td><td>connected via expression (slice/concat)</td></tr>' : ''}
      </table>
      <button class="btn" id="btn-edge-timing">Open timing view for this signal</button>`;
    this.el.querySelector('#btn-edge-timing').onclick = () =>
      this.onShowTiming(edge.net, edge.cls);
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
