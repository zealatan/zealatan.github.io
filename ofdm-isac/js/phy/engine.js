/* =========================================================================
 * OFDM E2E PHY engine — Layer A (pure math, no DOM).
 *
 * Conventions (also exported in every signal dump, schema §export.js):
 *  - Complex arrays: { re: Float64Array, im: Float64Array }, index-aligned.
 *  - FFT bins: NATURAL order k = 0..N-1. k=0 is DC. k in (0, N/2) are
 *    positive frequencies, k in (N/2, N) are negative frequencies
 *    (f_k = k - N for k >= N/2). The guard band straddles Nyquist.
 *  - Transforms are UNITARY: both FFT and IFFT scale by 1/sqrt(N), so
 *    Parseval holds with equal energies on both sides and per-bin noise
 *    variance equals per-sample noise variance.
 *  - QAM constellations are Gray-coded per axis and normalized to unit
 *    average symbol energy (E_s = 1) on active bins.
 *  - All randomness flows through the seeded RNG below (mulberry32 +
 *    Box-Muller); identical config + seed => identical output bits/samples.
 * ========================================================================= */

export const ENGINE_VERSION = "1.0.0";

/* ---------------- seeded RNG (deterministic) ---------------- */
export function makeRng(seed) {
  let a = seed >>> 0;
  let spare = null;
  const u = () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let x = 0, y = 0;
    while (x === 0) x = u();
    y = u();
    const r = Math.sqrt(-2 * Math.log(x)), t = 2 * Math.PI * y;
    spare = r * Math.sin(t);
    return r * Math.cos(t);
  };
  return { uniform: u, gauss, int: (n) => Math.floor(u() * n) };
}

/* ---------------- complex array helpers ---------------- */
export function czeros(n) { return { re: new Float64Array(n), im: new Float64Array(n) }; }
export function cclone(x) { return { re: x.re.slice(), im: x.im.slice() }; }
export function cpower(x, lo = 0, hi = -1) {
  if (hi < 0) hi = x.re.length;
  let p = 0;
  for (let n = lo; n < hi; n++) p += x.re[n] * x.re[n] + x.im[n] * x.im[n];
  return p / Math.max(1, hi - lo);
}

/* ---------------- unitary radix-2 FFT ---------------- */
/* In-place on (re, im). inverse=false: X[k] = (1/sqrt N) * sum x[n] e^{-j2πkn/N}
 * inverse=true : x[n] = (1/sqrt N) * sum X[k] e^{+j2πkn/N}                  */
export function fftRadix2(re, im, inverse) {
  const n = re.length;
  if (n & (n - 1)) throw new Error("FFT size must be a power of 2");
  for (let i = 1, j = 0; i < n; i++) {           // bit-reversal permutation
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inverse ? 1 : -1) * 2 * Math.PI / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  const s = 1 / Math.sqrt(n);                     // unitary scaling
  for (let i = 0; i < n; i++) { re[i] *= s; im[i] *= s; }
}
export function fft(x)  { const y = cclone(x); fftRadix2(y.re, y.im, false); return y; }
export function ifft(X) { const y = cclone(X); fftRadix2(y.re, y.im, true);  return y; }

/* ---------------- Gray-coded square QAM ---------------- */
export const MODS = { QPSK: 2, "16QAM": 4, "64QAM": 6, "256QAM": 8 };

function gray(n) { return n ^ (n >> 1); }
function ungray(g) { let n = 0; while (g) { n ^= g; g >>= 1; } return n; }

export function qamTables(bitsPerSym) {
  const bAxis = bitsPerSym / 2, L = 1 << bAxis;
  let s = 0;
  for (let i = 0; i < L; i++) { const v = 2 * i - (L - 1); s += v * v; }
  const norm = 1 / Math.sqrt(2 * s / L);          // E_s = 1
  // axis value for Gray code g: level index i = ungray(g)
  const valOfGray = new Float64Array(L);
  for (let g = 0; g < L; g++) valOfGray[g] = (2 * ungray(g) - (L - 1)) * norm;
  return { L, bAxis, norm, valOfGray };
}

/* bits (0/1 array) -> complex symbols. Bit layout per symbol:
 * [ I-axis bAxis bits (MSB first) | Q-axis bAxis bits ], Gray per axis.   */
