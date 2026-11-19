/* =========================================================================
 * OFDM E2E — Layer B: sample-level channel & RF impairments.
 *
 * Every function here transforms actual complex IQ sample arrays.
 *
 * IMPAIRMENT ORDERING (fixed, documented):
 *   TX side : PA nonlinearity
 *   medium  : integer delay -> multipath FIR (full convolution, ISI kept)
 *           -> CFO (continuous sample index) -> phase noise (Wiener)
 *           -> SFO (receiver-clock resampling, linear interpolation)
 *   RX side : AWGN (receiver thermal) -> IQ imbalance -> DC offset
 * ========================================================================= */

import { czeros, cpower, makeRng } from "../phy/engine.js";

/* ---------- channel presets: {delaySamp, powerDb} tap profiles ----------
 * Loosely patterned on 3GPP EPA/EVA/ETU shapes at ~20 Msps, expressed in
 * integer sample delays. Rician = EPA-like PDP + K-factor LOS on tap 0.   */
export const CHANNEL_PRESETS = {
  AWGN:   { taps: [{ d: 0, pDb: 0 }], ricianK: null, fixed: true },   // h = [1]: no fading, no phase
  EPA:    { taps: [{ d: 0, pDb: 0 }, { d: 1, pDb: -3 }, { d: 2, pDb: -9 }], ricianK: null },
  EVA:    { taps: [{ d: 0, pDb: 0 }, { d: 1, pDb: -1.5 }, { d: 3, pDb: -1.4 },
                   { d: 6, pDb: -3.6 }, { d: 9, pDb: -9 }, { d: 14, pDb: -12 }], ricianK: null },
  ETU:    { taps: [{ d: 0, pDb: -1 }, { d: 1, pDb: -1 }, { d: 2, pDb: -1 }, { d: 4, pDb: 0 },
                   { d: 6, pDb: 0 }, { d: 10, pDb: 0 }, { d: 32, pDb: -3 },
                   { d: 46, pDb: -5 }, { d: 100, pDb: -7 }], ricianK: null },
  Rician: { taps: [{ d: 0, pDb: 0 }, { d: 1, pDb: -3 }, { d: 2, pDb: -9 }], ricianK: 10 },
};

/* draw a complex FIR h[l] from a tap profile (Rayleigh per tap, optional
 * Rician LOS on the first tap), normalized to unit total power.           */
export function drawChannel(profile, rng) {
  if (profile.fixed) {
    const h = czeros(1); h.re[0] = 1; return h;
  }
  const maxD = profile.taps.reduce((m, t) => Math.max(m, t.d), 0);
  const h = czeros(maxD + 1);
  for (const t of profile.taps) {
    const a = Math.pow(10, t.pDb / 20) / Math.SQRT2;
    h.re[t.d] += a * rng.gauss();
    h.im[t.d] += a * rng.gauss();
  }
  if (profile.ricianK != null) {
    const kLin = Math.pow(10, profile.ricianK / 10);
    let p = 0;
    for (let l = 0; l < h.re.length; l++) p += h.re[l] ** 2 + h.im[l] ** 2;
    h.re[0] += Math.sqrt(kLin * p);                     // deterministic LOS
  }
  let p = 0;
  for (let l = 0; l < h.re.length; l++) p += h.re[l] ** 2 + h.im[l] ** 2;
  const s = 1 / Math.sqrt(p || 1);
  for (let l = 0; l < h.re.length; l++) { h.re[l] *= s; h.im[l] *= s; }
  return h;
}

/* y[n] = sum_l h[l] x[n-l]  — full convolution, output length nx+L-1      */
export function firConvolve(x, h) {
  const nx = x.re.length, L = h.re.length;
  const y = czeros(nx + L - 1);
  for (let l = 0; l < L; l++) {
    const hr = h.re[l], hi = h.im[l];
    if (hr === 0 && hi === 0) continue;
    for (let n = 0; n < nx; n++) {
      y.re[n + l] += hr * x.re[n] - hi * x.im[n];
      y.im[n + l] += hr * x.im[n] + hi * x.re[n];
    }
  }
  return y;
}

/* CFO: y[n] *= e^{j 2π ε n / N} with a CONTINUOUS index across the frame  */
export function applyCfo(x, epsSubcarrier, N) {
  const w = 2 * Math.PI * epsSubcarrier / N;
  for (let n = 0; n < x.re.length; n++) {
    const c = Math.cos(w * n), s = Math.sin(w * n);
    const r = x.re[n] * c - x.im[n] * s;
    x.im[n] = x.re[n] * s + x.im[n] * c;
    x.re[n] = r;
  }
}

/* phase noise: Wiener process, per-sample step std sigma = sqrt(2π β / Fs) */
export function applyPhaseNoise(x, linewidthHz, fs, rng) {
  if (!linewidthHz) return;
  const sg = Math.sqrt(2 * Math.PI * linewidthHz / fs);
  let phi = 0;
  for (let n = 0; n < x.re.length; n++) {
    phi += sg * rng.gauss();
    const c = Math.cos(phi), s = Math.sin(phi);
    const r = x.re[n] * c - x.im[n] * s;
    x.im[n] = x.re[n] * s + x.im[n] * c;
    x.re[n] = r;
  }
}

