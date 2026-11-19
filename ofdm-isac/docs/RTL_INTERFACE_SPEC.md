# RTL_INTERFACE_SPEC — golden vectors for a future Verilog OFDM transceiver

Status: specification of what the floating-point reference exports and how an RTL or hardware
result is compared against it. The reference itself is NOT yet a validated golden model
(see VERIFICATION_REPORT.md §1). Fixed-point modelling is deferred to the Hardware Simulator phase.

## 1. Vector file contract

One vector = one JSON file, schema `ofdm-e2e-signals`, version `1` (`js/experiments/export.js`).

Required header fields (`config`):

| Field | Meaning | Example |
|---|---|---|
| `sampleRateHz` | ADC/DAC rate of `txIQ`/`rxIQ` | 20e6 |
| `fftSize` | N | 128 |
| `cpLength` | cp | 16 |
| `nDataSymbols` | nSym | 14 |
| `gridConfig` | `{N, cp, nSym, guard, pilotSpacing}` — regenerates the grid | |
| `binOrdering` | string: natural order, DC=0, negative frequencies k ≥ N/2, guard straddles Nyquist | |
| `complexFormat` | `re[]/im[]` separate float64 arrays, index-aligned | |
| `symbolIndexing` | frame = [P1, P2, data 0..nSym−1]; symbol s occupies samples [(2+s)(cp+N), (3+s)(cp+N)) | |
| `activeBins`, `pilotBins`, `dataBins` | integer bin indices | |
| `pilotValues` | complex pilot symbols (same for every OFDM symbol) | |
| `modulation`, `bitsPerSymbol` | e.g. `16QAM`, 4 | |
| `normalization` | unitary FFT/IFFT; E_s = 1 | |
| `seed` | integer seed of the data bits and channel/noise streams | 7777 |
| `channel` | the full channel configuration object (preset or taps, delay, CFO, SFO, PN, IQ, PA, DC, noise, seed) | |
| `noiseSigma2` | σ² of the complex noise actually added | |
| `receiver` | `{syncMode, ceMethod, eqMethod}` | |

Signals (`signals`), each with the shape stated:

| Key | Shape | Stage |
|---|---|---|
| `txBits` | `[nDataBits]` 0/1, MSB-first per symbol | bit source |
| `qamSymbols` | `{re,im}[nDataBits/bps]` | QAM mapper |
| `resourceGrid` | `[nSym]` of `{re,im}[N]` (pilots + data, natural bin order) | grid |
| `ifftOut` | `[nSym]` of `{re,im}[N]` (unitary IFFT, no CP) | IFFT |
| `txIQ` | `{re,im}[(2+nSym)(cp+N)]` (includes CP and preambles) | CP-appended TX |
| `channelImpulseResponse` | `{re,im}[L]` (true FIR, Σ|h|²=1) | channel |
| `rxIQ` | `{re,im}[delay + frameLen + tail]` | channel output |
| `fftOut` | `[nSym]` of `{re,im}[N]` (after CP drop, unitary FFT) | FFT |
| `channelEstimates` | `[nSym]` of `{re,im}[N]` (active bins valid) | CE |
| `equalizedSymbols` | `{re,im}[nDataBits/bps]` | EQ |
| `rxBits` | `[nDataBits]` | demapper |

`metrics` (for quick comparison): `ber`, `bitErrors`, `bitTotal`, `evmRms`, `mseH`,
`syncErrSamples` (start − true start), `cfoErrSubcarriers`, `trueDelay`, `trueCfoEps`.

## 2. Test-ID and reproducibility rule

A vector is reproducible iff `regenerate(doc)` (see `tests/regenerate_export.mjs`) returns
zero NMSE and identical bits for every stored array. This was verified for the smoke vector
(16QAM, EPA, CFO 0.4 sc, 20 dB Es/N0): every array reproduced exactly (max |diff| = 0, bits equal).

