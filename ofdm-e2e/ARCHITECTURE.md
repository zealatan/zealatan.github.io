# OFDM E2E Live Simulator — architecture

Sample-level end-to-end OFDM transceiver running in the browser. Floating-point
reference model for Phase 1 of the OFDM digital twin (RTL / ZedBoard-AD9361
comparison phases come later). Lives at `/ofdm-e2e/`, fully independent of the
preserved legacy simulator at `/ofdm-sim/`.

## Three layers

| Layer | Files | Rule |
|---|---|---|
| A — PHY engine | `js/phy/engine.js`, `js/receiver/receiver.js` | pure math, no DOM, deterministic via seeded RNG |
| B — Channel/RF | `js/channel/channel.js` | transforms actual IQ sample arrays only |
| C — UI | `index.html`, `css/style.css`, `js/app.js`, `js/visualization/plots.js`, `js/experiments/mc_worker.js`, `js/experiments/export.js` | reads engine outputs; never computes physics |

Node test suite: `tests/test_phy.mjs` (`node tests/test_phy.mjs`, needs the
`package.json` `"type":"module"`). 32 checks, Tests A–G of the master prompt.

## Processing chain (one frame)

```
seeded bits ─ qamMap(Gray, Es=1) ─ resource grid(N=128, CP=16, DC null,
  22 guard, 14 pilots m-seq BPSK, 90 data bins) ─ unitary IFFT ─ CP
  ─ frame = [P1 Schmidl-Cox | P2 known | 14 data symbols]  → txIQ
channel (impairment order is fixed & documented):
  PA(Rapp) → delay+FIR multipath (full convolution, ISI real)
  → CFO e^{j2πεn/N} (continuous n) → phase noise (Wiener)
  → SFO (linear-interp resampling) → AWGN (Es/N0 | Eb/N0 | sample-SNR
  calibrated) → RX IQ imbalance → DC                        → rxIQ
receiver:
  S&C metric (both-half normalization + energy gate) → frac CFO
  → known-P2 xcorr over integer-CFO hypotheses → fine timing
  → first-path walk-back + 2-sample CP backoff
  → CP drop → unitary FFT → pilot LS → delay-compensated linear interp
    (or perfect/ls-dft/lmmse) → ZF|MMSE → Gray demap → BER/EVM/MSE
oracle modes (labeled in UI): true timing/CFO; true H with window-offset ramp
```

Every dashboard view renders arrays from the latest single run (`app.js`
`last`): TX/RX-pre/RX-post constellations, TX/RX time IQ, RX spectrum,
S&C metric with true-vs-detected markers, |h| stems, |H| true-vs-estimate with
received-pilot dots, Monte-Carlo BER/EVM curves (Web Worker, sample counts
shown, analytic AWGN curve dash-labeled "theory"), real image transmission
(image bits through the full chain, ~11 frames at 16QAM).

## Export (`ofdm-e2e-signals` v1)

`buildExport()` dumps config (fs, N, CP, bin ordering, complex format, symbol
indexing, pilot bins/values, normalization, seeds, channel cfg + σ², RX
settings) + every intermediate (txBits, qamSymbols, resourceGrid, ifftOut,
txIQ, h, rxIQ, fftOut, channelEstimates, equalizedSymbols, rxBits) + metrics.
This is the comparison contract for the RTL / hardware phases. No fixed-point
constraints in this reference (deliberate).

## Dependency map of the legacy simulator (studied, unmodified)

`/ofdm-sim/index.html` computes constellation/BER/EVM from an analytical noise
-variance assembly (`simulate()`, `berPoint()`): symbol-domain approximation,
no IQ chain. Its channel-estimation panel does run real math on synthetic H
(`estimateChannel()`), and its sync tab runs a real m-seq xcorr on a generated
preamble buffer (`syncTiming()`, `syncCfoFit()`), but TX→RX is never a single
sample stream. Reused ideas here: m-seq generator (pilots/P2), xcorr+phase-
slope sync concepts, dark dashboard design language. No code was imported
unverified; everything in `js/` is new and covered by the tests.

## Known limitations (honest list)

- SFO resampling uses a first-order (linear) interpolation kernel.
- `ls-dft`/`lmmse` CE smooth on the pilot-index axis of the ACTIVE band
  (non-uniform edge pilot skipped); they are band-limited approximations, and
  `lmmse` uses the genie noise variance. Default `ls-linear` is delay-
  compensated and is the verified practical path.
- `perfect` CSI covers the static FIR response (+ window offset ramp) but not
  residual-CFO common phase — pilot-based CE does track it; the oracle is a
  labeled baseline.
- No FEC in the E2E chain yet (uncoded BER everywhere).
- Phase-noise CPE is absorbed per-symbol by pilot CE; no dedicated CPE tracker.
- Image transmission uses hard decisions, no interleaving.

## Remaining tasks for the Hardware Simulator phase

1. Fixed-point (Q15) variant of the engine stages + quantization-error report
   against this floating-point reference.
2. Export format loader for cocotb/Verilator testbenches (replay txIQ/rxIQ
   into RTL, compare fftOut/eqSyms/rxBits per the schema).
3. Map the resource grid / frame structure onto the RTL_SYNC_PHASE5 numerology
   (N=256, CP=32, PSS/SSS) or port that numerology here as a config preset.
4. AD9361/ZedBoard capture import (same schema) for tier-3 comparison.
5. Optional: fractional-delay channel, CPE tracker, LDPC/Hamming FEC stage.
