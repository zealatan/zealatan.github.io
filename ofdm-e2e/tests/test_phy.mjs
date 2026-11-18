/* =========================================================================
 * OFDM E2E PHY — numerical test suite (node tests/test_phy.mjs).
 * Tests A–G from the master prompt. Every test actually runs the engine.
 * ========================================================================= */
import { makeRng, czeros, fft, ifft, fftRadix2, qamMap, qamDemap, randomBits,
         makeGrid, transmit, snrHelpers, MODS } from "../js/phy/engine.js";
import { applyChannel, CHANNEL_PRESETS } from "../js/channel/channel.js";
import { receive, synchronize } from "../js/receiver/receiver.js";

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}${detail ? "  (" + detail + ")" : ""}`); }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`); }
}
const qfunc = (x) => 0.5 * erfc(x / Math.SQRT2);
function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + z / 2);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 +
    t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 +
    t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/* ---------------- Test A: FFT/IFFT identity + Parseval ---------------- */
console.log("Test A — FFT/IFFT");
{
  const rng = makeRng(7);
  for (const N of [64, 128, 256]) {
    const X = czeros(N);
    for (let i = 0; i < N; i++) { X.re[i] = rng.gauss(); X.im[i] = rng.gauss(); }
    const Y = fft(ifft(X));
    let err = 0, eT = 0, eF = 0;
    const x = ifft(X);
    for (let i = 0; i < N; i++) {
      err = Math.max(err, Math.hypot(Y.re[i] - X.re[i], Y.im[i] - X.im[i]));
      eF += X.re[i] ** 2 + X.im[i] ** 2;
      eT += x.re[i] ** 2 + x.im[i] ** 2;
    }
    check(`FFT(IFFT(X))=X, N=${N}`, err < 1e-12, `max err ${err.toExponential(1)}`);
    check(`Parseval, N=${N}`, Math.abs(eT - eF) / eF < 1e-12,
          `|Et-Ef|/Ef=${(Math.abs(eT - eF) / eF).toExponential(1)}`);
  }
}

/* ---------------- Test B: QAM round trip ---------------- */
console.log("Test B — QAM mapper/demapper round trip");
for (const mod of Object.keys(MODS)) {
  const bps = MODS[mod], rng = makeRng(11);
  const bits = randomBits(bps * 4096, rng);
  const back = qamDemap(qamMap(bits, bps), bps);
  let errs = 0;
  for (let i = 0; i < bits.length; i++) if (bits[i] !== back[i]) errs++;
  check(`${mod} bits->map->demap->bits`, errs === 0, `${errs} errors / ${bits.length}`);
}

/* ---------------- Test C: perfect channel end-to-end ---------------- */
console.log("Test C — TX -> ideal channel -> RX");
for (const mod of Object.keys(MODS)) {
  const grid = makeGrid({});
  const tx = transmit({ grid, mod, seed: 42 });
  const ch = applyChannel(tx, { preset: "AWGN", delay: 33, noise: null, seed: 42 });
  const r = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
  check(`${mod} BER=0`, r.ber === 0, `BER=${r.ber}, syncErr=${r.syncErr}`);
  check(`${mod} EVM ~ 0`, r.evm < 1e-6, `EVM=${(100 * r.evm).toExponential(2)}%`);
  // sync locks within the CP (a deliberate small backoff is applied)
  check(`${mod} frame boundary within CP`, r.syncErr <= 0 && r.syncErr > -grid.cp / 2,
        `start=${r.sync.frameStart} true=${ch.trueDelay} (backoff ${r.sync.backoff})`);
}

/* ---------------- Test D: QPSK AWGN vs theory ---------------- */
console.log("Test D — QPSK over AWGN vs Pb = Q(sqrt(2 Eb/N0)), oracle sync+CSI");
{
  const grid = makeGrid({});
  for (const ebn0 of [2, 4, 6, 8]) {
    let errs = 0, total = 0, frame = 0;
    while (errs < 400 && total < 4e6) {
      const tx = transmit({ grid, mod: "QPSK", seed: 1000 + frame });
      const ch = applyChannel(tx, { preset: "AWGN", delay: 0,
        noise: { mode: "ebn0", valueDb: ebn0 }, seed: 1000 + frame });
      const r = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "zf" });
      errs += r.bitErrors; total += r.bitTotal; frame++;
    }
    const emp = errs / total;
    const theo = qfunc(Math.sqrt(2 * Math.pow(10, ebn0 / 10)));
    // binomial 3-sigma band + 10% model tolerance
    const sd = Math.sqrt(theo * (1 - theo) / total);
    const tol = 3 * sd + 0.10 * theo;
    check(`Eb/N0=${ebn0} dB`, Math.abs(emp - theo) <= tol,
          `emp=${emp.toExponential(3)} theo=${theo.toExponential(3)} n=${total}`);
  }
}

