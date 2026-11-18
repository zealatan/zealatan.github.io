/* =========================================================================
 * OFDM E2E — Layer A receiver: sync, CP/FFT, channel estimation,
 * equalization, demapping, metrics. Pure math, no DOM.
 *
 * Sync (practical mode):
 *  1. Schmidl & Cox on preamble P1 (two identical halves of period N/2):
 *       P(d) = sum_{n<N/2} r*[d+n] r[d+n+N/2],  M(d)=|P|^2 / R(d)^2
 *     coarse timing = argmax M; fractional CFO eps_f = angle(P)/pi.
 *  2. Derotate by eps_f, then cross-correlate with the KNOWN P2 body under
 *     each integer-CFO hypothesis k in [-K..K]; the best |peak| gives fine
 *     timing and k_int. eps_total = k_int + eps_f.
 * Oracle mode: uses the true frame start and true CFO from the channel
 * metadata (clearly labeled; for baselines and debugging).
 *
 * Channel estimation (per OFDM symbol, on the ACTUAL received pilots):
 *   perfect  : unitary-FFT of the true h (zero-padded) — oracle baseline.
 *              (Static-FIR response only; excludes residual sync rotation.)
 *   ls-linear: LS at pilot bins + linear interpolation across active bins.
 *   ls-dft   : LS pilots -> P-point IDFT -> keep first `cp` taps -> N-DFT.
 *   lmmse    : ls-dft path with per-tap Wiener weights p_l/(p_l+sigma2/P)
 *              using an exponential PDP prior and the channel's sigma2
 *              (genie noise variance — labeled as such).
 * Equalization: ZF   X = Y conj(H) / |H|^2        (|H|^2 floored at 1e-12)
 *               MMSE X = Y conj(H) / (|H|^2 + sigma2)
 * ========================================================================= */

import { czeros, cclone, fftRadix2, ifft, qamDemap, qamMap, MODS } from "../phy/engine.js";

/* ---- Schmidl & Cox metric over the raw stream ---- */
export function schmidlCox(rx, N) {
  const half = N / 2;
  const len = rx.re.length - N;
  if (len <= 0) throw new Error("rx too short for S&C");
  const Pre = new Float64Array(len), Pim = new Float64Array(len), M = new Float64Array(len);
  // sliding sums
  let pr = 0, pi = 0, rEng = 0;
  const prodRe = (n) => rx.re[n] * rx.re[n + half] + rx.im[n] * rx.im[n + half];
  const prodIm = (n) => rx.re[n] * rx.im[n + half] - rx.im[n] * rx.re[n + half];
  const eng = (n) => rx.re[n + half] ** 2 + rx.im[n + half] ** 2;
  const R1 = new Float64Array(len), R2 = new Float64Array(len);
  const eng1 = (n) => rx.re[n] ** 2 + rx.im[n] ** 2;
  let r1 = 0;
  for (let n = 0; n < half; n++) {
    pr += prodRe(n); pi += prodIm(n); rEng += eng(n); r1 += eng1(n);
  }
  for (let d = 0; d < len; d++) {
    Pre[d] = pr; Pim[d] = pi; R1[d] = r1; R2[d] = rEng;
    pr += prodRe(d + half) - prodRe(d);
    pi += prodIm(d + half) - prodIm(d);
    rEng += eng(d + half) - eng(d);
    r1 += eng1(d + half) - eng1(d);
  }
  // Normalize by BOTH half energies (Cauchy-Schwarz => M<=1) and gate silent
  // regions, where the ratio is 0/0 numerical garbage.
  let rMax = 0;
  for (let d = 0; d < len; d++) { const r = Math.min(R1[d], R2[d]); if (r > rMax) rMax = r; }
  const gate = 0.05 * rMax;
  for (let d = 0; d < len; d++) {
    const ok = R1[d] > gate && R2[d] > gate;
    M[d] = ok ? (Pre[d] ** 2 + Pim[d] ** 2) / (R1[d] * R2[d]) : 0;
  }
  return { Pre, Pim, M, R1, R2 };
}

function derotated(rx, eps, N) {
  const y = cclone(rx);
  const w = -2 * Math.PI * eps / N;
  for (let n = 0; n < y.re.length; n++) {
    const c = Math.cos(w * n), s = Math.sin(w * n);
    const r = y.re[n] * c - y.im[n] * s;
    y.im[n] = y.re[n] * s + y.im[n] * c;
    y.re[n] = r;
  }
  return y;
}

