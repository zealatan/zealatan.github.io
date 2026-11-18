/* =========================================================================
 * OFDM E2E — Layer C controller. Wires the UI to the PHY engine; every
 * visualization reads intermediate arrays from the single latest run.
 * ========================================================================= */
import { makeGrid, transmit, fftRadix2, qamMap, MODS, ENGINE_VERSION, snrHelpers }
  from "./phy/engine.js";
import { applyChannel, CHANNEL_PRESETS } from "./channel/channel.js";
import { receive } from "./receiver/receiver.js";
import { buildExport } from "./experiments/export.js";
import * as P from "./visualization/plots.js";

const $ = (id) => document.getElementById(id);
const FS = 20e6;

/* ---------------- state ---------------- */
const S = {
  mod: "16QAM", preset: "EPA", snrDb: 25, snrMode: "esn0",
  delay: 60, cfoEps: 0.8, sfoPpm: 0, pnHz: 0,
  iq: false, pa: false, dc: false, seed: 1,
  syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf",
  viewConst: "tx", viewTime: "tx", viewChan: "H",
  live: true,
};
let last = null;            // {tx, ch, rx} of the latest end-to-end run
let sweep = { xs: [], ber: [], evm: [], running: false, detail: "" };
const theoryCache = {};

/* ---------------- engine run ---------------- */
function chanCfg(seed) {
  return {
    preset: S.preset, delay: S.delay, cfoEps: S.cfoEps,
    sfoPpm: S.sfoPpm, pnLinewidthHz: S.pnHz, fs: FS,
    iq: S.iq ? { gainDb: 1, phaseDeg: 5 } : null,
    pa: S.pa ? { backoffDb: 3, p: 2 } : null,
    dc: S.dc ? 0.03 : 0,
    noise: { mode: S.snrMode, valueDb: S.snrDb },
    seed,
  };
}
function rxCfg() {
  return { syncMode: S.syncMode, ceMethod: S.ceMethod, eqMethod: S.eqMethod };
}
function runOnce() {
  const grid = makeGrid({});
  const tx = transmit({ grid, mod: S.mod, seed: S.seed });
  const ch = applyChannel(tx, chanCfg(S.seed));
  let rx = null, err = null;
  try { rx = receive(ch.rxIQ, tx, ch, rxCfg()); }
  catch (e) { err = String(e.message || e); }
  last = { tx, ch, rx, err, grid };
  render();
}

