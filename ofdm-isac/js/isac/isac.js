/* Independent monostatic sensing path built on the copied OFDM transmitter.
 * The communication engine and its defaults are not changed.
 * Complex arrays and FFTs use the copied engine's unitary convention.
 */
import { czeros, fft, ifft, makeGrid, makeRng, transmit } from "../phy/engine.js";

export const C = 299792458;

export function numerology(grid, fs, fc, nFrames = 1) {
  const Ts = (grid.N + grid.cp) / fs, M = (grid.nSym + 2) * nFrames;
  return { fs, fc, scs: fs / grid.N, Ts, lambda: C / fc, M,
    rangeBin: C / (2 * fs), cpRange: C * grid.cp / (2 * fs),
    rangeAmbiguity: C / (2 * (fs / grid.N)),
    velocityBin: C / (2 * fc * M * Ts), velocityNyquist: C / (4 * fc * Ts),
    cpi: M * Ts };
}

export function buildTrain({ grid = makeGrid(), mod = "16QAM", seed = 1, nFrames = 1 } = {}) {
  if (nFrames < 1 || !Number.isInteger(nFrames)) throw new Error("nFrames must be a positive integer");
  const first = transmit({ grid, mod, seed });
  const L = first.frameLen, train = czeros(L * nFrames), symbols = [];
  for (let f = 0; f < nFrames; f++) {
    const tx = f === 0 ? first : transmit({ grid, mod, seed: seed + f });
    train.re.set(tx.txIQ.re, f * L); train.im.set(tx.txIQ.im, f * L);
    symbols.push(tx.pre.X1, tx.pre.X2, ...tx.gridSyms);
  }
  return { grid, mod, seed, nFrames, txIQ: train, symbols, first };
}

// Zero outside the finite TX record. Linear fractional interpolation is
// explicit here; Python's bandlimited reference is the accuracy oracle.
export function targetEcho(train, { fs, fc, targets, snrDb = null, seed = 1 }) {
  const x = train.txIQ, y = czeros(x.re.length), rng = makeRng(seed);
  for (const t of targets) {
    const delay = 2 * t.rangeM * fs / C;
    if (!Number.isFinite(delay) || delay < 0) throw new Error("range must be nonnegative");
    const ar = t.ampRe ?? 1, ai = t.ampIm ?? 0;
    const fd = 2 * t.velocityMps * fc / C;
    for (let n = 0; n < y.re.length; n++) {
      const u = n - delay, i = Math.floor(u), a = u - i;
      const r = (i >= 0 && i < x.re.length ? (1-a)*x.re[i] : 0) +
                (i+1 >= 0 && i+1 < x.re.length ? a*x.re[i+1] : 0);
      const q = (i >= 0 && i < x.im.length ? (1-a)*x.im[i] : 0) +
                (i+1 >= 0 && i+1 < x.im.length ? a*x.im[i+1] : 0);
      const phi = 2*Math.PI*fd*n/fs, co = Math.cos(phi), si = Math.sin(phi);
      y.re[n] += (ar*r-ai*q)*co - (ar*q+ai*r)*si;
      y.im[n] += (ar*r-ai*q)*si + (ar*q+ai*r)*co;
    }
  }
  if (snrDb != null) {
    let p = 0;
    for (let n = 0; n < y.re.length; n++) p += y.re[n]**2 + y.im[n]**2;
    const sigma = Math.sqrt(p / y.re.length / 10**(snrDb/10) / 2);
    for (let n = 0; n < y.re.length; n++) {
      y.re[n] += sigma*rng.gauss(); y.im[n] += sigma*rng.gauss();
    }
  }
  return y;
}

export function sense(train, echoIQ, fs, fc) {
  const { grid, symbols } = train, { N, cp } = grid, M = symbols.length;
  if (M & (M-1)) throw new Error("total OFDM symbol count must be power of two");
  if (echoIQ.re.length < M*(N+cp)) throw new Error("echo is shorter than TX train");
  const H = [], profiles = [], validCounts = [];
  for (let m = 0; m < M; m++) {
    const base = m*(N+cp)+cp;
    const body = czeros(N);
    body.re.set(echoIQ.re.subarray(base,base+N));
    body.im.set(echoIQ.im.subarray(base,base+N));
    const Y = fft(body), X = symbols[m], h = czeros(N);
    let count = 0;
    for (let k = 0; k < N; k++) {
      const den = X.re[k]**2 + X.im[k]**2;
      if (den > 1e-12) {
        h.re[k] = (Y.re[k]*X.re[k]+Y.im[k]*X.im[k])/den;
        h.im[k] = (Y.im[k]*X.re[k]-Y.re[k]*X.im[k])/den;
        count++;
      }
    }
    H.push(h); profiles.push(ifft(h)); validCounts.push(count);
  }
  const rd = Array.from({length:M},()=>new Float64Array(N));
  for (let p = 0; p < N; p++) {
    const slow = czeros(M);
    for (let m = 0; m < M; m++) {
      slow.re[m] = profiles[m].re[p]; slow.im[m] = profiles[m].im[p];
    }
    const D = fft(slow);
    for (let d = 0; d < M; d++) rd[d][p] = Math.hypot(D.re[(d+M/2)%M],D.im[(d+M/2)%M]);
  }
  const units = numerology(grid,fs,fc,train.nFrames);
  return { rd, H, validCounts, units,
    rangesM: Float64Array.from({length:N},(_,i)=>i*units.rangeBin),
    velocitiesMps: Float64Array.from({length:M},(_,i)=>(i-M/2)*units.velocityBin) };
}

export function strongestPeaks(result, count = 2, guard = 1) {
  const power = result.rd.map(row=>Float64Array.from(row));
  const M = power.length, N = power[0].length, found=[];
  for (let z=0; z<count; z++) {
    let best=-1, bd=0, bp=0;
    for (let d=0; d<M; d++) for (let p=0; p<N; p++)
      if (power[d][p]>best) {best=power[d][p];bd=d;bp=p;}
    found.push({rangeM:result.rangesM[bp],velocityMps:result.velocitiesMps[bd],
      rangeBin:bp,dopplerBin:bd,amplitude:best});
    for (let dd=-guard;dd<=guard;dd++) for (let pp=Math.max(0,bp-guard);pp<=Math.min(N-1,bp+guard);pp++)
      power[(bd+dd+M)%M][pp]=-1;
  }
  return found;
}

export function runIsac(options={}) {
  const grid = options.grid ?? makeGrid();
  const fs = options.fs ?? 20e6, fc = options.fc ?? 24e9;
  const train = buildTrain({grid,mod:options.mod ?? "16QAM",seed:options.seed ?? 1,nFrames:options.nFrames ?? 4});
  const echoIQ = targetEcho(train,{fs,fc,targets:options.targets ?? [{rangeM:30,velocityMps:0}],snrDb:options.snrDb ?? null,seed:options.seed ?? 1});
  const result = sense(train,echoIQ,fs,fc);
  return {train,echoIQ,...result,peaks:strongestPeaks(result,2)};
}