/* cross-correlate stream (around a window) with known preamble body */
function xcorrPeak(rx, ref, lo, hi) {
  const L = ref.re.length;
  let best = -1, bestI = lo;
  const mags = new Float64Array(Math.max(0, hi - lo));
  for (let d = lo; d < hi; d++) {
    let ar = 0, ai = 0;
    for (let n = 0; n < L; n++) {
      // sum ref*[n] · rx[d+n]
      ar += ref.re[n] * rx.re[d + n] + ref.im[n] * rx.im[d + n];
      ai += ref.re[n] * rx.im[d + n] - ref.im[n] * rx.re[d + n];
    }
    const m = ar * ar + ai * ai;
    mags[d - lo] = Math.sqrt(m);
    if (m > best) { best = m; bestI = d; }
  }
  return { idx: bestI, mag: Math.sqrt(best), mags, lo };
}

/* ---- full synchronizer ---- */
export function synchronize(rx, tx, opts = {}) {
  const grid = tx.grid, N = grid.N, cp = grid.cp, symLen = tx.symLen;
  const K = opts.intCfoSearch ?? 4;
  const sc = schmidlCox(rx, N);
  // S&C plateau: take the max, then refine to the plateau center
  let dMax = 0, mMax = -1;
  for (let d = 0; d < sc.M.length; d++) if (sc.M[d] > mMax) { mMax = sc.M[d]; dMax = d; }
  const epsFrac = Math.atan2(sc.Pim[dMax], sc.Pre[dMax]) / Math.PI;

  const rxF = derotated(rx, epsFrac, N);
  // P2 body sits one symbol after P1 body. Search +-symLen around the coarse
  // guess for each integer hypothesis.
  let best = { mag: -1, k: 0, idx: 0, mags: null, lo: 0 };
  for (let k = -K; k <= K; k++) {
    const cand = derotated(rxF, k, N);
    const lo = Math.max(0, dMax + symLen - Math.floor(1.5 * symLen));
    const hi = Math.min(cand.re.length - N, dMax + symLen + Math.floor(1.5 * symLen));
    const r = xcorrPeak(cand, tx.pre.body2, lo, hi);
    if (r.mag > best.mag) best = { ...r, k };
  }
  const epsTotal = best.k + epsFrac;
  // FIRST-PATH refinement: in multipath the argmax can sit on a strong later
  // tap. Walk back from the peak (up to one CP) and take the earliest lag
  // whose correlation still clears a fraction of the peak.
  if (best.mags) {
    const thr = (opts.firstPathThresh ?? 0.5) * best.mag;
    let idx = best.idx;
    const lo = Math.max(best.lo, best.idx - cp);
    for (let d = best.idx; d >= lo; d--) {
      if (best.mags[d - best.lo] >= thr) idx = d;
    }
    best.idx = idx;
  }
  // best.idx = start of the P2 BODY; frame starts 1 symbol + cp earlier.
  // Timing backoff: in multipath the xcorr peak can lock onto a LATER strong
  // tap; starting the FFT window late eats the next symbol's CP (ISI). Backing
  // off a few samples into the CP is safe (the CP absorbs it) and the residual
  // linear phase is handled by channel estimation / timing-aware perfect CSI.
  const backoff = opts.timingBackoff ?? 2;
  const frameStart = best.idx - cp - symLen - backoff;
  return { frameStart, epsFrac, kInt: best.k, epsTotal,
           scMetric: sc.M, scPeak: dMax, xcorr: best, backoff };
}