export function qamMap(bits, bitsPerSym) {
  const t = qamTables(bitsPerSym);
  const nSym = Math.floor(bits.length / bitsPerSym);
  const out = czeros(nSym);
  for (let s = 0, b = 0; s < nSym; s++) {
    let gi = 0, gq = 0;
    for (let k = 0; k < t.bAxis; k++) gi = (gi << 1) | bits[b++];
    for (let k = 0; k < t.bAxis; k++) gq = (gq << 1) | bits[b++];
    out.re[s] = t.valOfGray[gi];
    out.im[s] = t.valOfGray[gq];
  }
  return out;
}

/* hard-decision demap, inverse of qamMap (same Gray/axis layout) */
export function qamDemap(sym, bitsPerSym) {
  const t = qamTables(bitsPerSym), L = t.L;
  const bits = new Uint8Array(sym.re.length * bitsPerSym);
  let b = 0;
  const slice = (v) => {
    let i = Math.round((v / t.norm + (L - 1)) / 2);
    if (i < 0) i = 0; if (i > L - 1) i = L - 1;
    return gray(i);
  };
  for (let s = 0; s < sym.re.length; s++) {
    const gi = slice(sym.re[s]), gq = slice(sym.im[s]);
    for (let k = t.bAxis - 1; k >= 0; k--) bits[b++] = (gi >> k) & 1;
    for (let k = t.bAxis - 1; k >= 0; k--) bits[b++] = (gq >> k) & 1;
  }
  return bits;
}

export function randomBits(n, rng) {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = rng.uniform() < 0.5 ? 0 : 1;
  return b;
}

/* ---------------- resource grid ---------------- */
/* Default numerology. N and CP are configurable; pilots/guards derive.     */
export function makeGrid(cfg = {}) {
  const N = cfg.N ?? 128;
  const cp = cfg.cp ?? 16;
  const guard = cfg.guard ?? Math.round(N * 11 / 64);   // total guard bins @ Nyquist
  const pilotSpacing = cfg.pilotSpacing ?? 8;           // every k-th ACTIVE bin
  const nSym = cfg.nSym ?? 14;                          // data symbols per frame

  // active bins: all except DC (k=0) and the guard band straddling Nyquist
  const gLo = N / 2 - Math.floor(guard / 2);
  const gHi = N / 2 + Math.ceil(guard / 2);              // inclusive..exclusive
  const active = [];
  for (let k = 1; k < N; k++) if (k < gLo || k > gHi) active.push(k);

  // pilots: every pilotSpacing-th active bin, forcing both edges to be pilots
  const pilotBins = [];
  for (let i = 0; i < active.length; i += pilotSpacing) pilotBins.push(active[i]);
  if (pilotBins[pilotBins.length - 1] !== active[active.length - 1])
    pilotBins.push(active[active.length - 1]);
  const pset = new Set(pilotBins);
  const dataBins = active.filter(k => !pset.has(k));

  return { N, cp, nSym, guard, pilotSpacing,
           activeBins: active, pilotBins, dataBins,
           binOrder: "natural (k=0 DC, k>=N/2 negative freqs; guard straddles Nyquist)" };
}

/* pilot symbols: BPSK from an m-sequence LFSR (x[i]=x[i-3]+x[i-7], seed
 * 1110110) — deterministic, independent of the data RNG, known to the RX.  */
export function pilotSequence(len) {
  const x = new Uint8Array(Math.max(len, 7));
  const init = [1, 1, 1, 0, 1, 1, 0];
  for (let i = 0; i < x.length; i++) x[i] = i < 7 ? init[i] : (x[i - 3] + x[i - 7]) & 1;
  const s = czeros(len);
  for (let i = 0; i < len; i++) { s.re[i] = 2 * x[i] - 1; s.im[i] = 0; }
  return s;
}

/* ---------------- preambles ---------------- */
/* P1 (Schmidl & Cox): only even-indexed ACTIVE bins carry QPSK from a fixed
 * dedicated RNG -> the time body has two identical halves (period N/2).
 * Used for coarse timing + fractional CFO.
 * P2: every active bin carries pilot-sequence BPSK -> fully known waveform.
 * Used for fine timing + integer-CFO hypothesis search.                     */
