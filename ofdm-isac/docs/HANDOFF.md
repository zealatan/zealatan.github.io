# HANDOFF — OFDM E2E golden-reference verification

Purpose: let the next session continue without re-deriving anything. Read this file first,
then `VERIFICATION_REPORT.md` (findings, numbers) and `MATH_VERIFICATION.md` (equation traceability).

---

## 1. One-paragraph state

The OFDM E2E simulator (`ofdm-e2e/`) is a sample-level floating-point transceiver: real complex
IQ arrays flow TX → channel/RF → RX, and the dashboard renders arrays from that same run. A
verification pass was run against it. Verdict: **NOT YET VALIDATED (PARTIAL)**. The chain is
verified and reproducible; one acceptance criterion fails (practical fractional-CFO accuracy under
200 Hz phase noise); several features are approximations or unvalidated. This pass is committed locally as `c05d645`
(on top of `db14276`). **Not pushed.**

---

## 2. Repository state (as of handoff)

- Repo: `zealatan/zealatan.github.io`, branch `main`, local HEAD `c05d645` (verification pass), ahead of origin by 1.
- Remote: `origin/main` = `db14276`. `c05d645` is local only; push requires user authorization.
- **Uncommitted** (this verification pass):

| Status | Path | Purpose |
|---|---|---|
| M | `ofdm-e2e/js/app.js` | sweep stale handling (F-7), theory axis for sample SNR, stop handler, `window.__e2e` read-only test hook |
| M | `ofdm-e2e/js/channel/channel.js` | PA back-off on measured power (F-2); AWGN preset = h=[1]; IQ comment |
| M | `ofdm-e2e/js/experiments/export.js` | `gridConfig`, `parseExport()`, `regenerate()` |
| M | `ofdm-e2e/js/experiments/mc_worker.js` | failed frames count as errors (no 50 % guess); sync losses reported separately |
| M | `ofdm-e2e/js/receiver/receiver.js` | perfect-CSI includes residual CFO at window centre (F-5); S&C normalization already in base |
| M | `ofdm-e2e/package.json` | `npm test`, `test:phy`, `test:verify`, `regen` scripts |
| M | `ofdm-e2e/tests/test_phy.mjs` | Test D tolerance 3σ+10 % → 3σ; EVA check → z-score vs per-bin theory |
| M | `ofdm-e2e/theory.html` | guard wording, PA equation, perfect-CSI definition, LMMSE prior, test counts |
| ?? | `ofdm-e2e/tests/test_verify.mjs` | 126-check verification suite, sections A–L |
| ?? | `ofdm-e2e/tests/regenerate_export.mjs` | export re-import / regeneration CLI |
| ?? | `ofdm-e2e/tests/results/last_verify.json` | machine-readable output of the last `test_verify` run |
| ?? | `ofdm-e2e/docs/` | ARCHITECTURE, MATH_VERIFICATION, RTL_INTERFACE_SPEC, VERIFICATION_REPORT, HANDOFF (this file) |

- **Legacy `ofdm-sim/` is untouched**: `git diff HEAD -- ofdm-sim/` empty;
  sha256 of `index.html` = `5e4ea285…d91c8`, `theory.html` = `37659f7c…896c4` (baseline file
  `scratchpad/ofdm-sim-baseline.sha256`, may not survive; recompute from `db14276` if needed).
- Root `ofdm-e2e/ARCHITECTURE.md` was removed (superseded by `docs/ARCHITECTURE.md`), per user instruction.
- Several docs were edited outside this session during the work (the editor reported changes).
  **Re-read any document before editing it.** Do not assume the text is what this session wrote.

---

## 3. How to run everything

```bash
cd ofdm-e2e
npm test                 # test_phy (32) then test_verify (126). Currently exits 1 by design (S6).
node tests/test_phy.mjs  # 32/32 expected
node tests/test_verify.mjs   # 125/126 expected; writes tests/results/last_verify.json
npm run regen -- <export.json>   # regenerate a dashboard export; exit 0 = reproduced exactly
```

Node v24, no third-party dependencies. `package.json` has `"type":"module"` (required).

Browser checks (not yet in the repo, see §7): a Playwright script
`dash_verify.py` lives in the scratch directory
`/tmp/claude-1000/-home-messi/cee3b34b-5692-4880-89e7-56e703159a44/scratchpad/`. It runs against
`file:///…/ofdm-e2e/index.html` with `--allow-file-access-from-files`. Last result: 12/12.

Dashboard live URLs (last checked before this pass): `https://zealatan.github.io/ofdm-e2e/index.html`,
`…/theory.html`, `…/ofdm-sim/index.html` all returned 200.

---

## 4. Architecture in one screen

Files (see `docs/ARCHITECTURE.md` for the per-stage table):

