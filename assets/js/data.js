export const profile = {
  name: "Bumhee Lee",
  subtitle: "FPGA & Wireless Systems Engineer",
  tagline: "Real-Time PHY Architecture · RFSoC Prototyping · Hardware-Aware AI",
  intro:
    "I design, implement, and validate real-time wireless systems — combining industry experience in FPGA-based SoC validation and cellular modems with hands-on research in RFSoC prototyping, mmWave MIMO, and AI-assisted PHY design.",
  email: "zealatan@gmail.com",
  linkedin: "https://www.linkedin.com/in/bumhee-lee-357417138/",
  github: "https://github.com/zealatan",
  resumeUrl: "assets/resume.pdf",
};

export const nav = [
  { label: "Portfolio", href: "index.html" },
  { label: "Demos", href: "demos.html" },
  { label: "GitHub", href: profile.github },
];

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