/* ---- demodulate one frame starting at `start` with CFO `eps` removed ---- */
export function demodulate(rx, tx, start, eps, ceMethod, eqMethod, chanMeta, opts = {}) {
  const grid = tx.grid, N = grid.N, cp = grid.cp, symLen = tx.symLen;
  const r = derotated(rx, eps, N);
  const nPil = grid.pilotBins.length;

  // true composite channel response (for 'perfect' CE and for MSE reporting).
  // Includes the linear phase of the RECEIVER's timing offset tau = start -
  // trueDelay: demodulating from a window shifted by tau multiplies each bin
  // by e^{+j 2π k τ / N}, and perfect CSI must describe the channel AS SEEN
  // by that window.
  let Htrue = null;
  if (chanMeta?.h) {
    const hz = czeros(N);
    hz.re.set(chanMeta.h.re.subarray(0, Math.min(N, chanMeta.h.re.length)));
    hz.im.set(chanMeta.h.im.subarray(0, Math.min(N, chanMeta.h.im.length)));
    const re = hz.re.slice(), im = hz.im.slice();
    fftRadix2(re, im, false);
    const sN = Math.sqrt(N);                // undo unitary: physical H = sum h e^{-jw}
    const tau = start - (chanMeta.trueDelay ?? start);
    Htrue = czeros(N);
    for (let k = 0; k < N; k++) {
      const a = 2 * Math.PI * k * tau / N, c = Math.cos(a), s2 = Math.sin(a);
      Htrue.re[k] = (re[k] * c - im[k] * s2) * sN;
      Htrue.im[k] = (re[k] * s2 + im[k] * c) * sN;
    }
  }

  const fftOut = [], Hest = [], eqSyms = czeros(grid.dataBins.length * grid.nSym);
  const rxConstPre = czeros(grid.dataBins.length * grid.nSym);
  let mseAcc = 0, mseCnt = 0;
  const sigma2 = chanMeta?.sigma2 ?? 0;

  for (let s = 0; s < grid.nSym; s++) {
    const off = start + (2 + s) * symLen + cp;
    if (off + N > r.re.length) throw new Error("frame truncated: bad sync?");
    const re = r.re.slice(off, off + N), im = r.im.slice(off, off + N);
    fftRadix2(re, im, false);
    const Y = { re, im };
    fftOut.push(Y);

    // ---- channel estimation on the actual received pilots ----
    const Hp = czeros(nPil);
    grid.pilotBins.forEach((k, i) => {
      const pr = tx.pilots.re[i], pi = tx.pilots.im[i];
      const d = pr * pr + pi * pi;
      Hp.re[i] = (Y.re[k] * pr + Y.im[k] * pi) / d;
      Hp.im[i] = (Y.im[k] * pr - Y.re[k] * pi) / d;
    });
    let H;
    if (ceMethod === "perfect" && Htrue) {
      // Oracle CSI for the receiver as it actually runs: the residual CFO
      // (true - estimated) rotates the window by 2*pi*res*n/N; its effect on a
      // data symbol is taken at the window centre as one common phase.
      const res = (chanMeta.trueCfoEps ?? 0) - eps;
      const phi = 2 * Math.PI * res * (off + (N - 1) / 2) / N;
      const c = Math.cos(phi), sn = Math.sin(phi);
      H = czeros(N);
      for (let k = 0; k < N; k++) {
        H.re[k] = Htrue.re[k] * c - Htrue.im[k] * sn;
        H.im[k] = Htrue.re[k] * sn + Htrue.im[k] * c;
      }
    } else if (ceMethod === "ls-dft" || ceMethod === "lmmse") {
      H = dftInterp(Hp, grid, ceMethod === "lmmse" ? sigma2 : null);
    } else {                                   // 'ls-linear' (default)
      H = linInterp(Hp, grid);
    }
    Hest.push(H);
    if (Htrue && ceMethod !== "perfect") {
      for (const k of grid.activeBins) {
        const dr = H.re[k] - Htrue.re[k], di = H.im[k] - Htrue.im[k];
        mseAcc += dr * dr + di * di; mseCnt++;
      }
    }

    // ---- equalization ----
    grid.dataBins.forEach((k, i) => {
      const q = s * grid.dataBins.length + i;
      rxConstPre.re[q] = Y.re[k]; rxConstPre.im[q] = Y.im[k];
      const hr = H.re[k], hi = H.im[k];
      const den = Math.max(hr * hr + hi * hi + (eqMethod === "mmse" ? sigma2 : 0), 1e-12);
      eqSyms.re[q] = (Y.re[k] * hr + Y.im[k] * hi) / den;
      eqSyms.im[q] = (Y.im[k] * hr - Y.re[k] * hi) / den;
    });
  }

  // ---- demap + metrics ----
  const rxBits = qamDemap(eqSyms, tx.bps);
  let errs = 0;
  for (let i = 0; i < tx.txBits.length; i++) if (rxBits[i] !== tx.txBits[i]) errs++;
  const ber = errs / tx.txBits.length;

  const ideal = qamMap(tx.txBits, tx.bps);
  let errP = 0, refP = 0;
  for (let i = 0; i < eqSyms.re.length; i++) {
    errP += (eqSyms.re[i] - ideal.re[i]) ** 2 + (eqSyms.im[i] - ideal.im[i]) ** 2;
    refP += ideal.re[i] ** 2 + ideal.im[i] ** 2;
  }
  const evm = Math.sqrt(errP / Math.max(refP, 1e-24));

  return { fftOut, Hest, Htrue, eqSyms, rxConstPre, rxBits,
           ber, bitErrors: errs, bitTotal: tx.txBits.length,
           evm, mseH: mseCnt ? mseAcc / mseCnt : null };
}

/* LS pilots -> DELAY-COMPENSATED linear interpolation over the active bins.
 * A timing offset tau makes H[k] rotate e^{j 2π k τ/N}; plain linear interp
 * of that fast spiral between pilots is badly biased. So: (1) estimate the
 * dominant per-bin phase slope from adjacent-pilot products (a pure pilot
 * operation, no oracle), (2) derotate, (3) linearly interpolate the slowly
 * varying residual, (4) re-apply the ramp.                                 */
