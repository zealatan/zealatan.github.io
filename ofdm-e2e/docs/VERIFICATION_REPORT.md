# VERIFICATION_REPORT — OFDM E2E golden-reference assessment

## 1. Validation status: **NOT YET VALIDATED** (PARTIAL)

Readiness for use as a floating-point golden reference for RTL comparison: **NOT YET VALIDATED.**
The chain is verified and reproducible, but one acceptance criterion fails (practical
synchronization accuracy under strong phase noise), one documentation criterion
was incomplete at the time of writing, and several features remain approximations (§6).
Per the acceptance rule: a single failed criterion blocks the "validated" label.

## 2. Environment and reproducibility

| Item | Value |
|---|---|
| Repository | `zealatan/zealatan.github.io` |
| Commit at start | `db14276` (branch `main`) |
| Working tree at start | clean (no pre-existing modifications) |
| Legacy `ofdm-sim/` | sha256 `5e4ea285…d91c8` (index.html), `37659f7c…896c4` (theory.html); unchanged vs HEAD at completion |
| Runtime | Node v24.22.1, no third-party dependencies |
| Commands | `npm test` (= `node tests/test_phy.mjs && node tests/test_verify.mjs`), `npm run regen -- <export.json>` |

No commit or deploy was made (per the authorization rule).

## 3. Results

### 3.1 Executed tests

| Suite | Checks | Passed | Failed | Not executed |
|---|---|---|---|---|
| `tests/test_phy.mjs` (legacy suite, Tests A–G) | 32 | 32 | 0 | 0 |
| `tests/test_verify.mjs` (new, sections A–L) | 126 | 125 | 1 | 0 |
| `tests/regenerate_export.mjs` (export re-import, JSON file) | 1 run | reproduced exactly | 0 | 0 |
| Browser dashboard checks (Playwright, headless Chromium) | 12 | 12 | 0 | 0 |

Only checks executed in this session are counted. The browser check suite lives in a
scratch script (see §5, remaining risks: not yet committed as a repository test).

### 3.2 The one failing criterion (kept as FAILED, not weakened)

| Check | Measured | Expected | Interpretation |
|---|---|---|---|
| S6 combined impairments: mean \|CFO err\| < 0.01 sc | 0.0139 sc (200 frames, 22 dB Es/N0, QPSK, EPA + CFO 0.35 + PN 200 Hz + SFO 20 ppm) | < 0.01 sc | Real limitation of the S&C fractional-CFO estimator under phase noise (§3.4). |

The 0.01 sc threshold was chosen before measurement and is kept. The failure is physical,
not a bug in the test: with PN = 0 (same EPA channel and SNR) the same estimator gives 0.0031 sc.

### 3.3 Monte-Carlo statistics (sample counts, seeds, standard errors)

| Experiment | Seeds | Frames | Bits / samples | Result | Criterion |
|---|---|---|---|---|---|
| QPSK AWGN Eb/N0 = 4, 6, 8 dB (test_verify D3) | 10000+f, f<1500 | 1500 each | 3.78 M bits each | 1.248e-2 / 2.392e-3 / 1.868e-4 | \|z\| ≤ 3 vs Q(√(2Eb/N0)); z = −0.01, 0.00, −0.02 |
| QPSK AWGN Eb/N0 = 2, 4, 6, 8 dB (test_phy D) | 1000+f | 300…1000 | 12.6 k … 2.09 M | agreement within 3-σ binomial band | 3σ binomial |
| 16QAM AWGN Eb/N0 = 10 dB (test_verify D4) | 20000+f, f<1500 | 1500 | 3.78 M | ratio 1.017 vs approximation | ±15 % (approximate theory) |
| EPA 16QAM 25 dB, oracle CSI (test_verify S3) | 3000+f, f<400 | 400 | 2.0 M | 2.628e-3 vs per-bin theory 2.527e-3, z = 0.02 | \|z\| ≤ 3 |
| EVA 16QAM 35 dB (test_phy E) | 50+f, f<12 | 12 | 0.2 M | 6.28e-4 vs 6.90e-4, z = −0.58 | \|z\| ≤ 3 |
| ZF noise enhancement at 60 dB (test_verify H2) | 1400+f, f<30 | 30 | — | ratio 1.003 | ±10 % |
| S&C frac-CFO std at 10/20 dB (test_verify G3) | 800+f, f<400 | 400 | — | ratio 1.08 / 1.06 | ±30 % of \(1/(\pi\sqrt{M\gamma})\) |
| S6 combined (test_verify S6) | 6000+f, f<300 | 300 | 0.76 M | BER 2.78e-3 (SE 6.2e-3, frame-correlated) | < 1e-2 |

