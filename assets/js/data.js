export const profile = {
  name: "Bumhee Lee",
  title: "System Engineer / Research Assistant",
  tagline: "Modem Systems | FPGA Validation | AI-assisted Hardware Design",
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
    badge: "Wireless AI",
    title: "Hardware-aware ML for PHY Systems",
    tags: ["ML", "PHY", "Synchronization"],
    link: "https://github.com/zealatan/PY_OFDM",
  },
  {
    badge: "Real-time PHY",
    title: "Real-time OFDM PHY Architecture",
    tags: ["Multi-sample/clk", "Fixed-point"],
    link: "https://github.com/zealatan/realtime-Gbps-OFDM-for-Wideband",
    image: "assets/project-fpga.jpg",
  },
];

export const experience = [
  {
    org: "RWTH Aachen University",
    location: "Aachen, Germany",
    roleLine: "Research Assistant, Chair for Distributed Signal Processing",
    dateRange: "Aug 2023 – Aug 2026",
    description:
      "Validated real-time PHY systems through simulation, RFSoC prototyping, lab/OTA experiments,",
    roles: null,
  },
  {
    org: "Samsung Electronics",
    location: "Hwaseong, South Korea",
    roleLine:
      "System LSI Division — SoC FPGA Validation and LTE/EVDO Modem Protocols",
    dateRange: null,
    description: null,
    roles: [
      {
        title: "Cellular Modem Protocol Engineer",
        dateRange: "Sep 2015 – May 2018",
        description:
          "Developed and debugged Layer-1 modem protocol features, and validated software changes on FPGA-based modem test platforms.",
      },
      {
        title: "FPGA Validation Engineer",
        dateRange: "Mar 2013 – Aug 2015",
        description:
          "Performed FPGA-based validation of high-throughput video codec IPs, contributing to test automation and reduced test time.",
      },
    ],
  },
];

export const skills = [
  "Wideband OFDM",
  "MIMO / Beamforming / RIS",
  "LTE / NR PHY",
  "USRP X410 / RFSoC",
  "AXI4 / DMA",
  "Streaming Pipelines",
  "Verilog / SystemVerilog",
  "C / C++ / Python",
  "LLM Agents",
];

export const education = [
  {
    degree: "M.Sc. in Communication and Multimedia Engineering",
    school: "Friedrich-Alexander-Universität Erlangen-Nürnberg, Germany",
    dateRange: "Oct 2019 – Dec 2022",
  },
  {
    degree: "B.Sc. in Electronics and Computer Engineering",
    school: "Hanyang University, Seoul, South Korea",
    dateRange: "Mar 2006 – Feb 2013",
  },
];

export const educationNote = "Completed mandatory military service from 2008 to 2010.";

export const publications = [
  {
    title: "Programmable 28 GHz mmWave MU-MIMO Testbed",
    authorLine: "First Author, Proc. IEEE WCNC 2025, Milan, Italy",
    links: [
      { label: "Paper →", href: "https://ieeexplore.ieee.org/document/10978370" },
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
    ],
  },
  {
    title: "AI-Native Synchronizer on X410",
    video: "assets/ai_sync.mp4",
    poster: "assets/ai_sync-poster.jpg",
    description:
      "A two-stage CNN-based synchronizer deployed on USRP X410, combining offline-trained filters with online training for calibration and synchronization under harsh channel conditions.",
    tags: ["X410", "2-Stage CNN", "Offline + Online Training", "Harsh Channel Conditions"],
    links: [],
  },
];

export const footerText = "© 2026 Bumhee Lee. All rights reserved.";