/* ---------------- rendering ---------------- */
function render() {
  if (!last) return;
  const { tx, ch, rx, grid } = last;

  // --- constellation cell ---
  const lims = { QPSK: 1.6, "16QAM": 1.6, "64QAM": 1.6, "256QAM": 1.6 };
  if (S.viewConst === "tx")
    P.scatter($("cvConst"), tx.qamSyms,
      { lim: lims[S.mod], title: `TX constellation — mapper output (${S.mod}, ${tx.qamSyms.re.length} syms)` });
  else if (S.viewConst === "pre" && rx)
    P.scatter($("cvConst"), rx.rxConstPre,
      { lim: 3.2, color: "rgba(88,166,255,0.8)",
        title: "RX data bins BEFORE equalization (FFT output Y[k])" });
  else if (S.viewConst === "post" && rx)
    P.scatter($("cvConst"), rx.eqSyms,
      { lim: lims[S.mod], color: "rgba(63,185,80,0.9)",
        title: `RX AFTER ${S.eqMethod.toUpperCase()} equalization (${S.ceMethod} CE)` });

  // --- time / spectrum / sync cell ---
  if (S.viewTime === "tx")
    P.timeSeries($("cvTime"), tx.txIQ, FS, { title: "TX baseband IQ — full frame (preambles + 14 symbols)" });
  else if (S.viewTime === "rx")
    P.timeSeries($("cvTime"), ch.rxIQ, FS, {
      title: "RX IQ after channel+impairments",
      marks: [{ at: ch.trueDelay, col: "#3fb950", label: "true start" },
              ...(rx && !rx.sync.oracle ? [{ at: rx.sync.frameStart, col: "#f85149", label: "sync" }] : [])] });
  else if (S.viewTime === "spec")
    P.spectrum($("cvTime"), ch.rxIQ, FS,
      { offset: ch.trueDelay + 2 * tx.symLen, fft: fftRadix2,
        title: "RX spectrum — 512-pt Hann FFT of the data region (dB)" });
  else if (S.viewTime === "sync") {
    if (rx && rx.sync.scMetric)
      P.syncMetric($("cvTime"), rx.sync.scMetric,
        [{ at: ch.trueDelay, col: "#3fb950", label: "true start", dash: true },
         { at: rx.sync.frameStart, col: "#f85149", label: `sync (err ${rx.syncErr >= 0 ? "+" : ""}${rx.syncErr})` }]);
    else {
      const x = P.clear($("cvTime"));
      x.fillStyle = "#8b949e"; x.font = "12px sans-serif"; x.textAlign = "center";
      x.fillText("oracle sync mode — no S&C metric computed", $("cvTime").width / 2, 60);
    }
  }

  // --- channel cell ---
  if (S.viewChan === "H" && rx) {
    const curves = [];
    if (rx.Htrue) curves.push({ H: rx.Htrue, col: "#8b949e", label: "true H (oracle view)", width: 2.2 });
    curves.push({ H: rx.Hest[0], col: "#58a6ff", label: `estimate (${S.ceMethod}, symbol 0)`,
                  dotsAt: grid.pilotBins });
    P.freqCurves($("cvChan"), grid, curves);
  } else if (S.viewChan === "cir") {
    const mags = [];
    for (let l = 0; l < ch.h.re.length; l++) mags.push(Math.hypot(ch.h.re[l], ch.h.im[l]));
    P.stems($("cvChan"), mags,
      { title: `channel impulse response |h[l]| — ${S.preset} realization (${mags.length} taps, CP=${grid.cp})` });
  } else if (S.viewChan === "ber") {
    drawSweep();
  }

  // --- metrics ---
  if (rx) {
    $("mBer").textContent = rx.ber.toExponential(2);
    $("mBits").textContent = `(${rx.bitErrors}/${rx.bitTotal} bits, 1 frame)`;
    $("mEvm").textContent = (100 * rx.evm).toFixed(2) + " %";
    $("mMse").textContent = rx.mseH != null ? rx.mseH.toExponential(2) : "n/a";
    $("mSync").textContent = rx.sync.oracle ? "oracle" :
      `${rx.syncErr >= 0 ? "+" : ""}${rx.syncErr} smp`;
    $("mCfo").textContent = rx.sync.oracle ? "oracle" :
      `${(rx.cfoErrEps >= 0 ? "+" : "")}${rx.cfoErrEps.toFixed(4)} sc`;
    $("mNote").textContent = last.err ? "⚠ " + last.err :
      (rx.sync.oracle ? "oracle sync: true timing & CFO handed to the RX (baseline mode)" :
       "practical sync: S&C fractional CFO + known-P2 xcorr integer CFO & timing");
  } else {
    $("mBer").textContent = "—";
    $("mNote").textContent = "⚠ " + (last.err ?? "no run");
  }
  const h = snrHelpers(grid, MODS[S.mod]);
  $("gridInfo").innerHTML =
    `N=${grid.N} CP=${grid.cp} · active ${grid.activeBins.length} ` +
    `(pilot ${grid.pilotBins.length} / data ${grid.dataBins.length}) · ` +
    `${grid.nSym} sym + 2 preambles = ${tx.frameLen} samples · ` +
    `CP ovh ${h.cpOverheadDb.toFixed(2)} dB · pilot ovh ${h.pilotOverheadDb.toFixed(2)} dB`;
}