/* SFO: receiver samples at t_n = n(1+δ); δ in ppm. Linear interpolation of
 * the incoming stream — a genuine resampling, not a constellation trick.  */
export function applySfo(x, ppm) {
  if (!ppm) return x;
  const d = ppm * 1e-6, n = x.re.length;
  const y = czeros(n);
  for (let k = 0; k < n; k++) {
    const t = k * (1 + d);
    const i = Math.floor(t), f = t - i;
    if (i + 1 >= n) { y.re[k] = x.re[n - 1]; y.im[k] = x.im[n - 1]; continue; }
    y.re[k] = x.re[i] * (1 - f) + x.re[i + 1] * f;
    y.im[k] = x.im[i] * (1 - f) + x.im[i + 1] * f;
  }
  return y;
}

/* AWGN with explicit per-complex-sample variance sigma2                   */
export function addAwgn(x, sigma2, rng) {
  const s = Math.sqrt(sigma2 / 2);
  for (let n = 0; n < x.re.length; n++) {
    x.re[n] += s * rng.gauss();
    x.im[n] += s * rng.gauss();
  }
}

/* RX IQ imbalance (gain g, phase φ) in widely-linear form:
 *   I' = I ;  Q' = g (sin φ · I + cos φ · Q)
 * equivalent to y' = α y + β y*, with image coefficient β (see test F4).   */
export function applyIqImbalance(x, gainDb, phaseDeg) {
  const g = Math.pow(10, gainDb / 20), p = phaseDeg * Math.PI / 180;
  const sp = Math.sin(p), cp = Math.cos(p);
  for (let n = 0; n < x.re.length; n++)
    x.im[n] = g * (sp * x.re[n] + cp * x.im[n]);
}

/* Rapp PA model (p=2): g(|x|) = (1+(|x|/A)^{2p})^{-1/(2p)}
 * Saturation level A is set by the OUTPUT back-off relative to the measured
 * mean power of the input: OBO = 10 log10(A^2 / P_avg)  =>  A = sqrt(P_avg) 10^{OBO/20}. */
export function applyPa(x, backoffDb, p = 2) {
  const A = Math.sqrt(cpower(x)) * Math.pow(10, backoffDb / 20);
  for (let n = 0; n < x.re.length; n++) {
    const m = Math.hypot(x.re[n], x.im[n]);
    const g = Math.pow(1 + Math.pow(m / A, 2 * p), -1 / (2 * p));
    x.re[n] *= g; x.im[n] *= g;
  }
}

export function applyDcOffset(x, dc) {
  for (let n = 0; n < x.re.length; n++) x.re[n] += dc;
}

/* ---------------- full channel pass ----------------
 * cfg = { preset|taps, ricianK, delay, cfoEps, pnLinewidthHz, sfoPpm,
 *         iq:{gainDb,phaseDeg}|null, pa:{backoffDb,p}|null, dc:0,
 *         noise:{mode:'esn0'|'ebn0'|'sample', valueDb}|null,
 *         fs, seed }
 * tx = transmit() result. Returns {rxIQ, h, trueDelay, sigma2, ...}.      */
export function applyChannel(tx, cfg) {
  const rng = makeRng((cfg.seed ?? 1) ^ 0x5EED);
  const grid = tx.grid;
  let x = { re: tx.txIQ.re.slice(), im: tx.txIQ.im.slice() };

  if (cfg.pa) applyPa(x, cfg.pa.backoffDb, cfg.pa.p ?? 2);

  const profile = cfg.taps
    ? { taps: cfg.taps, ricianK: cfg.ricianK ?? null }
    : CHANNEL_PRESETS[cfg.preset ?? "AWGN"];
  const h = drawChannel(profile, rng);

  const delay = cfg.delay ?? 0;
  let y0 = firConvolve(x, h);
  const tail = cfg.tail ?? (grid.N + grid.cp);
  const y = czeros(delay + y0.re.length + tail);
  y.re.set(y0.re, delay); y.im.set(y0.im, delay);

  if (cfg.cfoEps) applyCfo(y, cfg.cfoEps, grid.N);
  applyPhaseNoise(y, cfg.pnLinewidthHz ?? 0, cfg.fs ?? 20e6, rng);
  let z = applySfo(y, cfg.sfoPpm ?? 0);

  let sigma2 = 0;
  if (cfg.noise) {
    const bps = tx.bps;
    let esn0;
    if (cfg.noise.mode === "ebn0") esn0 = cfg.noise.valueDb + 10 * Math.log10(bps);
    else if (cfg.noise.mode === "sample") {
      const p = cpower(z, delay, delay + tx.frameLen);
      sigma2 = p / Math.pow(10, cfg.noise.valueDb / 10);
    } else esn0 = cfg.noise.valueDb;                     // 'esn0'
    if (cfg.noise.mode !== "sample") sigma2 = Math.pow(10, -esn0 / 10);
    addAwgn(z, sigma2, rng);
  }

  if (cfg.iq) applyIqImbalance(z, cfg.iq.gainDb, cfg.iq.phaseDeg);
  if (cfg.dc) applyDcOffset(z, cfg.dc);

  return { rxIQ: z, h, trueDelay: delay, trueCfoEps: cfg.cfoEps ?? 0,
           sigma2, channelCfg: cfg };
}