- `js/phy/engine.js` — RNG (mulberry32 + Box–Muller), Gray QAM, unitary radix-2 FFT, grid
  (`makeGrid`: N=128, cp=16, DC null, guard bins 53..75, 14 pilots, 90 data bins), pilots
  (`pilotSequence`, m-seq), preambles (`buildPreambles`: P1 Schmidl–Cox, P2 known), `transmit()`,
  SNR helpers (`snrHelpers`).
- `js/channel/channel.js` — presets (`CHANNEL_PRESETS`: AWGN fixed h=[1], EPA, EVA, ETU, Rician),
  `drawChannel`, `firConvolve`, `applyCfo`, `applyPhaseNoise`, `applySfo` (linear interp), `addAwgn`,
  `applyIqImbalance`, `applyPa` (Rapp p=2), `applyDcOffset`, `applyChannel()` (order: PA → FIR →
  delay → CFO → PN → SFO → AWGN → IQ → DC).
- `js/receiver/receiver.js` — `schmidlCox` (both-half normalization + energy gate), `synchronize`
  (frac CFO from S&C; integer k ∈ [−4,4] by known-P2 xcorr; first-path walk-back; 2-sample CP
  backoff), `demodulate` (CP drop, FFT, LS pilots, CE: perfect / ls-linear / ls-dft / lmmse; ZF/MMSE;
  demap; BER/EVM/MSE), `receive()` with `syncMode` oracle|practical.
- `js/experiments/export.js` — `buildExport`, `parseExport`, `regenerate`.
- `js/experiments/mc_worker.js` — Web Worker: BER/EVM sweep (`runFrames`), image transmission.
- `js/app.js` — dashboard controller; `configKey()` / `sweepIsStale()` for sweep invalidation.
- `js/visualization/plots.js` — canvas helpers (scatter, timeSeries, lineChart, stems, freqCurves,
  spectrum, syncMetric).
- `tests/test_phy.mjs` (legacy A–G), `tests/test_verify.mjs` (A–L), `tests/regenerate_export.mjs`.

Key conventions (do not change without a test): unitary transforms both ways; `{re,im}` Float64Array;
natural FFT bin order; CFO in subcarrier units ε = Δf/(Fs/N); Es/N0 = −10log10σ² with E_s = 1;
Eb/N0 = Es/N0 − 10log10(log2 M); sample SNR = Es/N0 + 10log10(N_act/N).

---

## 5. Findings and corrections (summary; full text in VERIFICATION_REPORT §4)

| ID | Type | Status | One-line |
|---|---|---|---|
| F-1 | test bug | fixed | phase-noise increment test didn't wrap ±π (208 → 0.9976) |
| F-2 | engine defect | fixed | PA back-off used fixed amplitude (3.89 dB) → measured-power based (3.0000 dB) |
| F-3 | doc defect | fixed | guard 22 vs actual 23 bins (53..75) |
| F-4 | physical limit | **open, failing** | S&C frac-CFO error std 0.0038 → 0.0093 → 0.0175 sc at PN 0/50/200 Hz; S6 mean \|CFO err\| 0.0139 > 0.01 |
| F-5 | oracle definition | fixed | `perfect` CSI omitted residual CFO → 340 errs; now 0 (G4) |
| F-6 | criteria | corrected | absolute BER thresholds on EPA replaced by per-bin theory and a penalty bound; S5 split |
| F-7 | UI defect | fixed + browser-verified | stale sweep stayed visible; now keyed, invalidated, status text updated |

Test-quality corrections also made: removed `|| true` (EVA taps); DC check rewritten as an exact
magnitude; ratio checks no longer pass on zero errors (`max(x,1)` removed); Test D tolerance 3σ+10 % → 3σ.

---

## 6. Test status (last run in this session)

| Suite | Result |
|---|---|
| `test_phy.mjs` | 32 / 32 |
| `test_verify.mjs` | 125 / 126 — only failure: S6 CFO criterion (F-4) |
| regen CLI on smoke export | reproduced exactly (NMSE 0, bits equal, BER equal) |
| dashboard browser script | 12 / 12 (scratch, not in repo) |

Key measured numbers (for quick comparison in the next session):
- QPSK AWGN: 4 dB 1.248e-2 (theory 1.250e-2), 6 dB 2.392e-3 (2.388e-3), 8 dB 1.868e-4 (1.909e-4); 3.78 M bits each.
- EPA 16QAM 25 dB oracle CSI: 2.628e-3 vs per-bin theory 2.527e-3 (z 0.02); LS-linear penalty 1.74×.
- EVA ZF noise enhancement at 60 dB: measured/predicted EVM² = 1.003.
- S&C frac-CFO std ratio vs 1/(π√(Mγ)): 1.08 (10 dB), 1.06 (20 dB).
- CP overhead 0.5115 dB, pilot overhead 0.6272 dB.

---

## 7. Known issues and inconsistencies to fix FIRST next session

1. **Dangling reference.** `docs/MATH_VERIFICATION.md` §12 says "VERIFIED in browser (`tests/dashboard_verify`
   checks)". No such file exists in the repo. Either move `dash_verify.py` into `tests/` (and make it
   reproducible: fixed seeds, no `or True`) and fix the reference, or change the row to say "scratch only".
