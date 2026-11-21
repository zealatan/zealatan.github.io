export const profile = {
  name: "Bumhee Lee",
  subtitle: "Wireless PHY Engineer — Algorithm to Verified Silicon",
  tagline: "RF/DSP Algorithm Design · FPGA/RFSoC Implementation · Bit-Exact Hardware Verification",
  intro:
    "I take wireless PHY from DSP algorithm to verified silicon — designing synchronization, channel-estimation and OFDM radar-sensing algorithms, implementing them on FPGA/RFSoC, and validating them end-to-end against bit-exact golden models and on real radios. Backed by industry experience in FPGA-based SoC validation and cellular modems.",
  email: "zealatan@gmail.com",
  linkedin: "https://www.linkedin.com/in/bumhee-lee-357417138/",
  github: "https://github.com/zealatan",
  resumeUrl: "assets/resume.pdf",
};

export const nav = [
  { label: "Portfolio", href: "index.html" },
  { label: "ISAC", href: "index.html#isac" },
  { label: "Demos", href: "demos.html" },
  { label: "GitHub", href: profile.github },
];

export const isacFeature = {
  eyebrow: "Flagship · hardware-verified end-to-end",
  title: "OFDM ISAC — Communication Waveform as Radar, Verified on AD9361 Hardware",
  summary:
    "The same OFDM waveform that carries data is reused, unchanged, as a radar — and the full chain is validated on a real ZedBoard + FMCOMMS3 (AD9361) radio, not only in simulation. Reciprocal filtering divides out the QAM symbols, a 2-D FFT forms a Range-Doppler map, and a live walking person is isolated at +15.9 dB over a static control. Frame sync is unified on the communication preamble correlator, so the comm PHY and the radar share one timebase (equivalence measured on hardware)." +
    "<img src='assets/isac-walking-detection.png' alt='Measured Range-Doppler map: live walking human detected at +15.9 dB over a static control' style='display:block;width:100%;max-width:620px;margin-top:.9em;border-radius:8px;border:1px solid rgba(0,0,0,.08);' />" +
    "<img src='assets/isac-eqs.png' alt='OFDM radar signal model: frequency-domain channel and reciprocal filtering' style='display:block;width:100%;max-width:520px;margin-top:.8em;border-radius:8px;border:1px solid rgba(0,0,0,.08);background:#fff;' />",
  steps: ["OFDM RF loopback — BER 0", "Range-Doppler + MTI", "Live human detection +15.9 dB"],
  details: [
    "16-QAM OFDM RF loopback through the real radio at BER 0 / 4420 bits (link EVM 1.8%, 34.8 dB SNR)",
    "Range-Doppler validated against ground truth at offset-0 bins (synthetic), then run on measured IQ",
    "Live walking human detected +15.9 dB over a 4-capture static control; direct leakage nulled at 0-Doppler (CFO ≈ 0)",
    "Timebase unified on the preamble correlator — comm-sync and full-buffer correlator agree to the sample on hardware",
  ],
  note: "The interactive simulator linked above is a synthetic baseband model (ideal sensing timing); the results described here are measured on an AD9361 radio.",
  link: { label: "Open the interactive ISAC simulator (synthetic model) →", href: "ofdm-isac/index.html" },
};

