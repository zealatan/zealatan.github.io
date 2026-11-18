# OFDM RTL Architecture Explorer

An interactive, recursively navigable, **source-accurate** schematic explorer for
the OFDM Transceiver RTL (`ofdm_transceiver_top`, 49 Verilog files + 3 Xilinx
xfft IP black boxes from
[realtime-Gbps-OFDM-for-Wideband](https://github.com/zealatan/realtime-Gbps-OFDM-for-Wideband)).

Everything the explorer shows — hierarchy, ports, widths, parameters,
connections — is extracted from a **real Verilator elaboration** of the RTL,
not drawn by hand.

![top level](docs/shot_top.png)

## Quick start

```bash
cd ~/zedboard-digital-twin/rtl_explorer
python3 -m http.server 8080        # browsers block fetch() on file:// URLs
# open http://localhost:8080/
```

The app is fully static (no backend) and works as-is on GitHub Pages.

## Using the explorer

| Action | How |
|---|---|
| Drill down | double-click a module box, or click the `▼` button on the box |
| Expand in place | click `⊞` on a box — its one-level internals render inside the box |
| Select module / connection / port | single click (details appear in the right pane) |
| Breadcrumbs | bottom-left; every crumb is clickable |
| Back / forward | `←` `→` buttons (history includes selections) |
| Zoom / pan | mouse wheel / drag; `Fit` resets; `⛶` fullscreen |
| Search | top bar — modules, instances, ports, nets; result click navigates + highlights |
| Minimap | bottom-right; click to recenter |
| Deep links | URL hash, e.g. `#/u_rx/u_sync/u_dut` or `#/u_tx?sel=net:tx_m_valid` |
| Clock/reset nets | hidden by default (shown as ⏱ badges); toolbar checkbox shows them |
| Timing view | `Timing` button, or "Open timing view" from a selected connection |
| Export | `SVG` / `PNG` buttons |
| Theme | `◐` toggles dark / light |

### Visual conventions

- Inputs enter on the left, outputs leave on the right; arrows follow **actual
  RTL port directions**, never visual guesswork.
- Colors: **blue** data · **teal** AXI-Stream handshake · **amber** AXI4-Lite ·
  **gray** control · **purple** clock/reset (classification is name-based and
  documented in `src/core/graph.js` / extractor `classify()`).
- Bus widths label every multi-bit connection (`[31:0]`); single-bit signals
  show `1 bit`.
- `ƒ` = internal combinational/registered logic endpoint, `K` = constant,
  `?` = unresolved driver (explicitly marked, never guessed).
- Dashed amber boxes = **Vendor IP / Black Box** (Xilinx xfft 9.1 — boundary
  ports from the project's behavioral simulation model; internals are not RTL
  source and are not shown).

## Regenerating the data from RTL

```bash
cd ~/zedboard-digital-twin/rtl_explorer
python3 scripts/extract_rtl_hierarchy.py \
    --rtl-dir ~/realtime-Gbps-OFDM-for-Wideband/RTL_SYNC_PHASE5/rtl \
    --top ofdm_transceiver_top \
    --extra-src ~/zedboard-digital-twin/hw_sim/ofdm/xfft_sim.v \
    --output generated/
python3 scripts/build_verification.py
```

The extractor runs `verilator --xml-only` (real elaboration: parameter
overrides, resolved widths, specialized module variants) and emits:

| file | contents |
|---|---|
| `generated/hierarchy.json` | elaborated instance tree (max depth 9, 64 instances) |
| `generated/modules.json` | per module-variant: ports (resolved + raw declared widths), parameters (resolved values, string params decoded), memories/ROMs, source file:line, verbatim header comments |
| `generated/connections.json` | per module: nets + edges from actual pin expressions, continuous and procedural assigns; constants, slices, concats preserved as expressions |
| `generated/verification.json` | tier-1/2/3 context from the real reports in `~/zedboard-digital-twin/reports/` |
| `generated/extraction_report.json` | stats, unresolved items, source git revision |

## Tests

```bash
python3 -m pytest rtl_explorer/tests -q      # extraction cross-checks + browser smoke (Playwright)
node --test rtl_explorer/tests/core.test.mjs # UI logic: store/graph/navigation/search
```

The extraction tests re-derive hierarchy/ports/instances with an independent
source scanner and compare against the Verilator-derived JSON, so neither
parser is trusted alone.

## Layout

```
rtl_explorer/
├── index.html                  static app entry
├── src/
│   ├── app.js                  glue (nav, toolbar, search wiring)
│   ├── core/                   DOM-free logic: store, graph+layout, navigation, search
│   ├── components/             diagram (SVG), tree, details, timing
│   └── styles/main.css         dark/light theme
├── generated/                  extracted JSON (regenerable)
├── scripts/                    extract_rtl_hierarchy.py, build_verification.py
├── tests/                      pytest (extraction, browser) + node --test (UI logic)
└── VERIFICATION_REPORT.md      statistics, test results, limitations
```

## Honesty rules baked in

- No module names, ports or connections are invented; everything traces to the
  elaborated netlist, with RTL `file:line` references.
- Functional one-liners are labeled *conceptual summaries* (curated from the
  RTL header comments, which are also shown verbatim).
- Timing waveforms are labeled **Protocol Example** — no VCD/FST captures exist
  in this workspace; the only real timing numbers shown are the measured
  cycle latencies from the tier-2 cocotb reports.
- Verification statuses come exclusively from
  `~/zedboard-digital-twin/reports/`; integration-only coverage is never
  presented as unit verification.