Standard errors are batch-mean (per frame) so frame correlation is included. For the
low-error points, the SE is comparable to the value and the statistical power is limited;
the report does not claim more precision than the counts support.

### 3.4 Synchronization characterization (measured, not a pass/fail gate)

| Condition | Frac-CFO error std (sc) |
|---|---|
| AWGN, PN 0 Hz | 0.0038 |
| PN 50 Hz | 0.0093 |
| PN 200 Hz | 0.0175 |
| Timing error (all 39 delays 0…300, 30 dB) | within [−cp/2, 0] (worst |err| = 2 samples, the deliberate backoff) |

Practical sync success at moderate SNR (AWGN, CFO 0.6 sc): timing always correct; the
fractional-CFO estimate error exceeds 0.02 sc in ~10 % of frames at 10 dB Es/N0 and falls
below 1 % by 25 dB. Frame-level failures at low SNR are therefore estimation-accuracy failures,
not timing failures.

### 3.5 Full test inventory (what each suite proves)

- **test_verify A** — FFT/IFFT vs naive DFT/IDFT (N = 8…1024), Parseval, sign convention, bin placement.
- **test_verify B** — Gray adjacency (1 bit), E_s = 1 exhaustively, exact round trip for 4 modulations, bit order.
- **test_verify C** — grid partition (DC null, guard 53..75, pilot ∩ data = ∅, counts), framing length, CP copy, serialized body = IFFT(grid), CP removal + FFT = grid, P1 periodicity, preamble power, overhead formulas.
- **test_verify D** — noise calibration (sample units), Eb/N0↔Es/N0↔sample-SNR conversions, QPSK/16QAM BER vs theory.
- **test_verify E** — FIR convolution vs direct sum, tap normalization, tap indexing, H vs direct DFT, window-offset ramp, ISI beyond CP, estimated-CSI EVM bound.
- **test_verify F** — CFO (exact phase, continuity, ICI, oracle correction), SFO (tone scaling), phase noise (variance law, pure rotation), IQ imbalance (α/β, IRR), PA (AM/AM, OBO, clipping, EVM), DC (bin 0), impairment ordering.
- **test_verify G** — timing acquisition (39 delays), CFO unbiasedness and bound, S&C variance law, practical vs oracle BER.
- **test_verify H** — LS pilot error variance, ZF noise enhancement, MMSE ≤ ZF, finite outputs at deep fades, LS-MSE monotonicity.
- **test_verify I** — scenarios S1 (ideal, 4 mods), S3 (multipath, theory-anchored), S4 (CFO improvement), S5 (timing offsets), S6 (combined; one failing criterion).
- **test_verify J** — export/re-import, bit-exact regeneration, NMSE definition.
- **test_verify K** — determinism, seed sensitivity.
- **test_verify L** — documented function names in MATH_VERIFICATION.md exist in source/test code.
- **test_phy** — legacy Tests A–G (kept; two statistical tolerances tightened, see §4).

## 4. Findings and corrections

Each finding lists the evidence, the change, and the before/after numbers.

**F-1 — Phase-noise variance test (test-harness bug, fixed).** The phase-increment test
used raw differences of atan2 values, which wrap at ±π, giving 208 instead of 1.0. The
test now wraps increments to (−π, π]. Result: 0.9976 (PASS). Engine unchanged.