export const projects = [
  {
    badge: "E2E PHY Reference",
    title: "OFDM E2E Live Simulator — Sample-Level Transceiver",
    summary:
      "True end-to-end OFDM chain on complex IQ samples, entirely in the browser: Gray-QAM → pilot grid → unitary IFFT → CP → FIR multipath/CFO/SFO/phase-noise/PA/IQ channel → Schmidl-Cox + known-preamble sync → LS channel estimation → ZF/MMSE → recovered bits. 32-check numerical test suite (BER matches Q(√(2Eb/N0)) and per-bin fading theory), Monte-Carlo BER/EVM in a worker, real image transmission, and versioned IQ test-vector export for RTL/hardware digital-twin comparison.",
    tags: ["OFDM", "Sample-Level IQ", "Schmidl-Cox", "Monte-Carlo BER", "Digital Twin"],
    image: null,
    detailUrl: null,
    links: [
      { label: "Open E2E Simulator →", href: "ofdm-e2e/index.html" },
      { label: "Math Reference →", href: "ofdm-e2e/theory.html" },
    ],
  },
  {
    badge: "Hardware RF Loopback",
    title: "ZedBoard + AD9361 — OFDM over a Real Radio",
    summary:
      "The sample-level E2E chain, taken to real silicon. A ZedBoard + FMCOMMS3 (AD9361) was brought up entirely over JTAG on an aarch64 host — no SD card, no Vivado: program the PL bitstream, run ps7_init, load and launch the ADI no-OS AD9361 application. A 16-QAM OFDM waveform is then transmitted through the actual RF chain — DAC → TX1A → SMA cable → RX1A → ADC — and recovered at BER 0 / 4420 bits, link EVM 1.8% (34.8 dB SNR). Control runs through a from-scratch libiio serial backend speaking the no-OS IIOD protocol over UART, with a live constellation / spectrum / BER monitoring GUI.",
    tags: ["AD9361 / FMCOMMS3", "JTAG bring-up", "libiio / IIOD", "OFDM RF Loopback", "BER = 0"],
    image: "assets/zedboard-ofdm-loopback.png",
    detailUrl: null,
    links: [],
  },
  {
    badge: "Live Simulator",
    title: "OFDM Live Dashboard — In-Browser PHY Simulator",
    summary:
      "Real-time OFDM link simulator running entirely in the browser: synchronizer (preamble timing, coarse/fine CFO, CPE/SFO tracking) and channel estimator (LS/LMMSE with Linear/FFT/2D/CNN interpolation, BER-vs-SNR across AWGN/EPA/EVA/ETU/Rician, FEC) — plus live image transmission through the link.",
    tags: ["OFDM", "CNN Channel Est.", "Synchronization", "BER / EVM", "Vanilla JS"],
    image: null,
    detailUrl: null,
    links: [
      { label: "Open Live Simulator →", href: "ofdm-sim/index.html" },
      { label: "Math Reference →", href: "ofdm-sim/theory.html" },
    ],
  },
  {
    badge: "RTL Explorer",
    title: "Interactive RTL Architecture Explorer — OFDM Transceiver",
    summary:
      "Source-accurate, recursively navigable schematic explorer for the FPGA OFDM transceiver RTL (52 modules, 65 instances, 9 hierarchy levels), generated from a real Verilator elaboration — resolved bus widths, parameter overrides, actual connectivity, measured cycle-accurate streaming traces. Includes Design Insights: ten interactive engineering chapters (pipelining, AXI-Stream backpressure, multi-bank memory scheduling, fixed-point/BFP, verification methodology, FPGA resources) built on this design's real measured before/after throughput story, with interview-prep Q&A per chapter.",
    tags: ["Verilog RTL", "Verilator Elaboration", "Interactive SVG", "Throughput Audit", "Interview Prep"],
    image: null,
    detailUrl: null,
    links: [
      { label: "Open RTL Explorer →", href: "rtl-explorer/index.html" },
      { label: "Design Insights →", href: "rtl-explorer/index.html#/insights/pipelining" },
      { label: "RTL GitHub →", href: "https://github.com/zealatan/realtime-Gbps-OFDM-for-Wideband" },
    ],
  },
  {
    badge: "Real-Time PHY",
    title: "Real-Time FPGA OFDM PHY",
    summary:
      "Mode-selectable OFDM transceiver in Verilog, verified bit-exact against a C/NumPy golden model and proven on ZCU216 RFSoC silicon.",
    tags: ["RTL / Verilog", "RFSoC (ZCU216)", "Fixed-point DSP", "AXI-Stream"],
    image: "assets/project-fpga.jpg",
    detailUrl: "project-ofdm-phy.html",
    links: [
      { label: "GitHub →", href: "https://github.com/zealatan/realtime-Gbps-OFDM-for-Wideband" },
    ],
  },
  {
    badge: "mmWave MIMO",
    title: "28 GHz mmWave MU-MIMO Testbed",
    summary:
      "Programmable multi-user MIMO testbed with real-time beam tracking, built and demonstrated OTA; first-author paper at IEEE WCNC 2025.",
    tags: ["28 GHz", "MU-MIMO", "Beam Tracking", "OTA Validation"],
    image: "assets/testbed-poster.jpg",
    detailUrl: "project-mmwave-mimo.html",
    links: [
      { label: "Paper →", href: "https://ieeexplore.ieee.org/document/10978370" },
      { label: "Demo →", href: "demos.html" },
    ],
  },
  {
    badge: "Hardware-Aware AI",
    title: "Hardware-Aware ML for PHY Synchronization",
    summary:
      "Two-stage CNN-based synchronizer with offline-trained filters and online calibration, demonstrated on a USRP X410 SDR under harsh channel conditions.",
    tags: ["2-Stage CNN", "USRP X410", "Online Training"],
    image: "assets/project-ber.jpg",
    detailUrl: "project-ai-phy-sync.html",
    links: [{ label: "Demo →", href: "demos.html" }],
  },
];

