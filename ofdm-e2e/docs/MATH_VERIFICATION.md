# MATH_VERIFICATION — equation ↔ code ↔ test traceability

Scope: `ofdm-e2e/` at commit `db14276` plus the working-tree changes listed in
`VERIFICATION_REPORT.md`. Every equation below names the function that computes it,
the test(s) that exercise it, and a status:

- **VERIFIED** — implementation matches the equation and a numerical test passes.
- **VERIFIED (stat)** — matches theory within a stated statistical criterion (frames, bits, SE).
- **PARTIAL** — implemented and tested, with a documented limitation.
- **FAILED** — a test fails; see the report.
- **APPROX** — approximate theory or an approximation in the implementation, labeled as such.

Sign / unit conventions used throughout: complex samples as `{re, im}` `Float64Array`s;
angles in radians; CFO and offsets in subcarrier units (`ε = Δf / Δf_sc`, `Δf_sc = Fs/N`)
unless stated; power per complex sample; `N = 128`, `cp = 16`, `Fs = 20 MHz` (defaults).

---

## 1. Unitary FFT / IFFT

| Equation | Source | Tests | Status |
|---|---|---|---|
| \(x[n]=\frac{1}{\sqrt N}\sum_k X[k]e^{+j2\pi kn/N}\) | `ifft()` → `fftRadix2(inverse=true)` | test_verify A (vs naive IDFT, N ≤ 1024) | VERIFIED |
| \(X[k]=\frac{1}{\sqrt N}\sum_n x[n]e^{-j2\pi kn/N}\) | `fft()` → `fftRadix2(inverse=false)` | test_verify A (vs naive DFT) | VERIFIED |
| \(\mathrm{FFT}(\mathrm{IFFT}(X))=X\) | — | test_verify A, N=8..1024, max err ≤ 1.3e-12 | VERIFIED |
| Parseval \(\sum|x|^2=\sum|X|^2\) | — | test_verify A, rel err ≤ 1.3e-15 | VERIFIED |
| Sign: \(e^{+j2\pi k_0n/N}\) → forward FFT bin \(k_0\), magnitude \(\sqrt N\) | — | test_verify A (sign) | VERIFIED |

Numerical precision: float64 radix-2 with per-stage twiddle recurrence; measured errors
are ≤ 1.3e-12 for N ≤ 1024 (test values above).

## 2. QAM mapping / demapping

| Equation | Source | Tests | Status |
|---|---|---|---|
| Levels \(v_i=2i-(L-1)\), Gray \(g(i)=i\oplus(i\gg1)\) | `qamTables()`, `qamMap()` | test_verify B (adjacent levels differ in 1 bit) | VERIFIED |
| \(E_s=1\): \(c=(2\cdot\frac1L\sum v_i^2)^{-1/2}\) | `qamTables()` `norm` | test_verify B (exhaustive E_s = 1) | VERIFIED |
| Bit order: [I-axis MSB-first \| Q-axis MSB-first] | `qamMap()`, `qamDemap()` | test_verify B (16QAM 1000 → (+3,−3)/√10; QPSK 11 → (+1,+1)/√2) | VERIFIED |
| Hard demapping = inverse of mapping | `qamDemap()` | test_verify B (all patterns, all 4 mods); test_phy B | VERIFIED |

Modulations: QPSK (2 b/sym), 16QAM (4), 64QAM (6), 256QAM (8). Gray-coded per axis.

## 3. Resource grid, pilots, framing, CP

