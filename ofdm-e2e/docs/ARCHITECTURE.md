# ARCHITECTURE — OFDM E2E sample-level transceiver

Floating-point reference model of the OFDM transceiver: complex IQ samples are produced
and consumed by real array operations; no stage is computed from synthetic constellations or
analytic BER. The E2E application lives in `ofdm-e2e/`; the legacy `ofdm-sim/` is separate and unchanged.

## 1. Layers and files

| Layer | File | Responsibility |
|---|---|---|
| A — PHY engine | `js/phy/engine.js` | RNG, Gray QAM, unitary FFT, grid, pilots, preambles, transmitter, SNR helpers |
| A — receiver | `js/receiver/receiver.js` | S&C metric, synchronizer, demodulator (CP drop, FFT, CE, EQ, demap, metrics), `receive()` |
| B — channel / RF | `js/channel/channel.js` | channel presets, FIR, CFO, phase noise, SFO, AWGN, IQ, PA, DC, `applyChannel()` |
| C — experiments | `js/experiments/export.js`, `js/experiments/mc_worker.js` | JSON export/parse/regenerate; Monte-Carlo worker (BER/EVM sweep, image transmission) |
| C — UI | `index.html`, `css/style.css`, `js/app.js`, `js/visualization/plots.js` | dashboard; reads only the latest run's arrays and worker messages |
| Verification | `tests/test_phy.mjs`, `tests/test_verify.mjs`, `tests/regenerate_export.mjs` | numerical suites; export regeneration CLI |
| Docs | `theory.html`, `docs/*.md` | math reference and verification records |

`npm test` runs both suites. `npm run regen -- <file>` regenerates an export.

## 2. Data representation

- Complex arrays: `{ re: Float64Array, im: Float64Array }`, index-aligned.
- Resource grid: one `{re, im}` of length `N` per OFDM symbol, natural FFT-bin order (k=0 DC,
  k ≥ N/2 negative frequencies, guard straddles Nyquist).
- Bits: `Uint8Array`, MSB first within each symbol.
- Frame: `txIQ` of length `(2+nSym)·(cp+N)` = 2304 samples (defaults).

## 3. Processing chain and per-stage dimensions (defaults N = 128, cp = 16, nSym = 14)

| # | Stage | Function (file) | Input → output | Scaling / precision |
|---|---|---|---|---|
| 1 | bit source | `randomBits()` (engine) | seed → `Uint8Array(1260·bps)` | seeded mulberry32 |
| 2 | QAM map | `qamMap()` (engine) | bits → `{re,im}(1260)` | E_s = 1, Gray per axis |
| 3 | grid | `transmit()` (engine) | symbols → 14 grids of length 128 | pilots: m-seq BPSK on 14 bins; data on 90 bins |
| 4 | IFFT | `ifft()` (engine) | grid → 128 samples | unitary, 1/√N |
| 5 | CP | `transmit()` (engine) | 128 → 144 samples | last 16 copied to front |
| 6 | preambles | `buildPreambles()` (engine) | — → P1(144), P2(144) | P1 even-bin QPSK (period N/2); P2 full m-seq |
| 7 | framing | `transmit()` (engine) | 16 symbols → `txIQ` 2304 | `[P1, P2, data 0..13]` |
| 8 | PA | `applyPa()` (channel) | `txIQ` → `x` | Rapp p=2, A = √P_avg·10^(B/20) |
| 9 | FIR | `firConvolve()` (channel) | x (2304) → y (2304+L−1) | full convolution, Σ|h|²=1 |
| 10 | delay | `applyChannel()` | y → y (shifted by `delay`) | integer samples, zero-padded |
| 11 | CFO | `applyCfo()` (channel) | y → y·e^{j2πεn/N} | continuous n |
| 12 | phase noise | `applyPhaseNoise()` (channel) | → Wiener phase | step var 2πβ/F_s |
| 13 | SFO | `applySfo()` (channel) | → resampled at t=k(1+δ) | linear interpolation |
| 14 | AWGN | `addAwgn()` (channel) | → + CN(0,σ²) | σ² = 10^(−Es/N0/10) (or from sample SNR) |
| 15 | IQ, DC | `applyIqImbalance()`, `applyDcOffset()` | → `rxIQ` | RX-side |
| 16 | S&C | `schmidlCox()` (receiver) | `rxIQ` → M(d), P(d) over d | M ≤ 1 (both-half normalization) |
| 17 | sync | `synchronize()` (receiver) | → start, ε̂ | integer k ∈ [−4,4] by known-P2 xcorr |
| 18 | CP drop + FFT | `demodulate()` (receiver) | rx window → 128-bin FFT per symbol | unitary |
| 19 | pilot LS | `demodulate()` | Y[k_p]/X_p | — |
| 20 | CE | `linInterp()` / `dftInterp()` / perfect | Ĥ[k] for active bins | see §4 |
| 21 | EQ | `demodulate()` | ZF / MMSE per data bin | |Ĥ|² floored at 1e-12 |
| 22 | demap | `qamDemap()` (engine) | → bits | exact inverse of mapper |
| 23 | metrics | `demodulate()` | BER, EVM, MSE(Ĥ) | — |

Oracle modes replace stage 17 (`syncMode=oracle`: true delay and CFO from the channel metadata) and
the perfect-CSI option uses the true channel including the residual CFO at the window centre.

## 4. Options and their meaning

| Option | Values | Meaning | Oracle? |
|---|---|---|---|
| `syncMode` | `practical`, `oracle` | practical = S&C + known-P2 xcorr; oracle = true timing/CFO | oracle labelled in UI |
| `ceMethod` | `perfect`, `ls-linear`, `ls-dft`, `lmmse` | perfect = true H (+ residual CFO, window ramp); ls-linear = delay-compensated LS + linear interp; ls-dft = IDFT-domain smoothing; lmmse = ls-dft with Wiener weights (assumed PDP, genie σ²) | `perfect` and `lmmse` labelled |
| `eqMethod` | `zf`, `mmse` | ZF X = Y·H*/|H|²; MMSE X = Y·H*/(|H|²+σ²), σ² genie | — |
| `snrMode` | `esn0`, `ebn0`, `sample` | the noise definition used by `applyChannel()` | — |

## 5. Normalization and definitions (single source of truth)

- Unitary transforms, so time-domain noise variance equals per-bin variance.
- Es/N0 = −10 log10 σ² (E_s = 1). Eb/N0 = Es/N0 − 10 log10(log2 M).
- Sample SNR (nominal) = Es/N0 + 10 log10(N_act/N). `snrHelpers()` reports both overheads:
  CP 10 log10((N+cp)/N) = 0.5115 dB; pilot 10 log10(N_act/N_data) = 0.6272 dB.
- Sample-SNR mode calibrates σ² from the measured power of the frame.

## 6. Known architecture-level limitations

- Synchronizer: fractional-CFO accuracy degrades with phase noise (see VERIFICATION_REPORT F-4).
- SFO uses first-order interpolation.
- No channel coding; no interleaving; floating point only.
- Dashboard Monte-Carlo runs in one worker; there is no confidence interval on the plot.

## 7. Changed files in the verification task

See `VERIFICATION_REPORT.md` §8 (changed files).
