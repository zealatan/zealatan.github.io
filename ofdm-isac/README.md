# OFDM-ISAC research simulator

This is an independent copy of `../ofdm-e2e/`. The copied communication dashboard and its PHY/channel/receiver modules retain their original numerology and behavior. New sensing code is isolated under `js/isac/` and a new section in this copy's `index.html`.

The web default is **FFT 128, CP 16, 14 data symbols + two preambles, 20 Msps**. It differs from the hardware-oriented 256/32/12-data-symbol reference in `~/zedboard-digital-twin/algorithm_sim/ofdm/`. The new sensing train concatenates complete copied OFDM frames with successive data seeds and processes all symbols, including known preambles, on a contiguous slow-time grid. Target echo delays are monostatic round trips; Doppler phase is continuous across frames. The receiver uses ideal known TX timing and symbols, masks null bins, performs point-wise division, range IFFT, Doppler FFT, and ranked peak detection. The sample delay uses linear interpolation and therefore does not support precision sub-bin accuracy claims.

## Run

Serve this directory with a static HTTP server and open `index.html`. The original dashboard runs above the new sensing laboratory. Sensing is recomputed when **Run sensing** is clicked.

```sh
cd ~/zealatan.github.io/ofdm-isac
python -m http.server 8000
```

The new JavaScript sensing tests run independently with `npm run test:isac`. Existing communication tests remain `npm run test:phy` and `npm run test:verify`. Initial copy verification: `test:phy` passed 32/32; original and copied `test:verify` produced byte-identical logs with 125 passes and one pre-existing S6 combined CFO-mean threshold failure (`0.0139` vs `<0.01` subcarriers). Do not represent `npm test` as fully green until that original baseline issue is resolved and justified.

## Research foundation

The source-backed literature review, independent NumPy reference, paper experiment classification, tests, and original figures are in `~/zedboard-digital-twin/isac_research/`. See `docs/OFDM_COMPATIBILITY.md` there for exact interfaces and the coherent-processing plan. The current web sensing panel is a synthetic, perfect-synchronization demonstration; it does not model full-duplex leakage, absolute radar power, or RF hardware.