| Equation / rule | Source | Tests | Status |
|---|---|---|---|
| Active bins \(k\in\{1..N-1\}\setminus\text{guard}\), guard = bins 53..75 (23 bins: Nyquist ±11) | `makeGrid()` | test_verify C | VERIFIED (see finding F-3 for the guard-size wording) |
| DC \(k=0\) nulled | `makeGrid()` | test_verify C | VERIFIED |
| Pilots = every 8th active bin + upper edge (14); data = rest (90) | `makeGrid()` | test_verify C (∩ = ∅, ∪ = active, counts) | VERIFIED |
| Pilot values: m-sequence BPSK, \(x_i=x_{i-3}\oplus x_{i-7}\), seed 1110110 | `pilotSequence()` | test_verify C (via pilot-LS error variance H1) | VERIFIED |
| Frame = \([P1, P2, \text{data}_{0..13}]\), each \(cp+N\) samples | `transmit()` | test_verify C (length 2304) | VERIFIED |
| CP = last \(cp\) samples of the body, prepended | `transmit()`, `ifft()` | test_verify C (exact copy) | VERIFIED |
| CP removal + FFT recovers the grid | `receive()` → `demodulate()` | test_verify C (max err 3e-15) | VERIFIED |
| CP overhead \(10\log_{10}\frac{N+cp}{N}=0.5115\) dB; pilot overhead \(10\log_{10}\frac{N_{act}}{N_{data}}=0.6272\) dB | `snrHelpers()` | test_verify C | VERIFIED |

## 4. Preambles (synchronization structure)

| Equation | Source | Tests | Status |
|---|---|---|---|
| P1: even active bins loaded with fixed-seed QPSK ⇒ time body has period \(N/2\) | `buildPreambles()` | test_verify C (periodicity exact) | VERIFIED |
| P1 and P2 power ≈ data-symbol power (±2 %) | `buildPreambles()` | test_verify C (measured 1.003) | VERIFIED |
| P2: all active bins loaded with the m-sequence BPSK (fully known) | `buildPreambles()`, `pilotSequence()` | used by oracle-free fine timing; covered through test_phy C / S5 | PARTIAL (no isolated unit test of P2 power beyond C) |

## 5. SNR definitions and AWGN

| Equation | Source | Tests | Status |
|---|---|---|---|
| \(\sigma^2 = 10^{-E_s/N_0/10}\) (sample units, unitary FFT, \(E_s=1\)) | `applyChannel()` noise branch, `snrHelpers()` | test_verify D1 (measured 1.027, tolerance 4 SE = 0.114 at 0 & 10 dB) | VERIFIED (stat) |
| \(E_b/N_0 = E_s/N_0 - 10\log_{10}\log_2 M\) | `snrHelpers().esn0FromEbn0`, `applyChannel()` `ebn0` mode | test_verify D2 (13.0103 dB for 10 dB QPSK) | VERIFIED |
| sample SNR \(=E_s/N_0+10\log_{10}(N_{act}/N)\) | `snrHelpers().sampleSnrFromEsn0` | test_verify D2 (9.0982 dB) | VERIFIED |
| `sample` mode: noise power from the measured frame power | `applyChannel()` | — | PARTIAL (no dedicated calibration test) |
| BER(QPSK, AWGN) \(=Q(\sqrt{2E_b/N_0})\) | whole chain, `receive()` oracle | test_verify D3 (4/6/8 dB, \|z\|≤3, 3.78M bits each); test_phy D (4 points) | VERIFIED (stat) — z = −0.01, 0.00, −0.02 |
| 16QAM AWGN vs Gray-QAM approximation \(\frac38\,\mathrm{erfc}\sqrt{\gamma/10}\) | whole chain | test_verify D4 at 10 dB, ratio 1.017 within ±15 % | APPROX — approximation is theory-labeled, not exact |

## 6. Multipath channel

| Equation | Source | Tests | Status |
|---|---|---|---|
| \(y[n]=\sum_\ell h[\ell]x[n-\ell]\), full length \(n_x+L-1\) | `firConvolve()` | test_verify E (vs direct sum, err 0) | VERIFIED |
| \(\sum_\ell|h[\ell]|^2=1\) | `drawChannel()` | test_verify E (120 draws, err 5.6e-16) | VERIFIED |
| Tap index = delay; tap length = max delay + 1 | `drawChannel()`, `CHANNEL_PRESETS` | test_verify E (EVA non-zero taps exactly {0,1,3,6,9,14}) | VERIFIED |
| \(H[k]=\sum_\ell h[\ell]e^{-j2\pi k\ell/N}\) (physical, \(\sqrt N\)-scaled) | `receive()` `Htrue` (oracle) | test_verify E (vs independent direct sum, err 2e-14) | VERIFIED |
| Window-offset ramp \(e^{+j2\pi k\tau/N}\) in the true H | `demodulate()` | test_verify E (EVA noiseless, τ=−2, EVM 1e-15) | VERIFIED |
| ISI when delay spread > CP (ETU, 100-sample tap, cp = 16) | whole chain | test_verify E (EVM 0.625 with perfect CSI); test_phy E | VERIFIED |
| Rayleigh fading BER per bin \(\frac38\mathrm{erfc}\sqrt{\gamma_k/10}\) | whole chain, oracle CSI | test_verify S3 (EPA, z within ±3); test_phy E (EVA, z = −0.58) | VERIFIED (stat) |

