/* =========================================================================
 * OFDM E2E — versioned signal/config export for RTL & hardware comparison.
 * Schema: "ofdm-e2e-signals" v1. All complex arrays are exported as
 * { re:[...], im:[...] } plain number arrays (JSON-safe).
 * ========================================================================= */

export const EXPORT_SCHEMA = "ofdm-e2e-signals";
export const EXPORT_VERSION = 1;

const c2j = (x) => x ? { re: Array.from(x.re), im: Array.from(x.im) } : null;
const cList = (l) => l ? l.map(c2j) : null;

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
      binOrdering: g.binOrder,
      complexFormat: "separate re[]/im[] arrays, index-aligned, float64",
      symbolIndexing: "frame = [P1(SchmidlCox), P2(known), data 0..nSym-1]; " +
                      "each symbol = cp + N samples",
      activeBins: g.activeBins,
      pilotBins: g.pilotBins,
      dataBins: g.dataBins,
      pilotValues: c2j(tx.pilots),
      modulation: tx.mod,
      bitsPerSymbol: tx.bps,
      normalization: "unitary FFT/IFFT (1/sqrt(N) both directions); " +
                     "unit average symbol energy on active bins",
      seed: tx.seed,
      channel: chan?.channelCfg ?? null,
      noiseSigma2: chan?.sigma2 ?? null,
      receiver: { syncMode: uiCfg.syncMode, ceMethod: uiCfg.ceMethod,
                  eqMethod: uiCfg.eqMethod },
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