/* ---------------- BER/EVM sweep (worker) ---------------- */
let worker = null;
function theoreticalBer(mod, snrDb) {
  // analytic Gray-QAM over AWGN (per-bit approx) — REFERENCE curve, labeled
  const bps = MODS[mod], esn0 = S.snrMode === "ebn0" ? snrDb + 10 * Math.log10(bps) : snrDb;
  const g = Math.pow(10, esn0 / 10), L = Math.sqrt(1 << bps);
  const erfc = (x) => { // Abramowitz-Stegun
    const z = Math.abs(x), t = 1 / (1 + z / 2);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 +
      t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 +
      t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  };
  const a = (1 - 1 / L) / Math.log2(L) * 2;
  return a * 0.5 * erfc(Math.sqrt(3 * g / (2 * (L * L - 1))) / Math.SQRT2 * Math.SQRT2);
}
function drawSweep() {
  const xs = sweep.xs.length ? sweep.xs : [0, 24];
  const theo = xs.map((s) => theoreticalBer(S.mod, s));
  P.lineChart($("cvChan"), xs, [
    { ys: theo, col: "#8b949e", label: `theory ${S.mod}/AWGN (analytic)`, dash: true, width: 1.3 },
    { ys: sweep.ber, col: "#f85149", label: "BER (simulated)", points: true },
    { ys: sweep.evm, col: "#58a6ff", label: "EVM rms (simulated)", points: true },
  ], { logY: true, yMinFloor: 1e-7,
       title: `BER & EVM vs ${S.snrMode === "ebn0" ? "Eb/N0" : S.snrMode === "esn0" ? "Es/N0" : "sample SNR"} — ${S.mod}, ${S.preset}, sync=${S.syncMode}, CE=${S.ceMethod}`,
       xLabel: `${S.snrMode === "ebn0" ? "Eb/N0" : S.snrMode === "esn0" ? "Es/N0" : "SNR"} (dB)` });
}
function startSweep() {
  if (sweep.running) return;
  const lo = +$("swLo").value, hi = +$("swHi").value, st = Math.max(0.5, +$("swStep").value);
  const xs = [];
  for (let s = lo; s <= hi + 1e-9; s += st) xs.push(+s.toFixed(2));
  sweep = { xs, ber: xs.map(() => null), evm: xs.map(() => null), running: true, detail: "" };
  S.viewChan = "ber"; setTabs("tabsChan", "ber");
  worker?.terminate();
  worker = new Worker(new URL("./experiments/mc_worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === "point") {
      sweep.ber[m.i] = m.ber > 0 ? m.ber : null;
      sweep.evm[m.i] = m.evm;
      sweep.detail = `last point: ${m.snrDb} dB — ${m.errs} errs / ${m.bits} bits ` +
        `(${m.frames} frames${m.syncFail ? `, ${m.syncFail} sync losses` : ""})`;
      $("swStat").textContent = `running… ${m.i + 1}/${sweep.xs.length}`;
      $("swDetail").textContent = sweep.detail;
      drawSweep();
    } else if (m.type === "done") {
      sweep.running = false;
      $("swStat").textContent = "done";
      $("btnSweep").disabled = false; $("btnStopSweep").disabled = true;
    }
  };
  $("btnSweep").disabled = true; $("btnStopSweep").disabled = false;
  $("swStat").textContent = "starting…";
  worker.postMessage({ type: "sweep", snrList: xs,
    minErrors: Math.max(10, +$("swErr").value), maxBits: Math.max(10000, +$("swBits").value),
    seed0: S.seed * 7919 + 1,
    cfg: { mod: S.mod, snrMode: S.snrMode, chan: { ...chanCfg(0), noise: undefined }, rx: rxCfg() } });
}
function stopSweep() {
  worker?.terminate(); worker = null;
  sweep.running = false;
  $("swStat").textContent = "stopped";
  $("btnSweep").disabled = false; $("btnStopSweep").disabled = true;
}

