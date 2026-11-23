export const profile = {
  name: "Bumhee Lee",
  subtitle: "Wireless PHY Engineer — Algorithm to Verified Silicon",
  tagline: "RF/DSP Algorithm Design · FPGA/RFSoC Implementation · Bit-Exact Hardware Verification",
  intro:
    "I take wireless PHY from DSP algorithm to verified silicon — designing synchronization, channel-estimation and OFDM radar-sensing algorithms, implementing them on FPGA/RFSoC, and validating them end-to-end against bit-exact golden models and on real radios. Backed by industry experience in FPGA-based SoC validation and cellular modems.",
  email: "zealatan@gmail.com",
  linkedin: "https://www.linkedin.com/in/bumhee-lee-357417138/",
  github: "https://github.com/zealatan",
};

export const nav = [
  { label: "Portfolio", href: "index.html" },
  { label: "Hardware", href: "index.html#hw" },
  { label: "Demos", href: "demos.html" },
  { label: "GitHub", href: profile.github },
];

// Small inline flow diagram for the ZedBoard sync-RTL verification card.
const syncVerifySvg = `
  <svg viewBox="0 0 900 120" role="img" aria-labelledby="sync-flow-title" class="card-svg">
    <title id="sync-flow-title">Golden model to Verilator bit-exact verification flow</title>
    <defs>
      <marker id="sfarrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#1c2b4a" />
      </marker>
    </defs>
    <g font-family="IBM Plex Sans, sans-serif">
      <rect x="6" y="34" width="180" height="52" rx="6" fill="#f3f1ec" stroke="#1c2b4a" stroke-width="1.2" />
      <text x="96" y="58" text-anchor="middle" font-size="12" font-weight="600" fill="#1c2b4a">Python golden</text>
      <text x="96" y="74" text-anchor="middle" font-size="10" fill="#5b6472">cfo_golden.py</text>

      <rect x="236" y="34" width="180" height="52" rx="6" fill="#f3f1ec" stroke="#1c2b4a" stroke-width="1.2" />
      <text x="326" y="58" text-anchor="middle" font-size="12" font-weight="600" fill="#1c2b4a">Test vectors</text>
      <text x="326" y="74" text-anchor="middle" font-size="10" fill="#5b6472">vectors/*.npz + real capture</text>

      <rect x="466" y="34" width="180" height="52" rx="6" fill="#f3f1ec" stroke="#1c2b4a" stroke-width="1.2" />
      <text x="556" y="58" text-anchor="middle" font-size="12" font-weight="600" fill="#1c2b4a">Verilator 5.044</text>
      <text x="556" y="74" text-anchor="middle" font-size="10" fill="#5b6472">full-length sim</text>

      <rect x="696" y="34" width="198" height="52" rx="6" fill="#ffffff" stroke="#2c3e63" stroke-width="1.2" stroke-dasharray="4 3" />
      <text x="795" y="58" text-anchor="middle" font-size="12" font-weight="600" fill="#2c3e63">Bit-exact ✓</text>
      <text x="795" y="74" text-anchor="middle" font-size="10" fill="#5b6472">0-LSB on output ports</text>

      <line x1="186" y1="60" x2="234" y2="60" stroke="#1c2b4a" stroke-width="1.2" marker-end="url(#sfarrow)" />
      <line x1="416" y1="60" x2="464" y2="60" stroke="#1c2b4a" stroke-width="1.2" marker-end="url(#sfarrow)" />
      <line x1="646" y1="60" x2="694" y2="60" stroke="#1c2b4a" stroke-width="1.2" marker-end="url(#sfarrow)" />
    </g>
  </svg>
`;