2. **Browser check not in repo.** `VERIFICATION_REPORT.md` §3.1 counts 12 browser checks as executed.
   They are executed, but the script is outside the repo. Report wording must stay honest until it is committed.
3. **`npm test` exits 1.** It runs `test_verify`, which contains the open S6 failure. That is intended.
   Do not weaken S6 to make it green. If it must become green for CI, split it into an explicitly
   labelled "known-failing" suite.
4. **Test count wording.** Some doc text says "32 checks" (test_phy) and some "126" (test_verify).
   Keep both numbers explicit everywhere.
5. **`MATH_VERIFICATION.md` F-1 row** reads awkwardly ("ratio 208 — FAILED … re-run shows PASS"). Rewrite
   to state the corrected result only, and point to F-1 for the history.
6. **Scratch probes** (`probe1..5.mjs`, `facts.mjs`, `mkexp.mjs`) are in the scratch directory only.
   They are not repo tests. Their conclusions are recorded in the report. Do not commit them as-is.
8. Re-check `theory.html` text after each code change. Its tests-count and guard statements were
   updated this session; a future edit could reintroduce drift. `test_verify` L only checks identifiers
   named in `MATH_VERIFICATION.md`, not the prose of `theory.html`.

---

## 8. Open technical decisions (need the user)

1. **F-4 (fractional CFO under phase noise).** Options:
   a. Accept as a documented limitation and mark the S6 criterion "known-failing"; move on to fixed-point.
   b. Improve the estimator: longer correlation window, or a CPE-aware second stage using pilots after
      the first CFO estimate. Needs a new test that shows the improvement at PN 50 and 200 Hz without
      weakening the 0.01 sc threshold.
   Recommendation: (a) for the golden-reference milestone, with an explicit note in the RTL spec that
   sync accuracy under PN is out of the comparison. Ask the user before choosing.
2. **Commit policy.** Nothing is committed. The user has to authorize the commit (and any push/deploy).
3. **Numerology for RTL comparison.** The current reference is N=128, cp=16. The parent RTL project
   (`RTL_SYNC_PHASE5`) is N=256, cp=32, 2 sync + 12 data symbols, 4032-sample slot, with a different
   pilot layout. A numerology preset that reproduces its `CONTRACT.md` is needed before any RTL
   comparison. Not implemented.

---

## 9. Next steps (ordered)

1. Resolve §7 items 1, 2, 5 (dangling reference, browser test into repo, F-1 row wording).
2. Ask the user to decide F-4 (§8.1). Record the decision in `VERIFICATION_REPORT.md` §1 and §3.2.
3. Long Monte-Carlo runs for the low-error points (QPSK 8 dB, EVA 60 dB, S6) with ≥ 10⁷ bits, fixed
   seeds, and reported SE. Put the results in the report; do not replace any criterion.
4. Missing unit coverage called out in `MATH_VERIFICATION.md`:
   - `sample` SNR mode calibration (no dedicated test)
   - `ls-dft` CE (not separately validated)
   - LMMSE: the prior is an assumed exponential PDP (`p_l ∝ e^{-0.5 l}`), not the channel's own profile.
     Either validate against a genie PDP or label it as an assumption (already labelled PARTIAL).
   - P2 preamble unit test beyond power (PARTIAL in MATH_VERIFICATION §4)
5. Commit (after the user authorizes), with a message that lists the findings and does not claim
   validation.
6. Fixed-point modelling and numerology preset (Hardware Simulator phase; see
   `RTL_INTERFACE_SPEC.md` §4–5).

---

## 10. Things that must not happen (carry-over rules)

- Do not replace a failed test with a weaker assertion. If a threshold was wrong, record the old
  threshold, the evidence, and the new criterion (as done for F-6).
- Do not describe an equation as implemented unless a computation and a test exist (MATH_VERIFICATION).
- Do not present the analytic AWGN curve as simulated data. Label it "theory".
- Do not modify `ofdm-sim/`.
- Do not commit, push, or deploy without explicit authorization.
- Do not report "validated" from a page load or a zero exit code alone. The acceptance criteria in
  VERIFICATION_REPORT §1 decide it.

---

## 11. Where things are (quick index)

| Need | Location |
|---|---|
| Verdict and failing criterion | `docs/VERIFICATION_REPORT.md` §1, §3.2 |
| Per-equation traceability | `docs/MATH_VERIFICATION.md` |
| Stage-by-stage dimensions | `docs/ARCHITECTURE.md` §3 |
| Export contract and NMSE rules | `docs/RTL_INTERFACE_SPEC.md` |
| Full check list | `tests/test_verify.mjs` (sections A–L), `tests/test_phy.mjs` (A–G) |
| Machine-readable results | `tests/results/last_verify.json` |
| Math page for users | `theory.html` |
| Legacy simulator (do not touch) | `ofdm-sim/` |