/* ---------------- image over the real PHY ---------------- */
const IW = 48, IH = 48;
function defaultImage() {
  const x = $("txImg").getContext("2d");
  const g = x.createLinearGradient(0, 0, IW, IH);
  g.addColorStop(0, "#1b6ef3"); g.addColorStop(0.5, "#9b5cf6"); g.addColorStop(1, "#f0883e");
  x.fillStyle = g; x.fillRect(0, 0, IW, IH);
  const cols = ["#f85149", "#3fb950", "#d29922", "#58a6ff"];
  for (let i = 0; i < 4; i++) { x.fillStyle = cols[i]; x.fillRect(3 + i * 11, 4, 8, 14); }
  x.fillStyle = "#0b0f14"; x.beginPath(); x.arc(IW / 2, 32, 9, 0, 6.3); x.fill();
  x.fillStyle = "#fff"; x.font = "bold 9px sans-serif"; x.textAlign = "center";
  x.fillText("E2E", IW / 2, 46);
}
function imageBits() {
  const d = $("txImg").getContext("2d").getImageData(0, 0, IW, IH).data;
  const bits = new Uint8Array(IW * IH * 3 * 8);
  let b = 0;
  for (let p = 0; p < IW * IH; p++)
    for (let c = 0; c < 3; c++) {
      const v = d[p * 4 + c];
      for (let k = 7; k >= 0; k--) bits[b++] = (v >> k) & 1;
    }
  return bits;
}
function bitsToImage(bits) {
  const img = $("rxImg").getContext("2d").createImageData(IW, IH);
  let b = 0;
  for (let p = 0; p < IW * IH; p++) {
    for (let c = 0; c < 3; c++) {
      let v = 0;
      for (let k = 7; k >= 0; k--) v |= bits[b++] << k;
      img.data[p * 4 + c] = v;
    }
    img.data[p * 4 + 3] = 255;
  }
  $("rxImg").getContext("2d").putImageData(img, 0, 0);
}
let imgWorker = null;
function transmitImage() {
  imgWorker?.terminate();
  imgWorker = new Worker(new URL("./experiments/mc_worker.js", import.meta.url), { type: "module" });
  const bits = imageBits();
  $("imgStat").textContent = "transmitting…";
  imgWorker.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === "imgProgress")
      $("imgStat").textContent = `…${Math.round(100 * m.done / m.total)} %`;
    else if (m.type === "imgDone") {
      bitsToImage(m.bits);
      $("imgBer").textContent = (m.errs / m.total).toExponential(1);
      $("imgStat").textContent = `${m.total} bits over ${m.frames} real frames`;
    }
  };
  imgWorker.postMessage({ type: "image", bits, seed0: S.seed * 31 + 7,
    cfg: { mod: S.mod, snrMode: S.snrMode, snrDb: S.snrDb,
           chan: { ...chanCfg(0), noise: undefined }, rx: rxCfg() } });
}