export const sections = [
  {
    id: "hw",
    title: "Hardware-Verified (ZedBoard + AD9361)",
    intro:
      "One communication OFDM waveform, taken from algorithm to real radio: a BER-0 RF loopback, the same waveform reused as a radar for human-motion sensing, and the synchronization chain hardened into timing-closed, golden-verified RTL. Hardware brought up entirely over JTAG on an aarch64 host.",
    layout: "grid",
    cards: [
      {
        badge: "Hardware RF Loopback",
        title: "ZedBoard + AD9361 — OFDM over a Real Radio",
        result:
          "16-QAM OFDM transmitted through the actual RF chain (DAC → TX1A → SMA → RX1A → ADC) and recovered with zero bit errors.",
        metrics: ["BER 0 / 4420 bits", "link EVM 1.8%", "34.8 dB SNR"],
        image: "assets/zedboard-ofdm-loopback.png",
        imageAlt: "ZedBoard + FMCOMMS3 OFDM RF loopback monitoring GUI",
        verify:
          "Measured on the real radio. Brought up over JTAG only (no SD card, no Vivado); controlled through a from-scratch libiio serial backend speaking the no-OS IIOD protocol over UART, with a live constellation / spectrum / BER GUI.",
        links: [],
      },
      {
        badge: "ISAC — Comm Waveform as Radar",
        title: "OFDM ISAC — Range-Doppler Human Sensing",
        result:
          "The same OFDM waveform is reused, unchanged, as a monostatic radar — a live walking person isolated over a static control on the real AD9361 radio.",
        metrics: [
          "walking human +15.9 dB @ +1.6 m/s",
          "synthetic 2 targets at offset-0 bins",
          "dR 4.88 m · dv 26.02 m/s @ 30.72 MSPS",
        ],
        image: "assets/isac-walking-detection.png",
        imageAlt:
          "Measured Range-Doppler map: live walking human detected at +15.9 dB over a static control",
        verify:
          "Reciprocal filtering divides out the QAM symbols; a 2-D FFT forms a Range-Doppler map. Validated against ground truth at offset-0 bins on synthetic IQ, then run on measured IQ; detection by 4-capture static-reference subtraction, with direct leakage nulled at 0-Doppler (CFO ≈ 0). Frame sync shares the communication preamble correlator (equivalence measured on hardware).",
        note:
          "The linked simulator is a synthetic, perfect-sync model; the numbers above are measured on an AD9361 radio.",
        links: [
          { label: "Range-Doppler simulator →", href: "ofdm-isac/index.html" },
        ],
      },
      {
        badge: "Sync RTL · Golden-Verified",
        title: "ZedBoard Sync Chain RTL — Timing-Closed & Bit-Exact",
        result:
          "The timing / CFO synchronization chain implemented in Verilog, place-and-routed on the ZedBoard's xc7z020, and proven bit-exact against a Python golden model.",
        metrics: ["post-route 123 MHz MET (fmax ≈ 146 MHz)", "DSP 9 · LUT 11.6%", "bit-exact to golden (Verilator)"],
        svg: syncVerifySvg,
        verify:
          "golden (cfo_golden.py) → committed test vectors (vectors/*.npz: 11 CFO + 8 correlator + a real capture) → Verilator 5.044 full-length run, output-port stream equal to the integer golden sample-for-sample (0-LSB).",
        note:
          "L=2 (2 samples/clock) is verified at the detector-block level (peak_detect_l2), not as a full-path silicon closure.",
        links: [],
      },
    ],
  },
  {
    id: "rfsoc",
    title: "RFSoC / FPGA (ZCU216)",
    intro:
      "A wideband OFDM transceiver written in synthesizable Verilog for the AMD ZCU216 RFSoC — verified bit-exact against a C/NumPy golden model and proven on real silicon, with an interactive explorer over the elaborated RTL.",
    layout: "grid",
    cards: [
      {
        badge: "RFSoC Silicon · RTL",
        title: "Real-Time FPGA OFDM PHY — ZCU216 RFSoC",
        result:
          "Mode-selectable OFDM transceiver, verified bit-exact against a C/NumPy golden model and running at full sample rate on ZCU216 silicon with zero bit errors.",
        metrics: ["187.5 MHz silicon, BER 0 (16-QAM)", "post-route Fmax 232 MHz", "LUT 7.5% · DSP 7.8% · 1.27 W"],
        image: "assets/project-fpga.jpg",
        imageAlt: "ZCU216 RFSoC evaluation board with RF front-end on the bench",
        verify:
          "C reference → NumPy golden → RTL in xsim against the real Xilinx xfft IP on the locked target part → ZCU216 silicon (on-chip BER readback). The interactive RTL Explorer navigates the real Verilator elaboration (52 modules, 65 instances, 9 levels) with measured streaming traces.",
        note:
          "The 4-modulation (QPSK/16/64/256-QAM) result is simulation-only; silicon is 16-QAM. Sustained wideband throughput against the 200 Msps target is still in progress.",
        links: [
          { label: "Project details →", href: "project-ofdm-phy.html" },
          { label: "RTL Explorer →", href: "rtl-explorer/index.html" },
          { label: "GitHub →", href: "https://github.com/zealatan/realtime-Gbps-OFDM-for-Wideband" },
        ],
      },
    ],
  },
  {
    id: "sims",
    title: "Interactive Simulators (in-browser)",
    intro:
      "Live PHY simulators that run entirely in the browser — one representative end-to-end transceiver, plus focused tools that each show something the others do not.",
    layout: "feature-list",
    cards: [
      {
        badge: "Representative · Browser E2E Transceiver",
        title: "OFDM E2E Live Simulator — Sample-Level Transceiver",
        result:
          "A true end-to-end OFDM chain on complex IQ samples, entirely in the browser: Gray-QAM → pilots → unitary IFFT → CP → FIR multipath / CFO / SFO / phase-noise / PA / IQ channel → Schmidl-Cox + known-preamble sync → LS channel estimation → ZF/MMSE → recovered bits.",
        metrics: ["32-check numerical test suite", "Monte-Carlo BER/EVM in a worker", "versioned IQ test-vector export"],
        diff:
          "What's different: sample-level IQ fidelity plus versioned test-vector export for RTL / hardware digital-twin comparison — the bridge to the silicon work above.",
        links: [
          { label: "Open E2E Simulator →", href: "ofdm-e2e/index.html" },
          { label: "Math Reference →", href: "ofdm-e2e/theory.html" },
        ],
      },
    ],
    listItems: [
      {
        title: "OFDM Live Dashboard — In-Browser PHY Simulator",
        diff:
          "What's different: a channel-estimation algorithm playground — LS/LMMSE with Linear/FFT/2D/CNN interpolation, BER-vs-SNR across AWGN/EPA/EVA/ETU/Rician, FEC, and an interpolator comparison view.",
        links: [
          { label: "Open Live Simulator →", href: "ofdm-sim/index.html" },
          { label: "Math Reference →", href: "ofdm-sim/theory.html" },
        ],
      },
      {
        title: "OFDM-ISAC Research Simulator",
        diff:
          "What's different: the only one that does radar sensing — a monostatic Range-Doppler sensing laboratory (synthetic, perfect-sync model behind the hardware ISAC result above).",
        links: [{ label: "Open ISAC Simulator →", href: "ofdm-isac/index.html" }],
      },
    ],
  },
  {
    id: "research",
    title: "SDR · mmWave Research & Publications",
    intro:
      "Over-the-air SDR and mmWave research from the RWTH Aachen Chair for Distributed Signal Processing.",
    layout: "grid",
    cards: [
      {
        badge: "mmWave MU-MIMO · WCNC 2025",
        title: "28 GHz mmWave MU-MIMO Testbed",
        result:
          "A programmable multi-user MIMO prototype operated live over the air at 28 GHz with real-time beam tracking; first-author paper at IEEE WCNC 2025.",
        metrics: ["28 GHz over-the-air", "2-user MIMO + real-time beam tracking", "IEEE WCNC 2025 (first author)"],
        image: "assets/testbed-poster.jpg",
        imageAlt: "28 GHz mmWave MU-MIMO testbed",
        verify:
          "Validated with a live two-user MIMO scenario over the air (not simulation only); system and demonstration presented at IEEE WCNC 2025, Milan.",
        links: [
          { label: "IEEE Paper →", href: "https://ieeexplore.ieee.org/document/10978370" },
          { label: "Project details →", href: "project-mmwave-mimo.html" },
          { label: "Demo →", href: "demos.html" },
        ],
      },
      {
        badge: "Hardware-Aware AI",
        title: "Hardware-Aware ML for PHY Synchronization",
        result:
          "A two-stage CNN synchronizer — offline-trained filter plus online calibration — demonstrated on a USRP X410 SDR under harsh channel conditions.",
        metrics: ["2-stage CNN (offline + online)", "USRP X410 SDR", "harsh-channel BER-vs-SNR measured"],
        image: "assets/project-ber.jpg",
        imageAlt: "Measured BER-vs-SNR comparison from the AI synchronizer",
        verify:
          "Demonstrated live on the X410 with training-loss logging. Note: the BER chart's curve legend is not yet labeled, and whether any of the inference path runs on the X410's FPGA fabric (vs. host) is unconfirmed — no FPGA deployment is claimed.",
        links: [
          { label: "Project details →", href: "project-ai-phy-sync.html" },
          { label: "Demo →", href: "demos.html" },
        ],
      },
    ],
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