## 7. RF impairments (signal-domain)

| Equation | Source | Tests | Status |
|---|---|---|---|
| CFO \(y[n]\leftarrow y[n]e^{j2\pi\epsilon n/N}\), continuous index | `applyCfo()` | test_verify F1 (exact, err 4e-16) | VERIFIED |
| SFO \(y[k]=x(k(1+\delta))\) by linear interpolation | `applySfo()` | test_verify F2 (tone scaling, rel err 1.25e-4 at 1000 ppm, tol 2e-4) | VERIFIED (kernel-limited) |
| Phase noise \(\phi_{n+1}=\phi_n+w_n\), \(\mathrm{Var}(w)=2\pi\beta/F_s\) | `applyPhaseNoise()` | test_verify F3 (ratio 208 — **FAILED**, see finding F-1 — test-side bug fixed; re-run shows PASS) | VERIFIED after correction (stat, 2 %) |
| IQ imbalance \(I'=I,\ Q'=g(\sin\varphi I+\cos\varphi Q)\) | `applyIqImbalance()` | test_verify F4 (tone = \|α\|, image = \|β\|, IRR 22.85 dB) | VERIFIED |
| Rapp PA \(G(|x|)=(1+(|x|/A)^{2p})^{-1/2p}\), \(A=\sqrt{P_{avg}}10^{B/20}\) | `applyPa()` | test_verify F5 (AM/AM exact; OBO = 3.0000 dB) | VERIFIED (**corrected**, finding F-2) |
| DC \(y\leftarrow y+dc\) → FFT bin 0 with magnitude \(dc\sqrt N\) | `applyDcOffset()` | test_verify F6 (exact; EVM unchanged) | VERIFIED |
| Ordering PA→FIR→CFO→PN→SFO→AWGN→IQ→DC | `applyChannel()` | test_verify F7 (exact reproduction) | VERIFIED |

## 8. Synchronization

| Equation | Source | Tests | Status |
|---|---|---|---|
| S&C \(P(d)=\sum_{n<N/2}r^*[d+n]r[d+n+N/2]\), \(M=|P|^2/(R_1R_2)\le 1\) | `schmidlCox()` | test_verify G3 (frac-CFO std vs \(1/(\pi\sqrt{M\gamma})\) within 30 %: ratios 1.08 / 1.06) | VERIFIED (stat) |
| \(\hat\epsilon_{frac}=\angle P(d_{max})/\pi\) | `synchronize()` | test_verify G2 (unbiased, \|mean\| < 3e-3 sc, max < 0.02 sc at 25 dB) | VERIFIED (stat) |
| Integer CFO by known-P2 xcorr over \(k\in[-K,K]\) | `synchronize()` | test_verify G2 (ε ∈ [−0.9, 0.95]); test_phy F | VERIFIED |
| Timing = argmax xcorr, first-path walk-back, −2-sample CP backoff | `synchronize()` | test_verify G1 (39/39 delays 0..300, error ∈ [−cp/2, 0]) | VERIFIED |
| Oracle synchronization (true delay & CFO) | `receive()` `syncMode=oracle` | used as the baseline in D, E, H, S3 | VERIFIED (labelled ORACLE in UI) |
| Practical CFO error vs PN linewidth | `synchronize()` | test_verify S6 — **FAILED** criterion (mean \|CFO err\| 0.0139 > 0.01 sc, PN 200 Hz) | FAILED (physical limit, see F-4) |
| Sync-induced BER penalty | `receive()` | test_verify G4 (practical + perfect CSI: 0 errors; oracle: 0 errors) | VERIFIED (after F-5 fix) |

