# Portfolio Content TODO

Generated during the portfolio upgrade. These are the gaps between what the site now
claims and what is fully verified. Nothing fabricated was added to fill them — the
site either states things conservatively or flags the gap in-page. Prioritized
high → low.

## High priority (visible integrity/credibility issues)

1. **Broken GitHub link removed: `PY_OFDM` repo.**
   `data.js` previously linked the "Hardware-aware ML" project card to
   `https://github.com/zealatan/PY_OFDM`. That repo returns 404 and does not appear in
   your public repo list (only `realtime-Gbps-OFDM-for-Wideband`, `AI_editor_dgx`,
   `messi`, and `zealatan.github.io` are public). I removed the dead link from the
   card and the new `project-ai-phy-sync.html` page — it now only links to the demo
   video. **Action:** either make the repo public and send me the correct URL, or
   confirm there's no public repo for this project (current state is fine either way).

2. **`project-ber.jpg` chart has no legend.**
   The BER-vs-SNR chart (3 curves: dashed baseline + 2 solid) is a real image already
   in the repo, now used as evidence on the AI-sync project page — but it has no axis
   legend identifying which curve is which synchronizer/configuration. I captioned it
   honestly as "legend not yet labeled" rather than guessing. **Action:** tell me what
   each curve represents (e.g., conventional sync / offline-only CNN / offline+online
   CNN) and I'll add a proper legend and caption.

3. **USRP X410 FPGA deployment status is unconfirmed.**
   The only visual evidence (`ai_sync-poster.jpg`) shows a GNU Radio-style host flowgraph
   with live training-loss logs in a terminal — consistent with host-side processing,
   not a synthesized RTL deployment of the CNN itself. Per your instructions I did **not**
   claim FPGA deployment. **Action:** confirm how much of the pipeline (if any) runs on
   the X410's onboard RFSoC fabric vs. the host, so the page can be corrected if needed.

## Medium priority (strengthens the two strongest project pages)

4. **28 GHz MU-MIMO testbed — hardware specifics.**
   The project page currently describes the RF chain only at a high, generic level
   (baseband/SDR → RF front-end → phased array) because I could not verify exact
   hardware (make/model of SDR units, array size, channel bandwidth, number of RF
   chains) from the repo or resume. **Action:** send me the specific hardware list
   (or a link to the paper's system section) and I'll replace the generic diagram
   with an accurate one.

5. **MU-MIMO beamforming/tracking algorithm.**
   Resume says "real-time beam tracking" but no algorithm detail (e.g., codebook-based,
   channel-estimation-based, tracking update rate) is documented anywhere accessible to
   me. Not claimed on the page beyond "real-time beam tracking." **Action:** a sentence
   or two from the paper's method section would let me add a real signal-processing
   pipeline description.

6. **OFDM PHY — sustained throughput.**
   The project's own `dashboard.json` shows the "Sustained throughput" KPI at ~2.2
   (units unclear in the source file) against a 200 Msps target, only 11% complete.
   I deliberately did **not** present a Gbps/throughput headline number on the project
   page — only clock rate, BER, timing closure, utilization, and power, which are all
   marked "done" in the source data. **Action:** once that KPI closes, send the final
   Msps/Gbps figure and I'll add it as a verified result.

7. **4-modulation result is sim-only so far.**
   QPSK/16/64/256-QAM clean-loopback BER=0 is verified in simulation; only 16-QAM is
   currently confirmed BER=0 on silicon. The page labels this distinction explicitly
   (sim vs. silicon pills). **Action:** send updated status once the other three
   modulations are silicon-validated.

## Lower priority (nice-to-have polish)

8. **No dedicated demo video for the OFDM PHY project.** Only a single bench photo
   (`project-fpga.jpg`) is available. A short clip of the on-chip BER counter reading
   zero, or a waveform/constellation capture, would make this project page as visually
   convincing as the other two.

9. **Resource utilization numbers are from a specific build.** The LUT/Reg/DSP/BRAM
   percentages on the OFDM PHY page are "post-route util on the P5-13 full HIL build
   (incl. AXI DMA + smartconnects + PS block design)" per the source dashboard — i.e.
   whole-system numbers, not just the transceiver core in isolation. If you'd rather
   show core-only utilization, send that figure separately.

10. **Education section.** Added the verified Master's-thesis result (~11% transmission
    power reduction in simulation, RIS-assisted WPT) from your resume. If there's a
    published thesis or paper link for this, send it and I'll add a reference.

11. **IEEE paper page didn't render via automated fetch** (JS-rendered page), so the
    abstract/system details weren't available to cross-check the MU-MIMO project page
    against. If you can paste the abstract or a system-diagram figure from the paper,
    I can tighten the project page further.