**F-2 — PA back-off referenced to a fixed level (engine defect, fixed).** `applyPa` used
the backoff in dB as an absolute amplitude, so the implemented output back-off on a
16QAM frame was 3.89 dB instead of the configured 3 dB. Now the saturation level is
`A = √P_avg · 10^(B/20)`, which makes the back-off relative to the measured mean
power. Result: OBO = 3.0000 dB (exact). The dashboard uses the same function, so its PA
toggle now also behaves as labelled.

**F-3 — Guard band wording (documentation defect, fixed).** The theory page said the
guard is 22 bins; the code removes bins 53..75 (23 bins: Nyquist ±11). `config.guard=22`
sets the 11+11 side bins. Test C pins the actual set. `theory.html` corrected.

**F-4 — Practical S&C CFO accuracy under phase noise (physical limitation, documented,
NOT fixed).** Measured std grows from 0.0038 to 0.0175 sc as PN goes 0 → 200 Hz. The
S&C estimator averages over a 64-sample half-symbol, and phase diffusion within that span
biases the fractional-CFO estimate. Fixing this needs a different estimator (e.g. a
longer correlation window or a CPE-aware second stage); this is an algorithm change, so it is
out of scope for this verification task. Carried as a failing criterion (S6).

**F-5 — Perfect-CSI oracle excluded the residual CFO (definition defect, fixed).** `ceMethod=perfect`
returned the static channel only, so with practical sync and CFO 0.6 sc the "perfect" baseline
produced 340 bit errors in 1.0 M bits (measured before the fix, same seeds 1100+f), while the oracle-sync baseline produced 0. The oracle now
includes the residual CFO \(\epsilon_{true}-\hat\epsilon\) at the window centre of each symbol.
Result: practical + perfect = 0 errors (test G4). Before this fix, the "perfect" label
overstated what the oracle covered.

**F-6 — S3/S5 acceptance criteria were not theory-anchored (test-criterion defect, corrected).**
Criteria such as "BER < 2e-3 on EPA at 25 dB" and "BER = 0 on EPA at 25 dB" were
absolute numbers chosen without a model. Measured per-bin Rayleigh theory gives 2.5e-3 for
the oracle case, so the absolute bound was not a valid test. Replaced by: oracle BER vs
per-bin theory (|z| ≤ 3), and penalty of LS-linear vs oracle ≤ 2.5× (measured 1.74×).
S5 is split into EPA acquisition and AWGN data recovery (theory: BER = 0 at 25 dB QPSK). The
earlier criteria are recorded here, not silently removed.

**F-7 — Dashboard showed stale sweeps (UI defect, fixed, verified in browser).**
After a settings change the Monte-Carlo curve stayed visible and the status still read
"done". Now a settings key (modulation, channel, SNR mode, sync/CE/EQ, delay, CFO, SFO, PN,
IQ/PA/DC) is recorded with each sweep; a change marks it stale, stops a running sweep, hides the old
curve, and sets the status text. Live-run re-seeding is deliberately excluded from the key.

**Also corrected (test-suite quality):**
- Removed a check that ended in `|| true` (EVA tap positions) — now an exact comparison.
- The DC bin check was rewritten from a disjunction that could pass vacuously to one exact
  magnitude check (c·√N).
- Ratio checks that divided by `max(x, 1)` could pass with zero errors; now explicit.
- test_phy's Test D tolerance was reduced from 3σ+10 % to 3σ; test_phy's EVA check
  became a z-score against per-bin theory (was a multiplicative band).
- The AWGN preset was a random-phase Rayleigh draw (|h|=1 with random angle, measured
  −180°…+180°), not a flat channel. It is now h = [1]. Before this change, AWGN BER was
  measured with a random carrier phase, and the Gray-QAM theory comparison would have
  failed without oracle CSI; the Test D numbers were recomputed after the change.

## 5. Remaining technical risks

1. **Practical sync under phase noise** (F-4): fractional-CFO accuracy degrades with linewidth; not fixed.
2. **Statistical power at low BER**: several points have fewer than 100 errors; the reported
   SE is honest but the claims at those points are weak. Long runs (≥ 10⁷ bits) are needed for
   tighter tests; not executed here for time reasons (not reported as passed).