export const experience = [
  {
    org: "RWTH Aachen University",
    location: "Aachen, Germany",
    roleLine: "Research Assistant, Chair for Distributed Signal Processing",
    dateRange: "Aug 2023 – Aug 2026",
    description: null,
    highlights: [
      "Developed multi-rate, Gbps-class high-speed OFDM transceiver systems on RFSoC.",
      "Designed an AI-native neural synchronizer on SDR.",
      "Built a programmable 28 GHz MU-MIMO testbed with real-time beam tracking.",
    ],
    roles: null,
  },
  {
    org: "Samsung Electronics (System LSI)",
    location: "Hwaseong, South Korea",
    roleLine: "SoC FPGA Validation, Modem Protocols, and NPU Algorithm Research",
    dateRange: null,
    description: null,
    roles: [
      {
        title: "Algorithm Researcher — Next Generation Task Force",
        dateRange: "Nov 2017 – May 2018",
        description:
          "Researched memory-efficient neural network optimization for NPUs (NAS, quantization, pruning) and conducted model compression to reduce inference memory footprint; generated fixed-point test vectors for NPU verification.",
      },
      {
        title: "Software Engineer — Protocol Team",
        dateRange: "Sep 2015 – Oct 2017",
        description:
          "Developed HRPD (High-Rate Packet Data) protocol features, designed Layer-1 downlink modules for mobility and cell management per 3GPP2 C.S0074, and resolved Layer-1 issues in closed-loop power control, HARQ, and symbol detection.",
      },
      {
        title: "FPGA Test Engineer — Multimedia Core Team",
        dateRange: "Mar 2013 – Aug 2015",
        description:
          "Performed functional verification of multi-format video codec IPs (VP9, MPEG, HEVC, H.264) on FPGA (HAPS) across 100,000+ test cases, and contributed to test automation that reduced overall test time by up to 15%.",
      },
    ],
  },
];

export const skills = [
  "Verilog / SystemVerilog",
  "C / C++ / Python",
  "Xilinx Vivado / Vitis",
  "RFSoC (ZCU216) / USRP X410",
  "AXI4 / DMA / ARM Integration",
  "Wideband OFDM / Real-time PHY",
  "MIMO / Beamforming / RIS",
  "LTE / NR / EVDO PHY",
  "NPU Quantization / Pruning / NAS",
  "Spectrum Analyzer / Oscilloscope",
  "Trace32 / Git",
  "Streaming Dataflow Design",
];

export const education = [
  {
    degree: "M.Sc. in Communication and Multimedia Engineering",
    school: "Friedrich-Alexander-Universität Erlangen-Nürnberg, Germany",
    detail:
      "Institute for Digital Communications (IDC) — Supervisor: Prof. Laura Cottatellucci; Examiner: Prof. Robert Schober",
    dateRange: "Oct 2019 – Dec 2022",
    note: "Master's thesis: power-efficient reconfigurable intelligent surface (RIS)-assisted wireless power transfer algorithms, achieving ~11% transmission power reduction in simulation.",
  },
  {
    degree: "B.Sc. in Electronics and Computer Engineering",
    school: "Hanyang University, Seoul, South Korea",
    dateRange: "Mar 2006 – Feb 2013",
    note: null,
  },
];

export const educationNote = "Completed mandatory military service from 2008 to 2010.";

export const publications = [
  {
    title: "Programmable 28 GHz mmWave MU-MIMO Testbed",
    authorLine: "First Author, Proc. IEEE WCNC 2025, Milan, Italy",
    links: [
      { label: "Paper →", href: "https://ieeexplore.ieee.org/document/10978370" },
      { label: "Project Page →", href: "project-mmwave-mimo.html" },
      { label: "Demo Video →", href: "demos.html" },
    ],
  },
];

export const demos = [
  {
    title: "Programmable 28 GHz mmWave MU-MIMO Testbed",
    video: "assets/28GHz-mmWave-MU-MIMO-Testbed-demo.mp4",
    poster: "assets/testbed-poster.jpg",
    description:
      "Demonstration of a 28 GHz mmWave MU-MIMO experimental platform with programmable beam control and real-time system-level validation capability.",
    tags: ["28 GHz", "MU-MIMO", "Beam Control", "SDR", "Real-time Validation"],
    links: [
      { label: "Related Paper →", href: "https://ieeexplore.ieee.org/document/10978370" },
      { label: "Project Page →", href: "project-mmwave-mimo.html" },
    ],
  },
  {
    title: "AI-Native Synchronizer on X410",
    video: "assets/ai_sync.mp4",
    poster: "assets/ai_sync-poster.jpg",
    description:
      "A two-stage CNN-based synchronizer deployed on USRP X410, combining offline-trained filters with online training for calibration and synchronization under harsh channel conditions.",
    tags: ["X410", "2-Stage CNN", "Offline + Online Training", "Harsh Channel Conditions"],
    links: [{ label: "Project Page →", href: "project-ai-phy-sync.html" }],
  },
];

export const footerText = "© 2026 Bumhee Lee. All rights reserved.";
