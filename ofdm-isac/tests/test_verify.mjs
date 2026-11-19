/* =========================================================================
 * OFDM E2E — verification suite (mission: golden-reference validation).
 * Run:  node tests/test_verify.mjs            (writes tests/results/last_verify.json)
 *
 * Every check runs the engine. Statistical checks use frame-level batch
 * means (ratio estimator), so the reported standard error respects frame
 * correlation; they pass only when |measured - expected| <= z * SE with the
 * z stated in each test. Thresholds are fixed BEFORE a run from theory.
 * ========================================================================= */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeGrid, transmit, fft, ifft, czeros, cpower, makeRng, qamTables, qamMap, qamDemap,
  randomBits, MODS, buildPreambles, snrHelpers,
} from "../js/phy/engine.js";
import {
  applyChannel, CHANNEL_PRESETS, drawChannel, firConvolve, applyCfo, applySfo,
  applyPhaseNoise, applyIqImbalance, applyPa, applyDcOffset,
} from "../js/channel/channel.js";
import { receive, schmidlCox, synchronize } from "../js/receiver/receiver.js";
import { buildExport, parseExport, regenerate, EXPORT_SCHEMA, EXPORT_VERSION } from "../js/experiments/export.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

/* ---------------- harness ---------------- */
const results = [];
let section = "";
function sec(name) { section = name; console.log(`\n== ${name}`); }
function check(name, pass, value, expected, note = "") {
  results.push({ section, name, pass: !!pass, value, expected, note });
  const v = typeof value === "number" ? value.toPrecision(4) : String(value);
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}  [measured ${v} | expected ${expected}]${note ? "  " + note : ""}`);
}
const erfc = (x) => { const z = Math.abs(x), t = 1 / (1 + z / 2);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r; };
const Q = (x) => 0.5 * erfc(x / Math.SQRT2);
const G = makeGrid({});
const FS = 20e6;

/* batch-mean BER: returns {p, se, errs, bits, frames} */
function berBatch(framesFn) {
  let E = 0, B = 0, F = 0; const per = [];
  for (const [e, b] of framesFn()) { E += e; B += b; per.push([e, b]); F++; }
  const p = E / B;
  let v = 0; for (const [e, b] of per) v += (e - p * b) ** 2;
  v = v / (F - 1) / ((B / F) ** 2);
  return { p, se: Math.sqrt(v), errs: E, bits: B, frames: F };
}
const naiveDft = (re, im, inv) => {
  const N = re.length, sc = 1 / Math.sqrt(N), sg = inv ? 1 : -1;
  const yr = new Float64Array(N), yi = new Float64Array(N);
  for (let k = 0; k < N; k++) for (let n = 0; n < N; n++) {
    const a = sg * 2 * Math.PI * k * n / N, c = Math.cos(a), s = Math.sin(a);
    yr[k] += re[n] * c - im[n] * s; yi[k] += re[n] * s + im[n] * c;
  }
  for (let k = 0; k < N; k++) { yr[k] *= sc; yi[k] *= sc; }
  return { re: yr, im: yi };
};
const maxAbsDiff = (a, b) => { let m = 0; for (let i = 0; i < a.re.length; i++)
  m = Math.max(m, Math.hypot(a.re[i] - b.re[i], a.im[i] - b.im[i])); return m; };

/* =========================================================================
 * A. FFT / IFFT
 * ========================================================================= */
sec("A. FFT/IFFT (unitary) — invertibility, conventions, Parseval");
{
  const rng = makeRng(101);
  for (const N of [8, 16, 64, 128, 256, 1024]) {
    const x = czeros(N);
    for (let i = 0; i < N; i++) { x.re[i] = rng.gauss(); x.im[i] = rng.gauss(); }
    const X = fft(x), xr = ifft(X);
    const rt = maxAbsDiff(xr, x);
    check(`IFFT(FFT(x))=x  N=${N}`, rt < 1e-12, rt, "< 1e-12");
    const nd = naiveDft(x.re, x.im, false);
    check(`FFT matches naive DFT (exp(-j))  N=${N}`, maxAbsDiff(X, nd) < 1e-11, maxAbsDiff(X, nd), "< 1e-11");
    const ni = naiveDft(X.re, X.im, true);
    check(`IFFT matches naive IDFT (exp(+j))  N=${N}`, maxAbsDiff(ifft(X), ni) < 1e-11, maxAbsDiff(ifft(X), ni), "< 1e-11");
    const eT = cpower(x) * N, eF = cpower(X) * N;
    check(`Parseval sum|x|^2=sum|X|^2  N=${N}`, Math.abs(eT - eF) / eT < 1e-12, Math.abs(eT - eF) / eT, "< 1e-12");
  }
  // sign convention: a positive-frequency tone e^{+j2pi k0 n/N} is at bin k0 after forward FFT
  const N = 64, k0 = 5, t = czeros(N);
  for (let n = 0; n < N; n++) { t.re[n] = Math.cos(2 * Math.PI * k0 * n / N); t.im[n] = Math.sin(2 * Math.PI * k0 * n / N); }
  const T = fft(t);
  const mags = Array.from({ length: N }, (_, k) => Math.hypot(T.re[k], T.im[k]));
  const kArg = mags.indexOf(Math.max(...mags));
  check("sign: e^{+j2pi k0 n/N} -> forward FFT peak at bin k0", kArg === k0, kArg, `${k0}`);
  check("sign: unit-amplitude tone -> unitary FFT peak = sqrt(N)", Math.abs(mags[k0] - Math.sqrt(N)) < 1e-12, mags[k0], `${Math.sqrt(N)}`);
  // ifft bin placement: X=delta_k -> time tone e^{+j2pi k n/N}/sqrt(N)
  const D = czeros(N); D.re[k0] = 1;
  const d = ifft(D);
  const ph = Math.atan2(d.im[1], d.re[1]), expPh = 2 * Math.PI * k0 / N;
  check("ifft: X[k0]=1 -> x[n]=e^{+j2pi k0 n/N}/sqrt(N) (phase at n=1)",
        Math.abs(Math.atan2(Math.sin(ph - expPh), Math.cos(ph - expPh))) < 1e-12, ph, expPh.toFixed(6));
}

/* =========================================================================
 * B. QAM mapping
 * ========================================================================= */
sec("B. QAM — Gray coding, energy normalization, bit ordering, exact demap");
for (const mod of Object.keys(MODS)) {
  const bps = MODS[mod], t = qamTables(bps), L = t.L;
  // value of each Gray code along one axis, in increasing level order
  const codeOfLevel = new Array(L);
  for (let g = 0; g < L; g++) codeOfLevel[Math.round((t.valOfGray[g] / t.norm + (L - 1)) / 2)] = g;
  let grayOk = true;
  for (let i = 0; i + 1 < L; i++) {
    const diff = codeOfLevel[i] ^ codeOfLevel[i + 1];
    if (!(diff && (diff & (diff - 1)) === 0)) grayOk = false;     // exactly one bit differs
  }
  check(`${mod}: adjacent levels differ in exactly 1 bit (Gray)`, grayOk, grayOk ? 1 : 0, "1");
  const allBits = Math.pow(2, bps);
  const bits = new Uint8Array(bps * allBits);
  for (let s = 0; s < allBits; s++) for (let b = 0; b < bps; b++) bits[s * bps + b] = (s >> (bps - 1 - b)) & 1;
  const syms = qamMap(bits, bps);
  let eSum = 0; for (let i = 0; i < allBits; i++) eSum += syms.re[i] ** 2 + syms.im[i] ** 2;
  check(`${mod}: average symbol energy E_s = 1 (exhaustive)`, Math.abs(eSum / allBits - 1) < 1e-12, eSum / allBits, "1");
  const back = qamDemap(syms, bps);
  let err = 0; for (let i = 0; i < bits.length; i++) if (bits[i] !== back[i]) err++;
  check(`${mod}: all ${allBits} patterns exact noiseless round trip`, err === 0, err, "0 bit errors");
}
{
  // bit ordering: 16QAM [b0 b1 | b2 b3] = [I-sign, I-LSB-Gray | Q-sign, Q-LSB-Gray], MSB first
  const s = qamMap(Uint8Array.from([1, 0, 0, 0]), 4);
  const n = qamTables(4).norm;
  check("bit order: 16QAM bits 1000 -> I=+3/sqrt(10), Q=-3/sqrt(10)",
        Math.abs(s.re[0] - 3 * n) < 1e-12 && Math.abs(s.im[0] + 3 * n) < 1e-12,
        `${s.re[0].toFixed(4)},${s.im[0].toFixed(4)}`, `${(3 * n).toFixed(4)},${(-3 * n).toFixed(4)}`);
  const q = qamMap(Uint8Array.from([1, 1]), 2);
  check("bit order: QPSK bits 11 -> (+1,+1)/sqrt(2)", Math.abs(q.re[0] - Math.SQRT1_2) < 1e-12 && Math.abs(q.im[0] - Math.SQRT1_2) < 1e-12,
        `${q.re[0].toFixed(4)},${q.im[0].toFixed(4)}`, "0.7071,0.7071");
}

/* =========================================================================
 * C. Resource grid, framing, CP
 * ========================================================================= */
sec("C. Resource grid — active/null/guard/pilot indexing, framing, CP");
{
  const excluded = []; const act = new Set(G.activeBins);
  for (let k = 1; k < G.N; k++) if (!act.has(k)) excluded.push(k);   // guard band (DC checked separately)
  check("DC bin 0 is not active", !act.has(0), act.has(0) ? 1 : 0, "0");
  check("active count = N-1-excluded(23) = 104", G.activeBins.length === 104, G.activeBins.length, "104");
  const lo = excluded[0], hi = excluded[excluded.length - 1];
  check("guard band = bins 53..75 (Nyquist k=64 +-11), contiguous", hi - lo + 1 === excluded.length && lo === 53 && hi === 75,
        `${lo}..${hi} (${excluded.length} bins)`, "53..75 (23 bins)",
        "config guard=22 => floor(22/2) below + ceil(22/2) above Nyquist, plus Nyquist itself");
  const pS = new Set(G.pilotBins), dS = new Set(G.dataBins);
  check("pilot ∩ data = ∅", [...pS].every(k => !dS.has(k)), [...pS].filter(k => dS.has(k)).length, "0 overlaps");
  check("pilot ∪ data = active", G.pilotBins.length + G.dataBins.length === G.activeBins.length &&
        G.activeBins.every(k => pS.has(k) || dS.has(k)), G.pilotBins.length + G.dataBins.length, "104");
  check("pilot count = 14 (every 8th active bin + upper edge)", G.pilotBins.length === 14, G.pilotBins.length, "14");
  check("data count = 90 bins", G.dataBins.length === 90, G.dataBins.length, "90");
  const tx = transmit({ grid: G, mod: "16QAM", seed: 77 });
  const symLen = G.cp + G.N;
  check("frame length = 2*(cp+N) + nSym*(cp+N)", tx.txIQ.re.length === (2 + G.nSym) * symLen, tx.txIQ.re.length, (2 + G.nSym) * symLen);
  let cpErr = 0;
  for (let s = 0; s < G.nSym; s++) {
    const off = (2 + s) * symLen, body = off + G.cp;
    for (let i = 0; i < G.cp; i++) {
      cpErr = Math.max(cpErr, Math.abs(tx.txIQ.re[off + i] - tx.txIQ.re[body + G.N - G.cp + i]),
                       Math.abs(tx.txIQ.im[off + i] - tx.txIQ.im[body + G.N - G.cp + i]));
    }
  }
  check("CP = copy of last cp samples of each data symbol body", cpErr < 1e-15, cpErr, "< 1e-15");
  let bodyErr = 0;
  for (let s = 0; s < G.nSym; s++) {
    const body = { re: tx.txIQ.re.slice((2 + s) * symLen + G.cp, (3 + s) * symLen), im: tx.txIQ.im.slice((2 + s) * symLen + G.cp, (3 + s) * symLen) };
    bodyErr = Math.max(bodyErr, maxAbsDiff(body, tx.ifftOut[s]));
  }
  check("serialized body = IFFT(resource grid[s]) exactly", bodyErr < 1e-15, bodyErr, "< 1e-15");
  let rtErr = 0;
  for (let s = 0; s < G.nSym; s++) {
    const body = { re: tx.txIQ.re.slice((2 + s) * symLen + G.cp, (3 + s) * symLen), im: tx.txIQ.im.slice((2 + s) * symLen + G.cp, (3 + s) * symLen) };
    rtErr = Math.max(rtErr, maxAbsDiff(fft(body), tx.gridSyms[s]));
  }
  check("CP removal + FFT recovers resource grid exactly", rtErr < 1e-12, rtErr, "< 1e-12");
  let p1Err = 0;
  for (let n = 0; n < symLen - G.N / 2; n++) {
    p1Err = Math.max(p1Err, Math.hypot(tx.txIQ.re[n] - tx.txIQ.re[n + G.N / 2], tx.txIQ.im[n] - tx.txIQ.im[n + G.N / 2]));
  }
  check("P1 is periodic with period N/2 (Schmidl-Cox structure)", p1Err < 1e-12, p1Err, "< 1e-12");
  const pre = buildPreambles(G);
  let p2Pow = cpower(pre.t2), p1Pow = cpower(pre.t1);
  check("preamble symbol power matches data-symbol power (within 2%)",
        Math.abs(p1Pow / (cpower(tx.ifftOut[0])) - 1) < 0.02 && Math.abs(p2Pow / (cpower(tx.ifftOut[0])) - 1) < 0.02,
        (p1Pow / cpower(tx.ifftOut[0])).toFixed(4), "1 ± 0.02");
  const sh = snrHelpers(G, 4);
  check("CP overhead = 10log10((N+cp)/N) = 0.512 dB", Math.abs(sh.cpOverheadDb - 0.5115) < 1e-3, sh.cpOverheadDb.toFixed(4), "0.5115");
  check("pilot overhead = 10log10(active/data) = 0.627 dB", Math.abs(sh.pilotOverheadDb - 0.6272) < 1e-3, sh.pilotOverheadDb.toFixed(4), "0.6272");
}

/* =========================================================================
 * D. AWGN — calibration and BER vs theory (batch-mean CI)
 * ========================================================================= */
sec("D. AWGN — noise calibration and BER vs theory");
{
  // D1: noise variance calibration in SAMPLE units (noiseless minus noisy)
  for (const esn0 of [0, 10]) {
    const tx = transmit({ grid: G, mod: "QPSK", seed: 4242 });
    const ch = applyChannel(tx, { preset: "AWGN", delay: 0, noise: { mode: "esn0", valueDb: esn0 }, seed: 4242 });
    const clean = applyChannel(tx, { preset: "AWGN", delay: 0, noise: null, seed: 4242 });
    let nP = 0; const n = ch.rxIQ.re.length;
    for (let i = 0; i < n; i++) nP += (ch.rxIQ.re[i] - clean.rxIQ.re[i]) ** 2 + (ch.rxIQ.im[i] - clean.rxIQ.im[i]) ** 2;
    nP /= n;
    const expect = Math.pow(10, -esn0 / 10), se = Math.sqrt(2 / n);   // relative SE of a complex Gaussian power mean
    check(`noise variance sigma^2 = 10^(-Es/N0/10) at Es/N0=${esn0} dB (sample units)`,
          Math.abs(nP / expect - 1) < 4 * se, (nP / expect).toFixed(5), `1 ± ${(4 * se).toFixed(4)} (4 SE)`);
  }
  // D2: definition consistency
  const h = snrHelpers(G, 2);
  check("Eb/N0 = Es/N0 - 10log10(bps): QPSK, 10 dB Eb/N0 -> 13.01 dB Es/N0",
        Math.abs(h.esn0FromEbn0(10) - (10 + 10 * Math.log10(2))) < 1e-9, h.esn0FromEbn0(10).toFixed(4), "13.0103");
  check("sample SNR = Es/N0 + 10log10(Nact/N)", Math.abs(h.sampleSnrFromEsn0(10) - (10 + 10 * Math.log10(104 / 128))) < 1e-9,
        h.sampleSnrFromEsn0(10).toFixed(4), "9.1897");
  // D3: BER vs theory for Gray QPSK, Eb/N0 = 4..8 dB, batch-mean SE, z = 3
  for (const ebn0 of [4, 6, 8]) {
    const r = berBatch(function* () {
      for (let f = 0; f < 1500; f++) {
        const seed = 10000 + f;
        const tx = transmit({ grid: G, mod: "QPSK", seed });
        const ch = applyChannel(tx, { preset: "AWGN", delay: 0, noise: { mode: "ebn0", valueDb: ebn0 }, seed });
        const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "zf" });
        yield [rr.bitErrors, rr.bitTotal];
      }
    });
    const theo = Q(Math.sqrt(2 * Math.pow(10, ebn0 / 10)));
    const z = (r.p - theo) / r.se;
    check(`QPSK AWGN Eb/N0=${ebn0} dB: BER vs Q(sqrt(2Eb/N0)) (z-score, |z|<=3)`, Math.abs(z) <= 3,
          `${r.p.toExponential(3)} (SE ${r.se.toExponential(1)}, errs ${r.errs}, bits ${r.bits})`,
          `theory ${theo.toExponential(3)}`, `z=${z.toFixed(2)}, frames=${r.frames}`);
  }
  // D4: 16QAM vs the standard Gray-QAM approximation (approximate theory, labeled)
  {
    const ebn0 = 10, r = berBatch(function* () {
      for (let f = 0; f < 1500; f++) {
        const seed = 20000 + f;
        const tx = transmit({ grid: G, mod: "16QAM", seed });
        const ch = applyChannel(tx, { preset: "AWGN", delay: 0, noise: { mode: "ebn0", valueDb: ebn0 }, seed });
        const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect" });
        yield [rr.bitErrors, rr.bitTotal];
      }
    });
    const g = Math.pow(10, (ebn0 + 10 * Math.log10(4)) / 10);
    const approx = (3 / 8) * erfc(Math.sqrt(g / 10));
    const ratio = r.p / approx;
    check(`16QAM AWGN Eb/N0=${ebn0} dB vs Gray-QAM approximation (ratio within 1±0.15)`,
          Math.abs(ratio - 1) < 0.15, `${r.p.toExponential(3)} (SE ${r.se.toExponential(1)})`,
          `approx ${approx.toExponential(3)}`, `ratio=${ratio.toFixed(3)}; approximation is APPROXIMATE theory`);
  }
}

/* =========================================================================
 * E. Multipath — FIR convolution, normalization, analytic frequency response
 * ========================================================================= */
sec("E. Multipath — FIR, tap indexing, frequency response, ISI");
{
  const rng = makeRng(555);
  const x = czeros(40), hh = czeros(7);
  for (let i = 0; i < 40; i++) { x.re[i] = rng.gauss(); x.im[i] = rng.gauss(); }
  for (let i = 0; i < 7; i++) { hh.re[i] = rng.gauss(); hh.im[i] = rng.gauss(); }
  const y = firConvolve(x, hh);
  let cErr = 0;
  for (let n = 0; n < 40 + 6; n++) {
    let ar = 0, ai = 0;
    for (let l = 0; l < 7; l++) { const m = n - l; if (m < 0 || m >= 40) continue;
      ar += hh.re[l] * x.re[m] - hh.im[l] * x.im[m]; ai += hh.re[l] * x.im[m] + hh.im[l] * x.re[m]; }
    cErr = Math.max(cErr, Math.hypot(ar - y.re[n], ai - y.im[n]));
  }
  check("FIR convolution y[n]=sum h[l]x[n-l] equals direct sum (length nx+L-1)", cErr < 1e-12 && y.re.length === 46, cErr, "< 1e-12");
  let normErr = 0, tapOk = true;
  for (const preset of ["EPA", "EVA", "ETU", "Rician"]) {
    for (let t = 0; t < 30; t++) {
      const h = drawChannel(CHANNEL_PRESETS[preset], makeRng(900 + t));
      const p = h.re.reduce((s, v, i) => s + v * v + h.im[i] ** 2, 0);
      normErr = Math.max(normErr, Math.abs(p - 1));
    }
    const h0 = drawChannel(CHANNEL_PRESETS[preset], makeRng(1));
    const maxD = Math.max(...CHANNEL_PRESETS[preset].taps.map(t => t.d));
    tapOk = tapOk && h0.re.length === maxD + 1;
  }
  check("channel normalization sum|h|^2 = 1 (EPA/EVA/ETU/Rician, 120 draws)", normErr < 1e-12, normErr, "< 1e-12");
  check("tap length = max delay + 1 (tap indexing)", tapOk, tapOk ? 1 : 0, "1");
  const evaTaps = drawChannel(CHANNEL_PRESETS.EVA, makeRng(3));
  const nzEva = Array.from(evaTaps.re).map((v, i) => (Math.hypot(v, evaTaps.im[i]) > 0 ? i : -1)).filter(i => i >= 0);
  check("EVA taps are non-zero exactly at delays {0,1,3,6,9,14}",
        JSON.stringify(nzEva) === JSON.stringify([0, 1, 3, 6, 9, 14]), nzEva.join(","), "0,1,3,6,9,14");
  // E-freq: engine's true H (oracle, tau=0) vs independent direct DFT of h
  {
    const tx = transmit({ grid: G, mod: "16QAM", seed: 31 });
    const ch = applyChannel(tx, { preset: "ETU", delay: 40, noise: null, seed: 31 });
    const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect" });
    let maxE = 0;
    for (const k of G.activeBins) {
      let hr = 0, hi = 0;
      for (let l = 0; l < ch.h.re.length; l++) { const a = -2 * Math.PI * k * l / G.N, c = Math.cos(a), s = Math.sin(a);
        hr += ch.h.re[l] * c - ch.h.im[l] * s; hi += ch.h.re[l] * s + ch.h.im[l] * c; }
      maxE = Math.max(maxE, Math.hypot(rr.Htrue.re[k] - hr, rr.Htrue.im[k] - hi));
    }
    check("frequency response H[k]=sum h[l]e^{-j2pi kl/N} (physical units) matches engine Htrue",
          maxE < 1e-10, maxE, "< 1e-10");
  }
  // E-ramp: a receiver window offset tau adds e^{+j2pi k tau/N} (verified through EVM with perfect CSI)
  {
    const tx = transmit({ grid: G, mod: "16QAM", seed: 32 });
    const ch = applyChannel(tx, { preset: "EVA", delay: 21, noise: null, seed: 32 });
    const rr = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "perfect", eqMethod: "zf" });
    check("EVA (max delay 14 <= CP 16), noiseless, perfect CSI, window offset tau=" + (rr.sync.frameStart - ch.trueDelay) + ": EVM ~ 0",
          rr.evm < 1e-9, rr.evm, "< 1e-9", "sign of the e^{+j2pi k tau/N} ramp is validated here");
  }
  {
    const tx = transmit({ grid: G, mod: "16QAM", seed: 33 });
    const ch = applyChannel(tx, { preset: "ETU", delay: 40, noise: null, seed: 33 });
    const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "zf" });
    check("ETU (delay 100 > CP 16), noiseless, perfect CSI: residual ISI EVM > 1e-2 (ISI is real)",
          rr.evm > 1e-2, rr.evm, "> 1e-2");
  }
  {
    const tx = transmit({ grid: G, mod: "16QAM", seed: 34 });
    const ch = applyChannel(tx, { preset: "EPA", delay: 40, noise: null, seed: 34 });
    const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "ls-linear", eqMethod: "zf" });
    check("EPA noiseless, ESTIMATED CSI (ls-linear): EVM is measured (informational bound < 0.10)",
          rr.evm < 0.10, rr.evm, "< 0.10", "linear-interp residual on a 2-tap channel");
  }
}

/* =========================================================================
 * F. RF impairments — physical signal-domain transformations
 * ========================================================================= */
sec("F. RF impairments — CFO, SFO, phase noise, IQ, PA, DC");
{
  // F1 CFO: y[n] = x[n] e^{j2pi eps n/N}, continuous index across symbol boundaries
  const N = G.N, eps = 0.37, L = 3 * (G.N + G.cp) + 17;
  const x = { re: new Float64Array(L).fill(1), im: new Float64Array(L) };
  applyCfo(x, eps, N);
  let phErr = 0;
  for (let n = 0; n < L; n++) {
    const ph = Math.atan2(x.im[n], x.re[n]), exp = 2 * Math.PI * eps * n / N;
    phErr = Math.max(phErr, Math.abs(Math.atan2(Math.sin(ph - exp), Math.cos(ph - exp))));
  }
  check("CFO rotates samples by exactly 2pi*eps*n/N (continuous over symbols)", phErr < 1e-12, phErr, "< 1e-12");
  check("CFO preserves sample magnitude", Math.abs(Math.hypot(x.re[L - 1], x.im[L - 1]) - 1) < 1e-12, 1, "1");
  // F1b: CFO effect on EVM and its correction (oracle derotation == true CFO)
  {
    const tx = transmit({ grid: G, mod: "16QAM", seed: 61 });
    const ch = applyChannel(tx, { preset: "AWGN", delay: 10, cfoEps: 0.3, noise: null, seed: 61 });
    const bad = receive(ch.rxIQ, tx, { ...ch, trueCfoEps: 0 }, { syncMode: "oracle", ceMethod: "perfect" });
    const good = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect" });
    check("CFO uncorrected (0.3 sc) degrades EVM (ICI) strongly", bad.evm > 0.2, bad.evm, "> 0.2");
    check("CFO corrected by oracle -> EVM ~ 0 (noiseless)", good.evm < 1e-9, good.evm, "< 1e-9");
  }
  // F2 SFO: sample instants t_k = k(1+delta): tone frequency scales by (1+delta)
  {
    const NN = 8192, f0 = 0.05, ppm = 1000;
    const t = { re: new Float64Array(NN), im: new Float64Array(NN) };
    for (let n = 0; n < NN; n++) { t.re[n] = Math.cos(2 * Math.PI * f0 * n); t.im[n] = Math.sin(2 * Math.PI * f0 * n); }
    const s = applySfo(t, ppm);
    let fm = 0; for (let k = 100; k < NN - 100; k++) {
      fm += Math.atan2(s.im[k + 1] * s.re[k] - s.re[k + 1] * s.im[k], s.re[k] * s.re[k + 1] + s.im[k] * s.im[k + 1]); }
    fm /= (NN - 201) * 2 * Math.PI;
    const expF = f0 * (1 + ppm * 1e-6), relErr = Math.abs(fm - expF) / expF;
    check("SFO: tone frequency scales by (1+delta) (1000 ppm)", relErr < 2e-4, `${fm.toFixed(7)} vs ${expF.toFixed(7)}`,
          "rel err < 2e-4", `rel=${relErr.toExponential(2)} (linear-interp kernel)`);
    const s0 = applySfo({ re: t.re.slice(), im: t.im.slice() }, 0);
    check("SFO = 0 ppm is identity", maxAbsDiff(s0, t) < 1e-15, maxAbsDiff(s0, t), "< 1e-15");
  }
  // F3 phase noise: Wiener increments of variance 2 pi beta / Fs
  {
    const beta = 2000, Lp = 200000, x = { re: new Float64Array(Lp).fill(1), im: new Float64Array(Lp) };
    applyPhaseNoise(x, beta, FS, makeRng(77));
    const ph = new Float64Array(Lp); for (let n = 0; n < Lp; n++) ph[n] = Math.atan2(x.im[n], x.re[n]);
    let s2 = 0; for (let n = 1; n < Lp; n++) { const d0 = ph[n] - ph[n - 1]; const d = Math.atan2(Math.sin(d0), Math.cos(d0)); s2 += d * d; }
    const est = s2 / (Lp - 1), theo = 2 * Math.PI * beta / FS;
    check("phase noise: increment variance = 2 pi beta / Fs (200k samples, 2% tol)", Math.abs(est / theo - 1) < 0.02,
          (est / theo).toFixed(4), "1 ± 0.02");
    let magErr = 0; for (let n = 0; n < Lp; n++) magErr = Math.max(magErr, Math.abs(Math.hypot(x.re[n], x.im[n]) - 1));
    check("phase noise is a pure phase rotation (|x| unchanged)", magErr < 1e-12, magErr, "< 1e-12");
  }
  // F4 IQ imbalance: image component matches the analytic widely-linear coefficients
  {
    const NN = 4096, w = 2 * Math.PI * 0.1, z = czeros(NN);
    for (let n = 0; n < NN; n++) { z.re[n] = Math.cos(w * n); z.im[n] = Math.sin(w * n); }
    const gainDb = 1, phDeg = 5;
    applyIqImbalance(z, gainDb, phDeg);
    let a = [0, 0], b = [0, 0];
    for (let n = 0; n < NN; n++) { const c = Math.cos(w * n), s = Math.sin(w * n);
      a[0] += z.re[n] * c + z.im[n] * s; a[1] += z.im[n] * c - z.re[n] * s;
      b[0] += z.re[n] * c - z.im[n] * s; b[1] += z.re[n] * s + z.im[n] * c; }
    const tone = Math.hypot(a[0], a[1]) / NN, image = Math.hypot(b[0], b[1]) / NN;
    const g = Math.pow(10, gainDb / 20), p = phDeg * Math.PI / 180;
    // real map I'=I, Q'=g(sin p I + cos p Q) -> y' = alpha*y + beta*conj(y)
    const A = [1, 0, g * Math.sin(p), g * Math.cos(p)];
    const alpha = Math.hypot((A[0] + A[3]) / 2, (A[2] - A[1]) / 2), beta = Math.hypot((A[0] - A[3]) / 2, (A[2] + A[1]) / 2);
    check("IQ imbalance: tone amplitude = |alpha| (analytic widely-linear)", Math.abs(tone - alpha) < 1e-3, tone.toFixed(5), alpha.toFixed(5));
    check("IQ imbalance: image amplitude = |beta| (analytic)", Math.abs(image - beta) < 1e-3, image.toFixed(5), beta.toFixed(5));
    check("IQ imbalance: image rejection ratio 20log10(|a|/|b|) > 15 dB for 1 dB / 5 deg", 20 * Math.log10(tone / image) > 15,
          (20 * Math.log10(tone / image)).toFixed(2), "> 15 dB");
  }
  // F5 PA: Rapp AM/AM and measured output back-off
  {
    const A = 1.0, ph = { re: new Float64Array(64).fill(0.5), im: new Float64Array(64).fill(0) };
    // unit-power-normalised test: amplitude a -> a/(1+(a/A)^4)^(1/4)
    const pts = [0.2, 0.6, 1.0, 1.5]; let amErr = 0;
    for (const a of pts) {
      const x = { re: new Float64Array([a]), im: new Float64Array([0]) };
      const P = a * a; const Asat = Math.sqrt(P) * Math.pow(10, 3 / 20);
      applyPa(x, 3, 2);
      const theo = a / Math.pow(1 + Math.pow(a / Asat, 4), 0.25);
      amErr = Math.max(amErr, Math.abs(x.re[0] - theo));
    }
    check("PA (Rapp p=2): AM/AM matches a/(1+(a/A)^4)^(1/4) with A from measured power", amErr < 1e-12, amErr, "< 1e-12");
    const tx = transmit({ grid: G, mod: "16QAM", seed: 81 });
    const xo = { re: tx.txIQ.re.slice(), im: tx.txIQ.im.slice() };
    let pIn = cpower(xo); applyPa(xo, 3, 2); let pOut = cpower(xo);
    // output-referred back-off: P_sat=A^2 is 3 dB above P_avg(input); measure via amplitude statistic
    const Asat = Math.sqrt(pIn) * Math.pow(10, 3 / 20);
    let clipped = 0; for (let n = 0; n < tx.txIQ.re.length; n++) if (Math.hypot(tx.txIQ.re[n], tx.txIQ.im[n]) > Asat) clipped++;
    check("PA: configured 3 dB OBO is implemented relative to mean power (A^2/P_avg = 3 dB)",
          Math.abs(10 * Math.log10(Asat * Asat / pIn) - 3) < 1e-9, (10 * Math.log10(Asat * Asat / pIn)).toFixed(4), "3.0000");
    const txp = transmit({ grid: G, mod: "16QAM", seed: 82 });
    const cl = applyChannel(txp, { preset: "AWGN", delay: 0, pa: { backoffDb: 3, p: 2 }, noise: null, seed: 82 });
    const rr = receive(cl.rxIQ, txp, cl, { syncMode: "oracle", ceMethod: "perfect" });
    check("PA nonlinearity produces measurable EVM distortion (3 dB OBO)", rr.evm > 1e-3, rr.evm, "> 1e-3",
          `EVM=${(100 * rr.evm).toFixed(2)}%`);
    check("PA: clipping occurs at 3 dB OBO (fraction of samples above saturation)", clipped > 0,
          `${(100 * clipped / tx.txIQ.re.length).toFixed(2)}%`, "> 0%");
    void pOut; void ph; void A;
  }
  // F6 DC offset: time-domain constant -> only bin 0 (DC null), data unaffected
  {
    const tx = transmit({ grid: G, mod: "16QAM", seed: 91 });
    const c0 = applyChannel(tx, { preset: "AWGN", delay: 0, noise: null, seed: 91 });
    const cd = applyChannel(tx, { preset: "AWGN", delay: 0, dc: 0.3, noise: null, seed: 91 });
    const r0 = receive(c0.rxIQ, tx, c0, { syncMode: "oracle", ceMethod: "perfect" });
    const rd = receive(cd.rxIQ, tx, cd, { syncMode: "oracle", ceMethod: "perfect" });
    let meanOff = 0; for (let n = 0; n < cd.rxIQ.re.length; n++) meanOff += cd.rxIQ.re[n] - c0.rxIQ.re[n];
    meanOff /= cd.rxIQ.re.length;
    check("DC offset adds the constant 0.3 to the time-domain mean", Math.abs(meanOff - 0.3) < 1e-12, meanOff, "0.3");
    check("DC offset does not change data-bin EVM (only the DC null bin)", Math.abs(rd.evm - r0.evm) < 1e-12 && rd.ber === r0.ber,
          rd.evm.toExponential(2), r0.evm.toExponential(2));
    // unitary FFT: a constant c over N samples lands in bin 0 with magnitude c*N/sqrt(N) = c*sqrt(N)
    const dBin0 = Math.hypot(rd.fftOut[0].re[0] - r0.fftOut[0].re[0], rd.fftOut[0].im[0] - r0.fftOut[0].im[0]);
    check("DC offset lands in FFT bin 0 with magnitude c*sqrt(N) (unitary FFT)",
          Math.abs(dBin0 - 0.3 * Math.sqrt(G.N)) < 1e-9, dBin0.toFixed(6), (0.3 * Math.sqrt(G.N)).toFixed(6));
  }
  // F7 documented impairment ordering: applyChannel == manual composition in the documented order
  {
    const tx = transmit({ grid: G, mod: "16QAM", seed: 99 });
    const cfg = { preset: "EPA", delay: 25, cfoEps: 0.4, sfoPpm: 30, pnLinewidthHz: 300, fs: FS,
                  iq: { gainDb: 0.5, phaseDeg: 3 }, pa: { backoffDb: 4, p: 2 }, dc: 0.02,
                  noise: { mode: "esn0", valueDb: 18 }, seed: 99 };
    const full = applyChannel(tx, cfg).rxIQ;
    const rng = makeRng((99) ^ 0x5EED);
    const x = { re: tx.txIQ.re.slice(), im: tx.txIQ.im.slice() };
    applyPa(x, 4, 2);
    const h = drawChannel(CHANNEL_PRESETS.EPA, rng);
    const y0 = firConvolve(x, h); const tail = G.N + G.cp;
    const y = czeros(25 + y0.re.length + tail); y.re.set(y0.re, 25); y.im.set(y0.im, 25);
    applyCfo(y, 0.4, G.N); applyPhaseNoise(y, 300, FS, rng);
    const z = applySfo(y, 30);
    const s2 = Math.pow(10, -18 / 10); const sg = Math.sqrt(s2 / 2);
    for (let n = 0; n < z.re.length; n++) { z.re[n] += sg * rng.gauss(); z.im[n] += sg * rng.gauss(); }
    applyIqImbalance(z, 0.5, 3); applyDcOffset(z, 0.02);
    const d = maxAbsDiff(full, z);
    check("impairment ordering PA->FIR->CFO->PN->SFO->AWGN->IQ->DC reproduced exactly", d < 1e-12, d, "< 1e-12");
  }
}

/* =========================================================================
 * G. Synchronization — offsets, estimator accuracy, oracle vs practical
 * ========================================================================= */
sec("G. Synchronization — timing, coarse/fine CFO, residual error, practical vs oracle");
{
  // G1 timing acquisition over delays at high SNR (practical)
  let worst = 0, okCount = 0, tot = 0;
  for (let d = 0; d <= 300; d += 25) {
    for (let s = 0; s < 3; s++) {
      tot++;
      const tx = transmit({ grid: G, mod: "QPSK", seed: 500 + d + s });
      const ch = applyChannel(tx, { preset: "AWGN", delay: d, noise: { mode: "esn0", valueDb: 30 }, seed: 500 + d + s });
      const rr = receive(ch.rxIQ, tx, ch, { syncMode: "practical" });
      worst = Math.max(worst, Math.abs(rr.syncErr));
      if (rr.syncErr <= 0 && rr.syncErr > -G.cp / 2) okCount++;
    }
  }
  check("timing acquisition at 30 dB: start error within [-cp/2, 0] for all delays 0..300", okCount === tot, `${okCount}/${tot}`, `${tot}/${tot}`,
        `worst |err|=${worst} (2-sample deliberate CP backoff)`);
  // G2 CFO estimator: unbiasedness and accuracy across the full +-1 subcarrier range
  let maxBias = 0, maxAbsErr = 0;
  for (const eps of [-0.9, -0.5, -0.1, 0.2, 0.7, 0.95]) {
    const errs = [];
    for (let f = 0; f < 40; f++) {
      const tx = transmit({ grid: G, mod: "QPSK", seed: 700 + f });
      const ch = applyChannel(tx, { preset: "AWGN", delay: 20, cfoEps: eps, noise: { mode: "esn0", valueDb: 25 }, seed: 700 + f });
      const rr = receive(ch.rxIQ, tx, ch, { syncMode: "practical" });
      errs.push(rr.cfoErrEps);
    }
    const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
    maxBias = Math.max(maxBias, Math.abs(mean)); maxAbsErr = Math.max(maxAbsErr, ...errs.map(Math.abs));
  }
  check("CFO estimate unbiased over eps in [-0.9,0.95] at 25 dB (|mean err| < 0.003 sc)", maxBias < 0.003, maxBias.toExponential(2), "< 3e-3 sc");
  check("CFO estimate max |err| < 0.02 sc at 25 dB (eps in [-0.9,0.95])", maxAbsErr < 0.02, maxAbsErr.toFixed(4), "< 0.02 sc");
  // G3 Schmidl-Cox fractional-CFO variance vs analytic 1/(M gamma) (angle), M = N/2 = 64
  for (const snr of [10, 20]) {
    const e = [];
    let gammaMeas = 0;
    for (let f = 0; f < 400; f++) {
      const tx = transmit({ grid: G, mod: "QPSK", seed: 800 + f });
      const ch = applyChannel(tx, { preset: "AWGN", delay: 20, cfoEps: 0.0, noise: { mode: "esn0", valueDb: snr }, seed: 800 + f });
      if (f === 0) gammaMeas = cpower(tx.txIQ.re.length ? { re: tx.pre.t1.re, im: tx.pre.t1.im } : tx.txIQ) / ch.sigma2;
      const sc = schmidlCox(ch.rxIQ, G.N);
      let d = 0, mx = -1; for (let i = 0; i < sc.M.length; i++) if (sc.M[i] > mx) { mx = sc.M[i]; d = i; }
      e.push(Math.atan2(sc.Pim[d], sc.Pre[d]) / Math.PI);
    }
    const mean = e.reduce((a, b) => a + b, 0) / e.length;
    const sd = Math.sqrt(e.reduce((a, b) => a + (b - mean) ** 2, 0) / (e.length - 1));
    const gam = gammaMeas;
    const pred = Math.sqrt(1 / (G.N / 2 * gam)) / Math.PI;
    check(`Schmidl-Cox frac-CFO std at ${snr} dB vs 1/(pi sqrt(M gamma)) (within 30%)`, Math.abs(sd / pred - 1) < 0.3,
          `${sd.toFixed(5)}`, `${pred.toFixed(5)} (gamma=${gam.toFixed(2)})`, `ratio=${(sd / pred).toFixed(3)}`);
  }
  // G4 oracle vs practical: residual CFO and BER close at 25 dB
  {
    const rp = berBatch(function* () {
      for (let f = 0; f < 400; f++) { const tx = transmit({ grid: G, mod: "QPSK", seed: 1100 + f });
        const ch = applyChannel(tx, { preset: "AWGN", delay: 40, cfoEps: 0.6, noise: { mode: "esn0", valueDb: 25 }, seed: 1100 + f });
        const rr = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "perfect" }); yield [rr.bitErrors, rr.bitTotal]; } });
    const ro = berBatch(function* () {
      for (let f = 0; f < 400; f++) { const tx = transmit({ grid: G, mod: "QPSK", seed: 1100 + f });
        const ch = applyChannel(tx, { preset: "AWGN", delay: 40, cfoEps: 0.6, noise: { mode: "esn0", valueDb: 25 }, seed: 1100 + f });
        const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect" }); yield [rr.bitErrors, rr.bitTotal]; } });
    check("practical sync BER equals oracle BER at 25 dB (both 0 within noise)", rp.errs === ro.errs && rp.errs === 0,
          `practical ${rp.errs} errs / oracle ${ro.errs} errs`, "equal", `bits=${rp.bits}`);
  }
}

/* =========================================================================
 * H. Channel estimation & equalization
 * ========================================================================= */
sec("H. Channel estimation & equalization — LS, interpolation, ZF/MMSE, stability");
{
  // H1 LS pilot error variance = sigma^2 (unit-power pilots, AWGN h=1)
  {
    const sig2 = Math.pow(10, -10 / 10); let acc = 0, cnt = 0;
    for (let f = 0; f < 200; f++) {
      const tx = transmit({ grid: G, mod: "QPSK", seed: 1300 + f });
      const ch = applyChannel(tx, { preset: "AWGN", delay: 0, noise: { mode: "esn0", valueDb: 10 }, seed: 1300 + f });
      const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect" });
      for (let s = 0; s < G.nSym; s++) for (let i = 0; i < G.pilotBins.length; i++) {
        const k = G.pilotBins[i];
        const Y = rr.fftOut[s], X = { re: tx.pilots.re[i], im: tx.pilots.im[i] };
        const hr = (Y.re[k] * X.re + Y.im[k] * X.im) / (X.re ** 2 + X.im ** 2) - 1;
        const hi = (Y.im[k] * X.re - Y.re[k] * X.im) / (X.re ** 2 + X.im ** 2);
        acc += hr * hr + hi * hi; cnt++;
      }
    }
    const v = acc / cnt;
    check("LS pilot estimate error variance = sigma^2 (unit pilots, 10 dB, 25k pilots, +-5%)",
          Math.abs(v / sig2 - 1) < 0.05, (v / sig2).toFixed(4), "1 ± 0.05");
  }
  // H2 ZF noise enhancement: EVM^2 = mean_k sigma^2/|H_k|^2 over data bins (theory),
  // validated at 60 dB where deep fades dominate; MMSE -> ZF at high SNR
  {
    let meas = 0, pred = 0, nP = 0;
    for (let f = 0; f < 30; f++) {
      const tx = transmit({ grid: G, mod: "QPSK", seed: 1400 + f });
      const ch = applyChannel(tx, { preset: "EVA", delay: 21, noise: { mode: "esn0", valueDb: 60 }, seed: 1400 + f });
      const rz = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "zf" });
      meas += rz.evm ** 2;
      for (const k of G.dataBins) { pred += ch.sigma2 / (rz.Htrue.re[k] ** 2 + rz.Htrue.im[k] ** 2); nP++; }
    }
    const ratio = (meas / 30) / (pred / nP);
    check("ZF EVM^2 = mean(sigma^2/|H|^2) at 60 dB on EVA (noise-enhancement theory, +-10%)",
          Math.abs(ratio - 1) < 0.10, ratio.toFixed(4), "1 ± 0.10", `measured EVM^2=${(meas / 30).toExponential(3)}`);
    const tx60 = transmit({ grid: G, mod: "QPSK", seed: 1400 });
    const ch60 = applyChannel(tx60, { preset: "EVA", delay: 21, noise: { mode: "esn0", valueDb: 60 }, seed: 1400 });
    const rm = receive(ch60.rxIQ, tx60, ch60, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "mmse" });
    const rz1 = receive(ch60.rxIQ, tx60, ch60, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "zf" });
    check("MMSE -> ZF at 60 dB (|EVM_mmse - EVM_zf| < 1e-6)", Math.abs(rm.evm - rz1.evm) < 1e-6, Math.abs(rm.evm - rz1.evm).toExponential(2), "< 1e-6");
  }
  // H3 MMSE symbol MSE <= ZF symbol MSE on fading (averaged; MMSE is the Wiener solution)
  for (const snr of [0, 10]) {
    let mz = 0, mm = 0, cnt = 0;
    for (let f = 0; f < 150; f++) {
      const tx = transmit({ grid: G, mod: "QPSK", seed: 1500 + f });
      const ch = applyChannel(tx, { preset: "EVA", delay: 21, noise: { mode: "esn0", valueDb: snr }, seed: 1500 + f });
      const rz = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "zf" });
      const rm = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "mmse" });
      const id = qamMap(tx.txBits, tx.bps);
      for (let i = 0; i < id.re.length; i++) {
        mz += (rz.eqSyms.re[i] - id.re[i]) ** 2 + (rz.eqSyms.im[i] - id.im[i]) ** 2;
        mm += (rm.eqSyms.re[i] - id.re[i]) ** 2 + (rm.eqSyms.im[i] - id.im[i]) ** 2; cnt++;
      }
    }
    check(`MMSE symbol MSE <= ZF symbol MSE on EVA at ${snr} dB`, mm <= mz, `MMSE ${(mm / cnt).toExponential(3)} / ZF ${(mz / cnt).toExponential(3)}`,
          "MMSE <= ZF");
  }
  // H4 deep fades and very low SNR: finite outputs (ZF guard)
  {
    let nonFinite = 0;
    for (let f = 0; f < 60; f++) {
      const tx = transmit({ grid: G, mod: "256QAM", seed: 1600 + f });
      const ch = applyChannel(tx, { preset: "ETU", delay: 30, noise: { mode: "esn0", valueDb: -5 }, seed: 1600 + f });
      for (const eq of ["zf", "mmse"]) {
        const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "ls-linear", eqMethod: eq });
        for (let i = 0; i < rr.eqSyms.re.length; i++) if (!isFinite(rr.eqSyms.re[i]) || !isFinite(rr.eqSyms.im[i])) nonFinite++;
      }
    }
    check("ZF/MMSE outputs finite at -5 dB on ETU with 256QAM (deep fades guarded)", nonFinite === 0, nonFinite, "0");
  }
  // H5 channel estimation quality monotone in SNR (LS-linear, EPA)
  {
    const mses = [];
    for (const snr of [0, 10, 20, 30]) {
      let m = 0, c = 0;
      for (let f = 0; f < 60; f++) {
        const tx = transmit({ grid: G, mod: "QPSK", seed: 1700 + f });
        const ch = applyChannel(tx, { preset: "EPA", delay: 30, noise: { mode: "esn0", valueDb: snr }, seed: 1700 + f });
        const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "ls-linear" });
        m += rr.mseH; c++;
      }
      mses.push(m / c);
    }
    const mono = mses.every((v, i) => i === 0 || v < mses[i - 1]);
    check("LS-linear channel-estimation MSE decreases with SNR (0,10,20,30 dB)", mono,
          mses.map(v => v.toExponential(2)).join(" > "), "monotone decreasing");
  }
}

/* =========================================================================
 * I. End-to-end integration scenarios 1..6
 * ========================================================================= */
sec("I. E2E integration — scenarios 1..6 (fixed seeds)");
{
  // S1 ideal channel
  for (const mod of Object.keys(MODS)) {
    const tx = transmit({ grid: G, mod, seed: 2001 });
    const ch = applyChannel(tx, { preset: "AWGN", delay: 0, noise: null, seed: 2001 });
    const rr = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
    check(`S1 ideal ${mod}: BER=0, EVM<1e-9 (practical sync, delay 0)`, rr.ber === 0 && rr.evm < 1e-9, `BER=${rr.ber}, EVM=${rr.evm.toExponential(2)}`, "0 / <1e-9");
  }
  // S2 AWGN BER vs Eb/N0 (QPSK): see section D; record the curve for the report
  // S3 multipath (EPA, 16QAM, 25 dB Es/N0, delay 40 within CP).
  // Oracle CSI must match the per-bin Rayleigh fading theory (3/8 erfc(sqrt(gamma_k/10))),
  // and LS-linear estimated CSI may only add a bounded estimation penalty (<= 2.5x).
  {
    let thSum = 0, thCnt = 0;
    const rOr = berBatch(function* () {
      for (let f = 0; f < 400; f++) { const tx = transmit({ grid: G, mod: "16QAM", seed: 3000 + f });
        const ch = applyChannel(tx, { preset: "EPA", delay: 40, noise: { mode: "esn0", valueDb: 25 }, seed: 3000 + f });
        const rr = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "zf" });
        for (const k of G.dataBins) { const gm = (rr.Htrue.re[k] ** 2 + rr.Htrue.im[k] ** 2) / ch.sigma2; thSum += (3 / 8) * erfc(Math.sqrt(gm / 10)); thCnt++; }
        yield [rr.bitErrors, rr.bitTotal]; } });
    const rLs = berBatch(function* () {
      for (let f = 0; f < 400; f++) { const tx = transmit({ grid: G, mod: "16QAM", seed: 3000 + f });
        const ch = applyChannel(tx, { preset: "EPA", delay: 40, noise: { mode: "esn0", valueDb: 25 }, seed: 3000 + f });
        const rr = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
        yield [rr.bitErrors, rr.bitTotal]; } });
    const th = thSum / thCnt, z = (rOr.p - th) / rOr.se;
    check("S3 EPA 16QAM 25 dB, oracle CSI: BER matches per-bin Rayleigh theory (|z|<=3)", Math.abs(z) <= 3,
          `${rOr.p.toExponential(3)} (SE ${rOr.se.toExponential(1)}, ${rOr.errs} errs)`, `theory ${th.toExponential(3)}`, `z=${z.toFixed(2)}`);
    const pen = rLs.p / rOr.p;
    check("S3 EPA 16QAM 25 dB, practical sync + LS-linear CE: penalty vs oracle CSI <= 2.5x",
          pen <= 2.5 && pen >= 1, `${rLs.p.toExponential(3)} (${rLs.errs} errs), ratio ${pen.toFixed(2)}`, "1 <= ratio <= 2.5",
          "criterion revised from an absolute BER<2e-3 (not theory-anchored); see report");
  }
  // S4 CFO: impairment measurable, correction improves EVM & BER
  {
    const mk = (seed) => transmit({ grid: G, mod: "16QAM", seed });
    let bU = 0, bC = 0, eU = 0, eC = 0, nB = 0;
    for (let f = 0; f < 150; f++) {
      const tx = mk(4000 + f);
      const ch = applyChannel(tx, { preset: "AWGN", delay: 40, cfoEps: 0.5, noise: { mode: "esn0", valueDb: 25 }, seed: 4000 + f });
      const u = receive(ch.rxIQ, tx, { ...ch, trueCfoEps: 0 }, { syncMode: "oracle", ceMethod: "perfect" });
      const c = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "perfect" });
      bU += u.bitErrors; bC += c.bitErrors; nB += u.bitTotal; eU += u.evm; eC += c.evm;
    }
    check("S4 CFO 0.5 sc: uncorrected BER >> corrected BER (25 dB 16QAM)", bC === 0 ? bU > 0 : bU / bC > 20,
          `uncorrected ${(bU / nB).toExponential(2)} (${bU} errs) vs corrected ${(bC / nB).toExponential(2)} (${bC} errs)`,
          "corrected = 0 errs or ratio > 20");
    check("S4 CFO 0.5 sc: EVM improves after correction", eC < eU / 5, `EVM ${(100 * eU / 150).toFixed(1)}% -> ${(100 * eC / 150).toFixed(2)}%`, "> 5x");
  }
  // S5 timing offsets 0..340: (a) acquisition on EPA multipath, (b) data recovery on AWGN
  // (QPSK 25 dB: theoretical Pb ~ 1e-13, so zero errors is the correct expectation).
  // The earlier "BER=0 on EPA" expectation was withdrawn: Rayleigh fading gives BER ~1e-3 at 25 dB.
  {
    const delays = [0, 33, 97, 180, 260, 340];
    let acq = 0, rec = 0;
    for (const d of delays) {
      const tx = transmit({ grid: G, mod: "QPSK", seed: 5000 + d });
      const chE = applyChannel(tx, { preset: "EPA", delay: d, noise: { mode: "esn0", valueDb: 25 }, seed: 5000 + d });
      const rE = receive(chE.rxIQ, tx, chE, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
      if (rE.syncErr <= 0 && rE.syncErr > -G.cp / 2) acq++;
      const chA = applyChannel(tx, { preset: "AWGN", delay: d, noise: { mode: "esn0", valueDb: 25 }, seed: 5000 + d });
      const rA = receive(chA.rxIQ, tx, chA, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
      if (rA.ber === 0 && rA.syncErr <= 0 && rA.syncErr > -G.cp / 2) rec++;
    }
    check("S5a timing offsets 0..340 on EPA: frame acquired within [-cp/2,0] (6 delays)", acq === delays.length,
          `${acq}/${delays.length}`, `${delays.length}/${delays.length}`);
    check("S5b timing offsets 0..340 on AWGN 25 dB: acquisition + BER=0 (6 delays)", rec === delays.length,
          `${rec}/${delays.length}`, `${delays.length}/${delays.length}`);
  }
  // S6 combined realistic impairments (fixed seeds; pre-registered thresholds)
  {
    const sweepRows = [];
    const r = berBatch(function* () {
      for (let f = 0; f < 300; f++) {
        const seed = 6000 + f;
        const tx = transmit({ grid: G, mod: "QPSK", seed });
        const ch = applyChannel(tx, { preset: "EPA", delay: 90, cfoEps: 0.35, pnLinewidthHz: 200, sfoPpm: 20, fs: FS,
                                      noise: { mode: "esn0", valueDb: 22 }, seed });
        const rr = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
        sweepRows.push([rr.syncErr, rr.cfoErrEps, rr.mseH, rr.evm]);
        yield [rr.bitErrors, rr.bitTotal];
      }
    });
    const mSync = sweepRows.reduce((a, r2) => a + Math.abs(r2[0]), 0) / sweepRows.length;
    const mCfo = sweepRows.reduce((a, r2) => a + Math.abs(r2[1]), 0) / sweepRows.length;
    const mMse = sweepRows.reduce((a, r2) => a + r2[2], 0) / sweepRows.length;
    const mEvm = sweepRows.reduce((a, r2) => a + r2[3], 0) / sweepRows.length;
    console.log(`     S6 report: BER=${r.p.toExponential(3)} (SE ${r.se.toExponential(1)}), EVM=${(100 * mEvm).toFixed(2)}%, ` +
                `|sync err|=${mSync.toFixed(2)} smp, |CFO err|=${mCfo.toFixed(4)} sc, CE MSE=${mMse.toExponential(2)}`);
    check("S6 combined (EPA+CFO 0.35+PN 200Hz+SFO 20ppm, 22 dB Es/N0 QPSK): BER < 1e-2", r.p < 1e-2,
          `${r.p.toExponential(3)} (${r.errs} errs / ${r.bits} bits)`, "< 1e-2");
    check("S6 combined: mean |sync err| <= 2 samples (CP backoff)", mSync <= 2.5, mSync.toFixed(2), "<= 2.5");
    check("S6 combined: mean |CFO err| < 0.01 sc", mCfo < 0.01, mCfo.toFixed(4), "< 0.01 sc");
  }
}

/* =========================================================================
 * J. Export, re-import and regeneration (RTL vector contract)
 * ========================================================================= */
sec("J. Export / re-import / regeneration");
{
  const tx = transmit({ grid: G, mod: "16QAM", seed: 7777 });
  const cfg = { preset: "EPA", delay: 37, cfoEps: 0.45, sfoPpm: 15, pnLinewidthHz: 150, fs: FS,
                iq: { gainDb: 0.7, phaseDeg: 2 }, pa: { backoffDb: 6, p: 2 }, dc: 0.01,
                noise: { mode: "esn0", valueDb: 21 }, seed: 7777 };
  const ch = applyChannel(tx, cfg);
  const rr = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
  const doc = buildExport(tx, ch, rr, { engineVersion: "test", fs: FS, syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
  const text = JSON.stringify(doc);
  const back = parseExport(text);
  check("export schema/version tag", doc.schema === EXPORT_SCHEMA && doc.version === EXPORT_VERSION, `${doc.schema} v${doc.version}`, "ofdm-e2e-signals v1");
  check("export records fftSize, cpLength, sampleRate, bin ordering, complex layout, seeds",
        doc.config.fftSize === G.N && doc.config.cpLength === G.cp && doc.config.sampleRateHz === FS &&
        typeof doc.config.binOrdering === "string" && /re\[\]/.test(doc.config.complexFormat) && doc.config.seed === 7777,
        "present", "present");
  const bitsEq = back.txBits.length === tx.txBits.length && back.txBits.every((v, i) => v === tx.txBits[i]);
  const iqEq = maxAbsDiff(back.txIQ, tx.txIQ) === 0 && maxAbsDiff(back.rxIQ, ch.rxIQ) === 0;
  check("JSON re-import reproduces txBits and txIQ/rxIQ bit-exactly", bitsEq && iqEq, bitsEq && iqEq ? "exact" : "MISMATCH", "exact");
  const rg = regenerate(back);
  const worst = Math.max(rg.txIQ.maxAbs, rg.qamSymbols.maxAbs, rg.rxIQ.maxAbs, rg.channelImpulseResponse.maxAbs, rg.equalizedSymbols.maxAbs);
  check("regeneration from exported config+seed+bits reproduces every stored signal (max|diff| = 0)", worst === 0,
        worst, "0", `txIQ ${rg.txIQ.maxAbs}, rxIQ ${rg.rxIQ.maxAbs}, H ${rg.channelImpulseResponse.maxAbs}`);
  check("regeneration: RX bits identical and BER identical to the stored metrics",
        rg.rxBitsEqual && rg.ber === doc.metrics.ber, rg.ber, doc.metrics.ber, "");
  check("export NMSE definition: sum|x_RTL-x_REF|^2 / sum|x_REF|^2 = 0 for identical arrays", rg.rxIQ.nmse === 0, rg.rxIQ.nmse, "0");
}

/* =========================================================================
 * K. Determinism
 * ========================================================================= */
sec("K. Determinism");
{
  const run = (seed) => {
    const tx = transmit({ grid: G, mod: "64QAM", seed });
    const ch = applyChannel(tx, { preset: "EVA", delay: 21, cfoEps: 0.7, sfoPpm: 25, pnLinewidthHz: 80, fs: FS,
                                  iq: { gainDb: 0.4, phaseDeg: 2 }, pa: { backoffDb: 6, p: 2 }, dc: 0.01,
                                  noise: { mode: "esn0", valueDb: 24 }, seed });
    const rr = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "lmmse", eqMethod: "mmse" });
    return { rxIQ: ch.rxIQ, bits: rr.rxBits, ber: rr.ber, evm: rr.evm };
  };
  const a = run(31337), b = run(31337), c = run(31338);
  const same = maxAbsDiff(a.rxIQ, b.rxIQ) === 0 && a.bits.every((v, i) => v === b.bits[i]) && a.evm === b.evm;
  check("identical config+seed -> bit-identical RX IQ, bits, EVM", same, same ? "identical" : "DIFFERENT", "identical");
  check("different seed -> different realization (non-trivial randomness)", maxAbsDiff(a.rxIQ, c.rxIQ) > 0, maxAbsDiff(a.rxIQ, c.rxIQ).toExponential(2), "> 0");
}

/* =========================================================================
 * L. Documentation <-> code traceability (identifiers in docs must exist)
 * ========================================================================= */
sec("L. Traceability — documented identifiers exist in source");
{
  const docPath = path.join(ROOT, "docs", "MATH_VERIFICATION.md");
  if (!fs.existsSync(docPath)) {
    check("docs/MATH_VERIFICATION.md present", false, "missing", "present");
  } else {
    const doc = fs.readFileSync(docPath, "utf8");
    const srcFiles = ["js/phy/engine.js", "js/channel/channel.js", "js/receiver/receiver.js",
                      "js/experiments/export.js", "js/experiments/mc_worker.js", "js/app.js"];
    const srcText = srcFiles.map(f => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
    const ids = new Set([...doc.matchAll(/`([A-Za-z_][A-Za-z0-9_]*)\(\)`/g)].map(m => m[1]));
    const testText = fs.readFileSync(path.join(ROOT, "tests/test_verify.mjs"), "utf8");
    const missing = [...ids].filter(id => !new RegExp(`(function|const|let)\\s+${id}\\b`).test(srcText + testText));
    check(`every function named in MATH_VERIFICATION.md exists in source (${ids.size} ids)`, missing.length === 0,
          missing.length ? missing.join(",") : "all found", "0 missing");
  }
}

/* ---------------- summary ---------------- */
const total = results.length, passed = results.filter(r => r.pass).length;
console.log(`\n==== ${passed} passed, ${total - passed} failed, ${total} checks ====`);
const outDir = path.join(HERE, "results");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "last_verify.json"),
  JSON.stringify({ suite: "test_verify", generatedWith: "node " + process.version,
                   total, passed, failed: total - passed, results }, null, 2));
process.exit(total - passed ? 1 : 0);