/* ---------------- export ---------------- */
function doExport() {
  if (!last) return;
  const j = buildExport(last.tx, last.ch, last.rx,
    { engineVersion: ENGINE_VERSION, fs: FS, syncMode: S.syncMode,
      ceMethod: S.ceMethod, eqMethod: S.eqMethod });
  const blob = new Blob([JSON.stringify(j)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `ofdm-e2e-signals-seed${S.seed}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------------- UI wiring ---------------- */
function mkButtons(elId, keys, cur, cb) {
  const el = $(elId); el.innerHTML = "";
  for (const k of keys) {
    const b = document.createElement("button");
    b.textContent = k;
    if (k === cur) b.classList.add("active");
    b.onclick = () => {
      el.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active"); cb(k);
    };
    el.appendChild(b);
  }
}
function setTabs(elId, v) {
  $(elId).querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.v === v));
}
function tabHandler(elId, key) {
  $(elId).addEventListener("click", (ev) => {
    const b = ev.target.closest("button"); if (!b) return;
    S[key] = b.dataset.v; setTabs(elId, b.dataset.v); render();
  });
}
function slider(id, vid, fmt, set) {
  const s = $(id), v = $(vid);
  s.addEventListener("input", () => { v.textContent = fmt(+s.value); set(+s.value); runOnce(); });
  v.textContent = fmt(+s.value);
}
function toggle(id, key) {
  $(id).addEventListener("click", () => {
    S[key] = !S[key]; $(id).classList.toggle("on", S[key]); runOnce();
  });
}

mkButtons("mods", Object.keys(MODS), S.mod, (k) => { S.mod = k; runOnce(); });
mkButtons("chans", Object.keys(CHANNEL_PRESETS), S.preset, (k) => { S.preset = k; runOnce(); });
mkButtons("ces", ["perfect", "ls-linear", "ls-dft", "lmmse"], S.ceMethod, (k) => {
  S.ceMethod = k; runOnce();
});
tabHandler("tabsConst", "viewConst");
tabHandler("tabsTime", "viewTime");
tabHandler("tabsChan", "viewChan");
slider("snr", "snrv", (x) => x.toFixed(1) + " dB", (x) => { S.snrDb = x; });
slider("delay", "delayv", (x) => x + " smp", (x) => { S.delay = x; });
slider("cfo", "cfov", (x) => (x >= 0 ? "+" : "") + x.toFixed(2) + " sc", (x) => { S.cfoEps = x; });
slider("sfo", "sfov", (x) => x + " ppm", (x) => { S.sfoPpm = x; });
slider("pn", "pnv", (x) => x + " Hz", (x) => { S.pnHz = x; });
toggle("tIQ", "iq"); toggle("tPA", "pa"); toggle("tDC", "dc");
$("snrMode").addEventListener("change", () => { S.snrMode = $("snrMode").value; runOnce(); });
$("seed").addEventListener("change", () => { S.seed = Math.max(0, +$("seed").value | 0); runOnce(); });
$("syncPractical").onclick = () => { S.syncMode = "practical";
  $("syncPractical").classList.add("active"); $("syncOracle").classList.remove("active");
  $("oracleTag").hidden = true; runOnce(); };
$("syncOracle").onclick = () => { S.syncMode = "oracle";
  $("syncOracle").classList.add("active"); $("syncPractical").classList.remove("active");
  $("oracleTag").hidden = false; runOnce(); };
$("eqZf").onclick = () => { S.eqMethod = "zf";
  $("eqZf").classList.add("active"); $("eqMmse").classList.remove("active"); runOnce(); };
$("eqMmse").onclick = () => { S.eqMethod = "mmse";
  $("eqMmse").classList.add("active"); $("eqZf").classList.remove("active"); runOnce(); };
$("btnSweep").onclick = startSweep;
$("btnStopSweep").onclick = stopSweep;
$("btnExport").onclick = doExport;
$("btnImg").onclick = transmitImage;
$("btnLive").onclick = () => {
  S.live = !S.live; $("btnLive").classList.toggle("on", S.live);
  $("btnLive").textContent = S.live ? "▶ live" : "⏸ paused";
};
$("upload").addEventListener("change", (ev) => {
  const f = ev.target.files[0]; if (!f) return;
  const img = new Image();
  img.onload = () => {
    const x = $("txImg").getContext("2d");
    const s = Math.max(IW / img.width, IH / img.height);
    x.clearRect(0, 0, IW, IH);
    x.drawImage(img, (IW - img.width * s) / 2, (IH - img.height * s) / 2,
                img.width * s, img.height * s);
  };
  img.src = URL.createObjectURL(f);
});

/* live mode: re-run with a fresh channel/noise realization at ~2 Hz */
setInterval(() => {
  if (!S.live) return;
  S.seed = (S.seed + 1) % 100000;
  $("seed").value = S.seed;
  runOnce();
}, 600);

window.addEventListener("resize", render);
defaultImage();
runOnce();