export function buildPreambles(grid) {
  const prng = makeRng(0xC0FFEE);
  const X1 = czeros(grid.N);
  for (const k of grid.activeBins) {
    if (k % 2 === 0) {
      // QPSK at power 2 per loaded bin: only half the active bins are loaded,
      // so the preamble symbol energy matches a data symbol's.
      X1.re[k] = prng.uniform() < 0.5 ? -1 : 1;
      X1.im[k] = prng.uniform() < 0.5 ? -1 : 1;
    }
  }
  const X2 = czeros(grid.N);
  const seq = pilotSequence(grid.activeBins.length);
  grid.activeBins.forEach((k, i) => { X2.re[k] = seq.re[i]; X2.im[k] = 0; });
  const t1 = ifft(X1), t2 = ifft(X2);
  const withCp = (t) => {
    const y = czeros(grid.cp + grid.N);
    y.re.set(t.re.subarray(grid.N - grid.cp), 0); y.im.set(t.im.subarray(grid.N - grid.cp), 0);
    y.re.set(t.re, grid.cp); y.im.set(t.im, grid.cp);
    return y;
  };
  return { X1, X2, t1: withCp(t1), t2: withCp(t2), body2: t2 };
}

/* ---------------- transmitter ---------------- */
/* Returns every intermediate signal for inspection/export.                 */
export function transmit(cfg) {
  const grid = cfg.grid;
  const bps = MODS[cfg.mod];
  const rng = makeRng(cfg.seed ?? 1);
  const nDataBits = grid.dataBins.length * bps * grid.nSym;

  const txBits = cfg.txBits ?? randomBits(nDataBits, rng);
  if (txBits.length !== nDataBits)
    throw new Error(`txBits length ${txBits.length} != ${nDataBits}`);
  const qamSyms = qamMap(txBits, bps);
  const pilots = pilotSequence(grid.pilotBins.length);   // same pilots every symbol

  const pre = buildPreambles(grid);
  const symLen = grid.cp + grid.N;
  const frameLen = 2 * symLen + grid.nSym * symLen;
  const tx = czeros(frameLen);
  tx.re.set(pre.t1.re, 0);            tx.im.set(pre.t1.im, 0);
  tx.re.set(pre.t2.re, symLen);       tx.im.set(pre.t2.im, symLen);

  const gridSyms = [];                 // frequency-domain resource grid per symbol
  const ifftOut = [];                  // IFFT output bodies (no CP)
  for (let s = 0; s < grid.nSym; s++) {
    const X = czeros(grid.N);
    grid.pilotBins.forEach((k, i) => { X.re[k] = pilots.re[i]; X.im[k] = pilots.im[i]; });
    grid.dataBins.forEach((k, i) => {
      const q = s * grid.dataBins.length + i;
      X.re[k] = qamSyms.re[q]; X.im[k] = qamSyms.im[q];
    });
    gridSyms.push(X);
    const x = ifft(X);
    ifftOut.push(x);
    const off = (2 + s) * symLen;
    tx.re.set(x.re.subarray(grid.N - grid.cp), off); tx.im.set(x.im.subarray(grid.N - grid.cp), off);
    tx.re.set(x.re, off + grid.cp);                  tx.im.set(x.im, off + grid.cp);
  }
  return { grid, mod: cfg.mod, bps, seed: cfg.seed ?? 1,
           txBits, qamSyms, pilots, gridSyms, ifftOut, pre, symLen, frameLen, txIQ: tx };
}

/* ---------------- SNR definitions / conversions ---------------- */
/* Es/N0 : per ACTIVE subcarrier symbol energy over noise PSD. With unitary
 *   transforms and unit-power constellations, a time-domain complex-noise
 *   variance of sigma^2 gives per-bin variance sigma^2, so
 *       Es/N0 [dB] = -10 log10(sigma^2).
 * Eb/N0 : Es/N0 - 10 log10(bitsPerSym). (Data-bearing energy only; CP and
 *   pilot overhead are reported separately, not folded into this def.)
 * sample SNR : measured signal power / noise power on the time samples.
 *   P_signal = (nActive/N) for a data symbol body (active bins unit power).
 * Overhead helpers (for reporting): cpOverheadDb = 10log10((N+cp)/N),
 *   pilotOverheadDb = 10log10(active/data).                                 */
export function snrHelpers(grid, bps) {
  const nAct = grid.activeBins.length, nDat = grid.dataBins.length;
  return {
    esn0FromEbn0: (ebn0) => ebn0 + 10 * Math.log10(bps),
    ebn0FromEsn0: (esn0) => esn0 - 10 * Math.log10(bps),
    noiseVarFromEsn0: (esn0) => Math.pow(10, -esn0 / 10),
    sampleSnrFromEsn0: (esn0) => esn0 + 10 * Math.log10(nAct / grid.N),
    cpOverheadDb: 10 * Math.log10((grid.N + grid.cp) / grid.N),
    pilotOverheadDb: 10 * Math.log10(nAct / nDat),
  };
}