## 9. Channel estimation

| Equation | Source | Tests | Status |
|---|---|---|---|
| LS pilot estimate \(\hat H_p=Y/X_p\) | `demodulate()` | test_verify H1 (error variance = σ² within 5 %, measured 0.9935) | VERIFIED (stat) |
| Delay-compensated linear interpolation (phase-slope removal, linear interp, ramp re-application) | `linInterp()` | test_phy C (EVM ≈ 1e-13 at −2-sample offset); test_verify E/S3 | VERIFIED |
| Perfect CSI incl. residual CFO at window centre | `demodulate()` (`ceMethod=perfect`) | test_verify G4 (0 errors vs oracle 0) | VERIFIED (after F-5 fix) |
| DFT-domain (ls-dft) and LMMSE tap weighting | `dftInterp()` | test_verify H5 (LS-linear MSE monotone in SNR); ls-dft/lmmse not separately validated | PARTIAL — the LMMSE prior is an assumed exponential PDP, not the channel's own |
| CE MSE \(\frac{1}{|\mathcal A|}\sum|\hat H-H|^2\) monotone decreasing with SNR (EPA) | `demodulate()` | test_verify H5 (7.2e-1 > 7.1e-2 > 7.3e-3 > 1.0e-3) | VERIFIED |

## 10. Equalization

| Equation | Source | Tests | Status |
|---|---|---|---|
| ZF \(\hat X=Y\hat H^*/\max(|\hat H|^2,10^{-12})\) | `demodulate()` | test_verify H2 (noiseless exact at 60 dB, EVM 2e-3 — see finding F-6) | VERIFIED |
| MMSE \(\hat X=Y\hat H^*/(|\hat H|^2+\sigma^2)\) | `demodulate()` | test_verify H3 (MSE_MMSE ≤ MSE_ZF at 0 & 10 dB), H2 (MMSE→ZF at 60 dB) | VERIFIED |
| ZF noise enhancement \(\mathrm{EVM}^2=\mathrm{mean}_k\,\sigma^2/|H_k|^2\) | — | test_verify H2 (ratio 1.00 at 60 dB, ±10 %) | VERIFIED (stat) |
| Deep fades guarded: finite outputs at −5 dB, ETU, 256QAM | `demodulate()` | test_verify H4 (0 non-finite values in 120 runs) | VERIFIED |

## 11. Metrics

| Equation | Source | Tests | Status |
|---|---|---|---|
| \(\mathrm{BER}=\#\{\hat b\ne b\}/N_b\) | `demodulate()` | test_verify D, I; test_phy D | VERIFIED |
| \(\mathrm{EVM}=\sqrt{\sum|\hat X-X|^2/\sum|X|^2}\) | `demodulate()` | test_verify I (S1 EVM < 1e-9 ideal); test_phy C | VERIFIED |
| \(\mathrm{MSE}_{\hat H}\) | `demodulate()` | test_verify H1, H5 | VERIFIED |
| Batch-mean standard error of BER | `berBatch()` in `tests/test_verify.mjs` (test code, not engine) | all statistical tests | VERIFIED (test harness; see report §4) |
| NMSE \(\sum|x_{RTL}-x_{REF}|^2/\sum|x_{REF}|^2\) | `regenerate()` `cmpC()` | test_verify J (0 for identical arrays) | VERIFIED |

## 12. Dashboard-only computations

| Quantity | Source | Status |
|---|---|---|
| Analytic AWGN BER reference curve (dashed) | `theoreticalBer()` in `js/app.js` | APPROX, labelled "theory" on the chart — never substituted for simulated points |
| Monte-Carlo BER/EVM points | `runFrames()` in `js/experiments/mc_worker.js` | VERIFIED — sample counts displayed; stop rule is error target or bit cap |
| Stale sweep | `configKey()` / `sweepIsStale()` in `js/app.js` | VERIFIED in browser (`tests/dashboard_verify` checks) |

---

## Corrections made during this verification

See `VERIFICATION_REPORT.md` §3 for the full list (F-1 … F-7), with before/after numbers.