Recommended naming: `<testId>_<mod>_<channel>_seed<NNNN>.json`, with `testId` naming the
experiment (e.g. `S3_EPA_16QAM_25dB`). The `seed` field is authoritative.

## 3. Numerical comparison rules

Let x_REF be the reference (this model) and x_RTL the hardware/RTL output, both as complex arrays
of the same length after alignment.

| Metric | Definition | Use |
|---|---|---|
| NMSE | \( \sum_n |x_{RTL}[n]-x_{REF}[n]|^2 \,/\, \sum_n |x_{REF}[n]|^2 \) | primary signal comparison |
| max abs error | \( \max_n |x_{RTL}[n]-x_{REF}[n]| \) | catches isolated saturation/glitch |
| relative max error | \( \max_n |x_{RTL}[n]-x_{REF}[n]| \,/\, \max_n |x_{REF}[n]| \) | scale-free, quantization budget |
| EVM difference | \(|\mathrm{EVM}_{RTL}-\mathrm{EVM}_{REF}|\) | constellation-level agreement |
| BER difference | must be **exactly 0** for an integer-exact pipeline; for fixed-point, compare bit errors per frame | decision-level agreement |

Pass criteria (proposed, to be fixed when the fixed-point design exists):
- Floating-point reference against itself: NMSE = 0.
- Fixed-point RTL against this reference: NMSE and max error must be inside a bound derived
  from the quantization budget of the chosen word lengths; bit-exact agreement is **not** required.
- Bit decisions: count of differing bits; the report must show the value and not a pass/fail only.

Alignment: RTL outputs must be aligned to the same symbol and sample indices (`symbolIndexing`).
Frame start mismatch must be resolved (sync offset) or the oracle sync mode used, and the mode
must be recorded.

## 4. What fixed-point must model (Hardware Simulator phase)

| Effect | Where it enters | Required model |
|---|---|---|
| Input IQ quantization | `txIQ`, `rxIQ` | word length, rounding mode, saturation at ADC/DAC |
| Twiddle quantization | FFT/IFFT | twiddle ROM width; rounding per stage |
| Butterfly scaling | FFT/IFFT | unitary 1/√N must be realised as per-stage shifts; overflow/saturation policy |
| CFO rotator | CFO correction | NCO phase width, cos/sin table quantization |
| S&C / xcorr arithmetic | synchronizer | accumulator width, atan2 approximation (CORDIC iterations, see the digital-twin CORDIC block) |
| Channel estimate | CE | divider precision, interpolation arithmetic, LMMSE weights |
| Equalizer | EQ | reciprocal LUT (`1/|H|²`) precision; zero-guard threshold ↔ the 1e-12 floor |
| Demapper | demap | threshold/level quantization; Gray table |
| Pipeline latency | all stages | latency per block in cycles; alignment of the output stream to `symbolIndexing` |
| Saturation | every stage | overflow counters exported for comparison |

The floating-point reference deliberately has none of these effects. The RTL comparison must
therefore report NMSE per stage (not only end-to-end BER), so that a mismatch can be attributed to a
block.

## 5. Mapping to the RTL_SYNC_PHASE5 numerology (future work)

The parent RTL project uses N = 256, cp = 32, 2 sync + 12 data symbols, 4032-sample slot,
and a different pilot layout. To compare against it, a numerology preset must be added that
reproduces its `CONTRACT.md` exactly. This is NOT implemented here; the current reference uses
N = 128, cp = 16 defaults, and the comparison must state which numerology was used.

## 6. Re-import checklist

1. Parse with `parseExport(text)`; schema/version mismatch throws.
2. Regenerate with `regenerate(doc)` (or `npm run regen -- file.json`).
3. Check every stored array's max abs difference = 0 and bit equality.
4. Compare the RTL vector set against the stored `signals` with the rules in §3.
5. Record the test ID, seed, channel configuration, and numerology in the comparison report.
