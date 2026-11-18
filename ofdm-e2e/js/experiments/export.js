/* =========================================================================
 * OFDM E2E — versioned signal/config export and re-import.
 * Schema "ofdm-e2e-signals" v1. Complex arrays are exported as
 * { re:[...], im:[...] } JSON number arrays (float64; JSON round-trips
 * IEEE doubles exactly via shortest-repr serialization).
 * ========================================================================= */
import { makeGrid, transmit, MODS } from "../phy/engine.js";
import { applyChannel } from "../channel/channel.js";
import { receive } from "../receiver/receiver.js";

export const EXPORT_SCHEMA = "ofdm-e2e-signals";
export const EXPORT_VERSION = 1;

const c2j = (x) => x ? { re: Array.from(x.re), im: Array.from(x.im) } : null;
const cList = (l) => l ? l.map(c2j) : null;
const j2c = (o) => o ? { re: Float64Array.from(o.re), im: Float64Array.from(o.im) } : null;
const j2cList = (l) => l ? l.map(j2c) : null;

export function buildExport(tx, chan, rxRes, uiCfg = {}) {
  const g = tx.grid;
  return {
    schema: EXPORT_SCHEMA,
    version: EXPORT_VERSION,
    generator: "ofdm-e2e engine " + uiCfg.engineVersion,
    config: {
      sampleRateHz: uiCfg.fs ?? 20e6,
      fftSize: g.N,
      cpLength: g.cp,
      nDataSymbols: g.nSym,
      gridConfig: { N: g.N, cp: g.cp, nSym: g.nSym, guard: g.guard, pilotSpacing: g.pilotSpacing },
      binOrdering: g.binOrder,
      complexFormat: "separate re[]/im[] arrays, index-aligned, float64",
      symbolIndexing: "frame = [P1(SchmidlCox), P2(known), data 0..nSym-1]; each symbol = cp + N samples; " +
                      "symbol s occupies samples [(2+s)(cp+N), (3+s)(cp+N)) of txIQ",
      activeBins: g.activeBins,
      pilotBins: g.pilotBins,
      dataBins: g.dataBins,
      pilotValues: c2j(tx.pilots),
      modulation: tx.mod,
      bitsPerSymbol: tx.bps,
      normalization: "unitary FFT/IFFT (1/sqrt(N) both directions); unit average symbol energy on active bins",
      seed: tx.seed,
      channel: chan?.channelCfg ?? null,
      noiseSigma2: chan?.sigma2 ?? null,
      receiver: { syncMode: uiCfg.syncMode, ceMethod: uiCfg.ceMethod, eqMethod: uiCfg.eqMethod },
    },
    signals: {
      txBits: Array.from(tx.txBits),
      qamSymbols: c2j(tx.qamSyms),
      resourceGrid: cList(tx.gridSyms),
      ifftOut: cList(tx.ifftOut),
      txIQ: c2j(tx.txIQ),
      channelImpulseResponse: c2j(chan?.h),
      rxIQ: c2j(chan?.rxIQ),
      fftOut: cList(rxRes?.fftOut),
      channelEstimates: cList(rxRes?.Hest),
      equalizedSymbols: c2j(rxRes?.eqSyms),
      rxBits: rxRes ? Array.from(rxRes.rxBits) : null,
    },
    metrics: rxRes ? {
      ber: rxRes.ber, bitErrors: rxRes.bitErrors, bitTotal: rxRes.bitTotal,
      evmRms: rxRes.evm, mseH: rxRes.mseH,
      syncErrSamples: rxRes.syncErr, cfoErrSubcarriers: rxRes.cfoErrEps,
      trueDelay: chan?.trueDelay, trueCfoEps: chan?.trueCfoEps,
    } : null,
  };
}

/* Parse + validate a JSON text or object. Throws on schema/version mismatch. */
export function parseExport(input) {
  const doc = typeof input === "string" ? JSON.parse(input) : input;
  if (doc.schema !== EXPORT_SCHEMA) throw new Error(`schema '${doc.schema}' != '${EXPORT_SCHEMA}'`);
  if (doc.version !== EXPORT_VERSION) throw new Error(`version ${doc.version} unsupported`);
  const s = doc.signals;
  return {
    config: doc.config, metrics: doc.metrics,
    txBits: Uint8Array.from(s.txBits),
    qamSymbols: j2c(s.qamSymbols), txIQ: j2c(s.txIQ), rxIQ: j2c(s.rxIQ),
    channelImpulseResponse: j2c(s.channelImpulseResponse),
    fftOut: j2cList(s.fftOut), channelEstimates: j2cList(s.channelEstimates),
    equalizedSymbols: j2c(s.equalizedSymbols), rxBits: s.rxBits ? Uint8Array.from(s.rxBits) : null,
    resourceGrid: j2cList(s.resourceGrid), ifftOut: j2cList(s.ifftOut),
  };
}

/* Regenerate the whole chain from an exported document's config + seed + the
 * stored channel configuration, then compare every stored array. Returns a
 * report with max-abs and NMSE per signal, plus exact bit equality. A true
 * reproduction gives zero differences. */
export function regenerate(doc) {
  const c = doc.config;
  const grid = makeGrid(c.gridConfig);
  const tx = transmit({ grid, mod: c.modulation, seed: c.seed, txBits: doc.txBits });
  const chan = applyChannel(tx, c.channel);
  const rx = receive(chan.rxIQ, tx, chan, c.receiver);
  const cmpC = (a, b) => {
    if (!a || !b) return { present: !!a === !!b, maxAbs: null, nmse: null };
    let maxAbs = 0, num = 0, den = 0;
    const n = Math.max(a.re.length, b.re.length);
    if (a.re.length !== b.re.length) return { present: false, lengthMismatch: [a.re.length, b.re.length] };
    for (let i = 0; i < n; i++) {
      const dr = a.re[i] - b.re[i], di = a.im[i] - b.im[i];
      maxAbs = Math.max(maxAbs, Math.hypot(dr, di));
      num += dr * dr + di * di; den += b.re[i] ** 2 + b.im[i] ** 2;
    }
    return { present: true, maxAbs, nmse: den > 0 ? num / den : (num === 0 ? 0 : Infinity) };
  };
  const bitsEq = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);
  return {
    txIQ: cmpC(doc.txIQ, tx.txIQ),
    qamSymbols: cmpC(doc.qamSymbols, tx.qamSyms),
    rxIQ: cmpC(doc.rxIQ, chan.rxIQ),
    channelImpulseResponse: cmpC(doc.channelImpulseResponse, chan.h),
    equalizedSymbols: cmpC(doc.equalizedSymbols, rx.eqSyms),
    txBitsEqual: bitsEq(doc.txBits, tx.txBits),
    rxBitsEqual: bitsEq(doc.rxBits, rx.rxBits),
    ber: rx.ber,
    storedBer: doc.metrics?.ber ?? null,
    regenerated: { tx, chan, rx },
  };
}

export { MODS };