function linInterp(Hp, grid) {
  const pb = grid.pilotBins;
  // dominant phase slope per bin from uniformly spaced pilot pairs
  let zr = 0, zi = 0, ds = grid.pilotSpacing;
  for (let i = 0; i + 1 < pb.length; i++) {
    if (pb[i + 1] - pb[i] !== ds) continue;          // skip irregular edge pair
    zr += Hp.re[i + 1] * Hp.re[i] + Hp.im[i + 1] * Hp.im[i];
    zi += Hp.im[i + 1] * Hp.re[i] - Hp.re[i + 1] * Hp.im[i];
  }
  const slope = Math.atan2(zi, zr) / ds;             // rad per bin
  // derotate pilots by the ramp
  const Hd = czeros(pb.length);
  for (let i = 0; i < pb.length; i++) {
    const a = -slope * pb[i], c = Math.cos(a), s = Math.sin(a);
    Hd.re[i] = Hp.re[i] * c - Hp.im[i] * s;
    Hd.im[i] = Hp.re[i] * s + Hp.im[i] * c;
  }
  const H = czeros(grid.N);
  for (const k of grid.activeBins) {
    let j = 0;
    while (j < pb.length - 1 && pb[j + 1] <= k) j++;
    const k0 = pb[j], k1 = pb[Math.min(j + 1, pb.length - 1)];
    const t = k1 > k0 ? Math.min(1, Math.max(0, (k - k0) / (k1 - k0))) : 0;
    const j1 = Math.min(j + 1, pb.length - 1);
    const vr = Hd.re[j] + (Hd.re[j1] - Hd.re[j]) * t;
    const vi = Hd.im[j] + (Hd.im[j1] - Hd.im[j]) * t;
    const a = slope * k, c = Math.cos(a), s = Math.sin(a);   // re-apply ramp
    H.re[k] = vr * c - vi * s;
    H.im[k] = vr * s + vi * c;
  }
  return H;
}

/* LS pilots -> P-point IDFT -> keep first `cp` taps (optionally Wiener-
 * weighted) -> evaluate DFT on all N bins.
 * NOTE: pilots are indexed by their order along the active band; the
 * implied tap grid is the pilot-spacing-decimated delay axis, which matches
 * the CP support when pilotSpacing * cp <= N (true for the defaults).      */
function dftInterp(Hp, grid, sigma2OrNull) {
  const P = Hp.re.length;
  const cr = new Float64Array(P), ci = new Float64Array(P);
  for (let n = 0; n < P; n++) {
    let ar = 0, ai = 0;
    for (let m = 0; m < P; m++) {
      const a = 2 * Math.PI * m * n / P, c = Math.cos(a), s = Math.sin(a);
      ar += Hp.re[m] * c - Hp.im[m] * s;
      ai += Hp.re[m] * s + Hp.im[m] * c;
    }
    cr[n] = ar / P; ci[n] = ai / P;
  }
  const th = Math.min(P, Math.ceil(grid.cp * P / (grid.N / grid.pilotSpacing)));
  if (sigma2OrNull != null) {                       // LMMSE tap weighting
    let pe = 0; const pdp = new Float64Array(th);
    for (let n = 0; n < th; n++) { pdp[n] = Math.exp(-0.5 * n); pe += pdp[n]; }
    for (let n = 0; n < th; n++) {
      const w = (pdp[n] / pe) / ((pdp[n] / pe) + sigma2OrNull / P);
      cr[n] *= w; ci[n] *= w;
    }
  }
  for (let n = th; n < P; n++) { cr[n] = 0; ci[n] = 0; }
  // evaluate on pilot index axis then linear-map to bins via pilot ordering
  const Hp2 = czeros(P);
  for (let m = 0; m < P; m++) {
    let ar = 0, ai = 0;
    for (let n = 0; n < th; n++) {
      const a = -2 * Math.PI * m * n / P, c = Math.cos(a), s = Math.sin(a);
      ar += cr[n] * c - ci[n] * s;
      ai += cr[n] * s + ci[n] * c;
    }
    Hp2.re[m] = ar; Hp2.im[m] = ai;
  }
  return linInterp(Hp2, grid);
}

/* ---- one-call end-to-end receive ---- */
export function receive(rx, tx, chanMeta, opts = {}) {
  const mode = opts.syncMode ?? "practical";       // 'practical' | 'oracle'
  let sync;
  if (mode === "oracle") {
    sync = { frameStart: chanMeta.trueDelay, epsTotal: chanMeta.trueCfoEps,
             epsFrac: null, kInt: null, scMetric: null, oracle: true };
  } else {
    sync = synchronize(rx, tx, opts);
    sync.oracle = false;
  }
  const dem = demodulate(rx, tx, sync.frameStart, sync.epsTotal,
                         opts.ceMethod ?? "ls-linear", opts.eqMethod ?? "zf",
                         chanMeta, opts);
  return { sync,
           syncErr: sync.frameStart - chanMeta.trueDelay,
           cfoErrEps: sync.epsTotal - chanMeta.trueCfoEps,
           ...dem };
}