/* ---------------- Test E: multipath ---------------- */
console.log("Test E — static multipath, CP-sufficient vs beyond-CP");
{
  const grid = makeGrid({});
  // CP-sufficient (EVA max delay 14 < cp 16), oracle sync + oracle CSI.
  // "Equalized correctly" for uncoded QAM over frequency-selective fading
  // does NOT mean BER=0: deep-faded bins keep errors (ZF noise enhancement).
  // The correct criterion is that the measured BER matches the SEMI-ANALYTIC
  // fading BER computed from this realization's per-bin post-ZF SNRs:
  //   gamma_k = |H_k|^2 / sigma^2,  Pb(16QAM) ~ (3/8) erfc(sqrt(gamma_k/10)).
  let errsIn = 0, totIn = 0, theoAcc = 0, theoCnt = 0;
  for (let f = 0; f < 12; f++) {
    const tx = transmit({ grid, mod: "16QAM", seed: 50 + f });
    const ch = applyChannel(tx, { preset: "EVA", delay: 21,
      noise: { mode: "esn0", valueDb: 35 }, seed: 50 + f });
    const r = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "zf" });
    errsIn += r.bitErrors; totIn += r.bitTotal;
    const H = r.Htrue;
    for (const k of grid.dataBins) {
      const g = (H.re[k] ** 2 + H.im[k] ** 2) / ch.sigma2;
      theoAcc += (3 / 8) * erfc(Math.sqrt(g / 10));
      theoCnt++;
    }
  }
  const berIn = errsIn / totIn, berTheo = theoAcc / theoCnt;
  check("EVA (delay<=CP): BER matches per-bin fading theory",
        berIn < 2.5 * berTheo + 1e-5 && berIn > 0.3 * berTheo - 1e-5,
        `emp=${berIn.toExponential(2)} theo=${berTheo.toExponential(2)}`);

  // practical pilot-based CE on a mild channel (EPA, max delay 2)
  let bersP = [];
  for (let f = 0; f < 6; f++) {
    const tx = transmit({ grid, mod: "16QAM", seed: 150 + f });
    const ch = applyChannel(tx, { preset: "EPA", delay: 21,
      noise: { mode: "esn0", valueDb: 35 }, seed: 150 + f });
    const r = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
    bersP.push(r.ber);
  }
  const berP = bersP.reduce((a, b) => a + b) / bersP.length;
  check("EPA practical LS-linear CE works", berP < 5e-3, `mean BER=${berP.toExponential(2)}`);

  // beyond CP: ETU has a 100-sample tap >> cp=16 -> per-subcarrier EQ cannot
  // remove the ISI even with perfect CSI of h
  let bersOut = [];
  for (let f = 0; f < 6; f++) {
    const tx = transmit({ grid, mod: "16QAM", seed: 80 + f });
    const ch = applyChannel(tx, { preset: "ETU", delay: 21,
      noise: { mode: "esn0", valueDb: 35 }, seed: 80 + f });
    const r = receive(ch.rxIQ, tx, ch, { syncMode: "oracle", ceMethod: "perfect", eqMethod: "zf" });
    bersOut.push(r.ber);
  }
  const berOut = bersOut.reduce((a, b) => a + b) / bersOut.length;
  check("ETU (delay>CP) degrades measurably", berOut > 100 * Math.max(berIn, 1e-6),
        `beyond-CP BER=${berOut.toExponential(2)} vs within-CP ${berIn.toExponential(2)}`);
}

/* ---------------- Test F: CFO ---------------- */
console.log("Test F — CFO: ICI degrades, correction recovers");
{
  const grid = makeGrid({});
  const mk = (seed) => transmit({ grid, mod: "16QAM", seed });
  // uncorrected: demodulate at eps=0 via oracle-with-wrong-cfo
  let evmU = 0, evmC = 0, nF = 4;
  for (let f = 0; f < nF; f++) {
    const tx = mk(300 + f);
    const ch = applyChannel(tx, { preset: "AWGN", delay: 10, cfoEps: 0.30,
      noise: { mode: "esn0", valueDb: 30 }, seed: 300 + f });
    const chMetaWrong = { ...ch, trueCfoEps: 0 };     // pretend no CFO known
    const ru = receive(ch.rxIQ, tx, chMetaWrong, { syncMode: "oracle", ceMethod: "ls-linear", eqMethod: "zf" });
    const rc = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "zf" });
    evmU += ru.evm / nF; evmC += rc.evm / nF;
    if (f === 0)
      check("practical sync estimates CFO", Math.abs(rc.cfoErrEps) < 0.02,
            `eps err=${rc.cfoErrEps.toFixed(4)} subcarriers`);
  }
  check("CFO uncorrected degrades EVM", evmU > 2 * evmC,
        `EVM uncorrected=${(100 * evmU).toFixed(1)}% corrected=${(100 * evmC).toFixed(1)}%`);
}

/* ---------------- Test G: determinism ---------------- */
console.log("Test G — determinism");
{
  const grid = makeGrid({});
  const run = () => {
    const tx = transmit({ grid, mod: "64QAM", seed: 777 });
    const ch = applyChannel(tx, { preset: "EPA", delay: 13, cfoEps: 1.27,
      sfoPpm: 20, pnLinewidthHz: 50, iq: { gainDb: 0.5, phaseDeg: 2 }, dc: 0.01,
      noise: { mode: "esn0", valueDb: 25 }, seed: 777 });
    const r = receive(ch.rxIQ, tx, ch, { syncMode: "practical", ceMethod: "ls-linear", eqMethod: "mmse" });
    return { ber: r.ber, evm: r.evm, s0: ch.rxIQ.re[500], s1: ch.rxIQ.im[1234],
             fs: r.sync.frameStart, eps: r.sync.epsTotal };
  };
  const a = run(), b = run();
  check("identical seeds -> identical outputs", JSON.stringify(a) === JSON.stringify(b),
        JSON.stringify(a));
}

/* ---------------- summary ---------------- */
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
