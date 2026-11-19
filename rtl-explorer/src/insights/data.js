// Measured facts + provenance for the Design Insights chapters.
// Every number shown in a chapter either comes from store.throughput
// (generated/throughput.json, regenerated from the recorded traces) or from
// the constants below, each tied to a report + commit. NOTHING here is
// invented; chapters must render '—' when a value is absent.

export const COMMITS = {
  baseline: 'ea7ee970 (main)',
  fix: '172466b (branch streaming-fix — LOCAL only, not pushed/deployed)',
};

export const CONDITIONS =
  'cocotb 2.1.0 + Verilator 5.044, 250 MHz model clock, behavioral BFP ' +
  'FFT/IFFT models (II=1; real Xilinx xfft is the acceptance gate for silicon)';

export const REPORTS = {
  tier2: 'reports/TIER2_OFDM_REPORT.md',
  audit: 'reports/THROUGHPUT_AUDIT.md',
  auditJson: 'reports/ofdm_throughput_audit.json',
  fix: 'reports/STREAMING_FIX_REPORT.md',
};

// Stage-accuracy metrics from the tier-2 golden comparison (identical before
// and after the streaming fix - scheduling-only change).
export const STAGE_METRICS = {
  txMaxLsb: 2, txNmseDb: -78.2, evmPct: 0.0332, eqMaxLsb: 4,
  syncRegionExact: true,
  source: 'reports/tier2_ofdm_qpsk_tier1.json / _qam16_tier1.json',
};

// Frame geometry (RTL parameters, ofdm_transceiver_top)
export const FRAME = {
  slot: 4032, frame: 4160, sym: 288, nsc: 256, cp: 32, syncLen: 576,
  dataSyms: 12, padding: 128,
};

// Resource estimates (RTL inspection — NOT synthesis results)
export const RESOURCES = {
  bankDepth: 8192, bankWidth: 32,
  bramPerBank36k: 8,                 // ceil(8192*32 / 36864)
  pingpongBram: 16, multibankBram: 24,
  optimizedDepth: 4608, optimizedBram: 15,
  deltaLut: '~+250 (estimate)', deltaFf: '~+150 (estimate)', deltaDsp: 0,
  zynq7020: { lut: 53200, ff: 106400, bram36: 140, dsp: 220 },
};

export function measured(store) {
  const t = store.throughput || {};
  const s = t.summary || {};
  const ba = s.before_after || null;
  const sf = s.streaming_fix || {};
  return {
    ba, sf,
    windows: t.windows || [],
    modules: t.modules || {},
    rxRate: s.rx_continuous_loopback_rate,
    rxB2bStalls: s.rx_b2b_stall_cycles,
    caveat: s.caveat_xfft,
    frameLatency: ba ? ba.frame_latency_steady : null,
  };
}

// GitHub links: ONLY valid for files that exist on the pushed main branch.
// Files modified/created by the streaming fix are local-only -> mark them.
const GH = 'https://github.com/zealatan/realtime-Gbps-OFDM-for-Wideband/blob/main/RTL_SYNC_PHASE5/rtl/';
export function ghLink(file, { localOnly = false, modified = false } = {}) {
  if (localOnly) return { github: null, localNote: 'new file on local streaming-fix branch (not on GitHub)' };
  if (modified) return { github: GH + file,
    localNote: 'GitHub shows the pre-fix version; streaming-fix changes are local (172466b)' };
  return { github: GH + file, localNote: null };
}