3. **Linear SFO kernel**: first-order interpolation adds ~1e-4 relative tone error at 1000 ppm; a
   higher-order interpolator would be needed for hardware-accuracy comparison.
4. **Approximate theory curves** (16QAM Gray-QAM approximation) are labelled as approximations.
5. **Dashboard browser checks** are a scratch script (`scratchpad`), not yet a repository test. The
   browser behaviour in §3.1 is verified once, not in CI.
6. **Export re-import** verifies regeneration from config + seed + stored bits; it does not verify
   against an independent implementation (only self-consistency of the reference model).
7. **No FEC, no interleaving, no fixed-point**: out of scope; see RTL_INTERFACE_SPEC.md.
8. **Image transmission** uses hard decisions and no channel coding.

## 6. Features classified

| Feature | Classification |
|---|---|
| Gray QAM, unitary FFT, CP, grid, framing | VERIFIED |
| AWGN with Es/N0, Eb/N0, sample-SNR calibration | VERIFIED (sample mode: PARTIAL, no dedicated test) |
| FIR multipath with ISI, Rayleigh/Rician presets | VERIFIED |
| CFO, SFO, PN, IQ, DC, PA | VERIFIED (SFO kernel-limited; PA recomputed after F-2) |
| S&C + known-P2 synchronization, timing acquisition | VERIFIED (timing); PARTIAL (fractional CFO under PN, F-4) |
| Oracle sync | VERIFIED, labelled ORACLE in the UI |
| Perfect CSI | VERIFIED as oracle including residual CFO (F-5); labelled oracle |
| LS + delay-compensated linear interpolation | VERIFIED |
| ls-dft and LMMSE channel estimators | PARTIAL: LMMSE uses an assumed exponential PDP and genie σ²; ls-dft not separately validated |
| ZF / MMSE | VERIFIED (noise enhancement and ordering) |
| BER / EVM / MSE metrics | VERIFIED |
| Monte-Carlo BER sweep (worker) | VERIFIED (stale handling fixed, F-7); sample counts shown; no CI shown on the chart |
| Analytic AWGN reference curve | APPROX — labelled "theory" |
| Image transmission | VERIFIED as a data path; no coding |
| Export and regeneration | VERIFIED (self-consistency) |

## 7. Pre-existing working-tree changes

None at the start. All modifications in this task are listed in §8 below.

## 8. Changed files

Modified:
- `js/phy/engine.js` — no functional change in this task (header comment unchanged).
- `js/channel/channel.js` — `applyPa()` back-off referenced to measured power (F-2); AWGN preset is h=[1] (fixed); IQ comment corrected.
- `js/receiver/receiver.js` — perfect-CSI includes residual CFO at window centre (F-5).
- `js/experiments/export.js` — adds `gridConfig`, `parseExport()`, `regenerate()` (re-import contract).
- `js/experiments/mc_worker.js` — failed frames count as errors (no assumed 50 % guess); sync-loss count reported separately.
- `js/app.js` — sweep settings key, stale-sweep invalidation and status text (F-7), sample-SNR theory axis, stop handler; read-only `window.__e2e` for tests.
- `tests/test_phy.mjs` — Test D tolerance 3σ+10 % → 3σ; EVA check → z-score vs per-bin theory.
- `theory.html` — guard wording (F-3), PA back-off equation, perfect-CSI definition, LMMSE prior, test counts.
- `package.json` — `npm test`, `test:phy`, `test:verify`, `regen` scripts.

Added:
- `tests/test_verify.mjs` — 126-check verification suite (sections A–L).
- `tests/regenerate_export.mjs` — export re-import/regeneration CLI.
- `docs/ARCHITECTURE.md`, `docs/MATH_VERIFICATION.md`, `docs/RTL_INTERFACE_SPEC.md`, `docs/VERIFICATION_REPORT.md`.
- `tests/results/last_verify.json` — machine-readable results of the last `test_verify` run.

Removed: the root `ofdm-e2e/ARCHITECTURE.md` (superseded by `docs/ARCHITECTURE.md`).

Untouched: `ofdm-sim/` (sha256-verified).
