"""
Generate slides/project_overview.pptx — AXI simulation project summary.
Requires: python-pptx, matplotlib
"""

import io, os, textwrap
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyArrowPatch
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt

# ── colour palette ────────────────────────────────────────────────────────────
C_NAVY   = RGBColor(0x1A, 0x2E, 0x4A)   # slide background / headings
C_TEAL   = RGBColor(0x00, 0x8B, 0x8B)   # accent
C_ORANGE = RGBColor(0xE8, 0x7D, 0x1E)   # highlight
C_WHITE  = RGBColor(0xFF, 0xFF, 0xFF)
C_LGRAY  = RGBColor(0xF2, 0xF4, 0xF6)   # content background
C_DGRAY  = RGBColor(0x44, 0x44, 0x44)
C_GREEN  = RGBColor(0x27, 0xAE, 0x60)
C_RED    = RGBColor(0xC0, 0x39, 0x2B)

SLIDE_W  = Inches(13.33)
SLIDE_H  = Inches(7.5)

prs = Presentation()
prs.slide_width  = SLIDE_W
prs.slide_height = SLIDE_H

BLANK = prs.slide_layouts[6]   # completely blank layout


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def add_rect(slide, l, t, w, h, fill=C_NAVY, line_color=None, line_w=None):
    shape = slide.shapes.add_shape(
        1,  # MSO_SHAPE_TYPE.RECTANGLE
        Inches(l), Inches(t), Inches(w), Inches(h)
    )
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill
    if line_color:
        shape.line.color.rgb = line_color
        if line_w:
            shape.line.width = Pt(line_w)
    else:
        shape.line.fill.background()
    return shape


def add_text_box(slide, text, l, t, w, h,
                 font_size=18, bold=False, color=C_WHITE,
                 align=PP_ALIGN.LEFT, wrap=True):
    txb = slide.shapes.add_textbox(
        Inches(l), Inches(t), Inches(w), Inches(h))
    tf  = txb.text_frame
    tf.word_wrap = wrap
    p   = tf.paragraphs[0]
    p.alignment = align
    run = p.add_run()
    run.text = text
    run.font.size  = Pt(font_size)
    run.font.bold  = bold
    run.font.color.rgb = color
    return txb


def add_heading(slide, text, top=0.18, size=36):
    """Dark band across top with white title text."""
    add_rect(slide, 0, 0, 13.33, 1.05, fill=C_NAVY)
    add_text_box(slide, text, 0.35, 0.10, 12.6, 0.85,
                 font_size=size, bold=True, color=C_WHITE,
                 align=PP_ALIGN.LEFT)


def fig_to_stream(fig):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                facecolor=fig.get_facecolor())
    buf.seek(0)
    plt.close(fig)
    return buf


def add_image_stream(slide, stream, l, t, w, h):
    slide.shapes.add_picture(stream, Inches(l), Inches(t),
                              Inches(w), Inches(h))


# ─────────────────────────────────────────────────────────────────────────────
# Slide 1 – Title
# ─────────────────────────────────────────────────────────────────────────────

def make_title_slide():
    sl = prs.slides.add_slide(BLANK)

    # Full dark background
    add_rect(sl, 0, 0, 13.33, 7.5, fill=C_NAVY)

    # Accent bar
    add_rect(sl, 0, 3.05, 13.33, 0.08, fill=C_ORANGE)

    add_text_box(sl, "AXI4 RTL Verification Project",
                 0.8, 1.2, 11.5, 1.3,
                 font_size=44, bold=True, color=C_WHITE,
                 align=PP_ALIGN.CENTER)

    add_text_box(sl,
                 "AXI-Lite Register File  ·  AXI4 Memory Model  ·  Simple AXI4 Master",
                 0.8, 2.55, 11.5, 0.65,
                 font_size=22, bold=False, color=C_TEAL,
                 align=PP_ALIGN.CENTER)

    add_text_box(sl,
                 "Vivado / xsim  ·  SystemVerilog Testbenches  ·  Automated CI Gate",
                 0.8, 3.35, 11.5, 0.55,
                 font_size=18, bold=False, color=RGBColor(0xAA, 0xCC, 0xDD),
                 align=PP_ALIGN.CENTER)

    # Summary stats boxes
    stats = [
        ("3",    "RTL / Model\nComponents"),
        ("177",  "Total Checks\nPassed"),
        ("0",    "Failures"),
        ("3",    "CI Gate\nScripts"),
    ]
    xpos = [1.3, 4.1, 6.9, 9.7]
    for i, ((val, lab), x) in enumerate(zip(stats, xpos)):
        add_rect(sl, x, 4.2, 2.3, 1.55, fill=C_TEAL)
        add_text_box(sl, val, x, 4.25, 2.3, 0.75,
                     font_size=40, bold=True, color=C_WHITE,
                     align=PP_ALIGN.CENTER)
        add_text_box(sl, lab, x, 4.95, 2.3, 0.6,
                     font_size=13, bold=False, color=C_LGRAY,
                     align=PP_ALIGN.CENTER)

    add_text_box(sl, "Bumhee Lee  ·  2026-05-01",
                 0, 6.8, 13.33, 0.5,
                 font_size=13, color=RGBColor(0x88, 0x99, 0xAA),
                 align=PP_ALIGN.CENTER)

make_title_slide()


# ─────────────────────────────────────────────────────────────────────────────
# Slide 2 – Project Architecture Overview (block diagram)
# ─────────────────────────────────────────────────────────────────────────────

def make_arch_slide():
    sl = prs.slides.add_slide(BLANK)
    add_rect(sl, 0, 0, 13.33, 7.5, fill=C_LGRAY)
    add_heading(sl, "Project Architecture Overview")

    fig, ax = plt.subplots(figsize=(11.5, 5.5))
    fig.patch.set_facecolor("#F2F4F6")
    ax.set_facecolor("#F2F4F6")
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 6)
    ax.axis("off")

    def box(x, y, w, h, label, sublabel="", fc="#1A2E4A", tc="white", fs=11):
        rect = mpatches.FancyBboxPatch(
            (x, y), w, h,
            boxstyle="round,pad=0.08",
            facecolor=fc, edgecolor="#888", linewidth=1.2)
        ax.add_patch(rect)
        ax.text(x + w/2, y + h/2 + (0.15 if sublabel else 0),
                label, ha="center", va="center",
                fontsize=fs, fontweight="bold", color=tc)
        if sublabel:
            ax.text(x + w/2, y + h/2 - 0.25,
                    sublabel, ha="center", va="center",
                    fontsize=8, color=tc, alpha=0.85)

    def arr(x1, y1, x2, y2, label="", color="#008B8B"):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=color, lw=1.8))
        if label:
            mx, my = (x1+x2)/2, (y1+y2)/2
            ax.text(mx+0.05, my+0.12, label, fontsize=7.5,
                    color="#333", ha="center")

    # --- Testbench / CI layer ---
    box(0.2, 4.6, 11.5, 1.1, "Simulation & CI Layer", "", fc="#2C3E50", fs=10)
    ax.text(0.6, 5.15, "scripts/run_axi_regfile_sim.sh  |  run_mem_rw_sim.sh  |  run_simple_axi_master_sim.sh",
            fontsize=8, color="white", va="center")
    ax.text(0.6, 4.82, "CI gate: grep -qE '\\[FAIL\\]|FATAL'  →  exit 1 on any failure",
            fontsize=7.5, color="#AAC", va="center")

    # --- Testbench modules ---
    box(0.3,  3.1, 3.3, 1.1, "axi_lite_regfile_tb.sv",  "133 checks", fc="#008B8B", fs=9)
    box(4.35, 3.1, 3.3, 1.1, "mem_rw_tb.sv",            "30 checks",  fc="#008B8B", fs=9)
    box(8.4,  3.1, 3.3, 1.1, "simple_axi_master_tb.sv", "14 checks",  fc="#008B8B", fs=9)

    # --- RTL / Model layer ---
    box(0.3,  1.3, 3.3, 1.3, "axi_lite_regfile.v", "RTL  ·  4×32-bit regs\nSLVERR on OOB", fc="#1A2E4A", fs=9)
    box(4.35, 1.3, 3.3, 1.3, "axi_mem_model.sv",   "Sim model  ·  1 KB\nByte-WSTRB  ·  SLVERR", fc="#1A2E4A", fs=9)
    box(8.4,  1.3, 3.3, 1.3, "simple_axi_master.v","RTL  ·  6-state FSM\nWrite→Read→Done", fc="#1A2E4A", fs=9)

    # vertical arrows: TB → RTL
    for x in [1.95, 6.0, 10.05]:
        arr(x, 3.1, x, 2.6)

    # horizontal arrow: master → mem_model
    arr(8.4, 1.95, 7.65, 1.95, "AXI4 bus")

    # vertical arrows: RTL → CI
    for x in [1.95, 6.0, 10.05]:
        arr(x, 4.2, x, 4.6)

    ax.text(6.0, 0.35, "AXI4 Protocol  (single-beat, 32-bit data, WSTRB, OKAY / SLVERR responses)",
            ha="center", va="center", fontsize=9, color="#444",
            bbox=dict(boxstyle="round,pad=0.3", fc="#E8F4F8", ec="#008B8B", lw=1.2))

    add_image_stream(sl, fig_to_stream(fig), 0.7, 1.1, 11.9, 6.1)

make_arch_slide()


# ─────────────────────────────────────────────────────────────────────────────
# Slide 3 – AXI-Lite Register File
# ─────────────────────────────────────────────────────────────────────────────

def make_regfile_slide():
    sl = prs.slides.add_slide(BLANK)
    add_rect(sl, 0, 0, 13.33, 7.5, fill=C_LGRAY)
    add_heading(sl, "AXI-Lite Register File  (rtl/axi_lite_regfile.v)")

    # ── Left: block diagram ──────────────────────────────────────────
    fig, axes = plt.subplots(1, 2, figsize=(11.5, 5.3))
    fig.patch.set_facecolor("#F2F4F6")

    # --- Block diagram (left) ---
    ax = axes[0]
    ax.set_facecolor("#F2F4F6")
    ax.set_xlim(0, 6); ax.set_ylim(0, 6); ax.axis("off")

    def bx(x,y,w,h,txt,fc="#1A2E4A",tc="white",fs=9):
        r = mpatches.FancyBboxPatch((x,y),w,h,
            boxstyle="round,pad=0.07", facecolor=fc, edgecolor="#777", lw=1.1)
        ax.add_patch(r)
        for i, line in enumerate(txt.split("\n")):
            offset = 0.18*(len(txt.split("\n"))-1)/2 - i*0.18
            ax.text(x+w/2, y+h/2+offset, line,
                    ha="center", va="center", fontsize=fs,
                    fontweight="bold" if i==0 else "normal", color=tc)

    # AXI channels on left
    channels_w = [("AW channel\nawaddr/awvalid\n/awready", 1.5),
                  ("W channel\nwdata/wstrb\n/wvalid/wready", 1.5),
                  ("B channel\nbresp/bvalid\n/bready", 1.5),
                  ("AR channel\naraddr/arvalid\n/arready", 4.1),
                  ("R channel\nrdata/rresp\n/rvalid/rready", 4.1)]
    ycols = [4.5, 3.3, 2.1, 4.5, 3.3]
    for (lbl, xc), yc in zip(channels_w, ycols):
        bx(0.1, yc, 1.8, 0.95, lbl, fc="#008B8B", fs=7.5)

    # Central DUT box
    bx(2.1, 2.4, 1.7, 2.5,
       "axi_lite\n_regfile\n\nregs[0..3]\n32-bit × 4", fc="#1A2E4A", fs=8.5)

    # Register array
    for i in range(4):
        bx(4.1+0 , 4.45-i*0.95, 1.5, 0.78,
           f"reg[{i}]\n0x{i*4:02X}", fc="#2C5F8A", fs=8)

    # arrows
    for y in [4.9, 3.7]: ax.annotate("",xy=(2.1,y),xytext=(1.9,y),
        arrowprops=dict(arrowstyle="-|>",color="#E87D1E",lw=1.5))
    ax.annotate("",xy=(1.9,2.55),xytext=(2.1,2.55),
        arrowprops=dict(arrowstyle="-|>",color="#E87D1E",lw=1.5))
    for y in [4.9, 3.7]: ax.annotate("",xy=(4.0,y),xytext=(3.8,y),
        arrowprops=dict(arrowstyle="-|>",color="#E87D1E",lw=1.5))
    ax.annotate("",xy=(3.8,3.55),xytext=(4.0,3.55),
        arrowprops=dict(arrowstyle="-|>",color="#E87D1E",lw=1.5))

    ax.text(3.0, 1.6, "addr[31:4]≠0\n→ SLVERR",
            ha="center", fontsize=8, color="#C0392B",
            bbox=dict(boxstyle="round,pad=0.3", fc="#FDECEA", ec="#C0392B", lw=1.2))
    ax.set_title("Block Diagram", fontsize=10, fontweight="bold", color="#1A2E4A")

    # --- Write FSM (right) ---
    ax2 = axes[1]
    ax2.set_facecolor("#F2F4F6")
    ax2.set_xlim(0, 6); ax2.set_ylim(0, 6.5); ax2.axis("off")
    ax2.set_title("Write FSM  (4 states)", fontsize=10, fontweight="bold", color="#1A2E4A")

    fsm_nodes = [
        ("W_IDLE",   3.0, 5.5, "#1A2E4A"),
        ("W_WAIT_W", 1.0, 3.8, "#2C5F8A"),
        ("W_WAIT_A", 5.0, 3.8, "#2C5F8A"),
        ("W_BRESP",  3.0, 2.1, "#008B8B"),
    ]
    node_pos = {}
    for name, x, y, fc in fsm_nodes:
        r = mpatches.FancyBboxPatch((x-0.85, y-0.35), 1.7, 0.7,
            boxstyle="round,pad=0.08", facecolor=fc, edgecolor="#555", lw=1.3)
        ax2.add_patch(r)
        ax2.text(x, y, name, ha="center", va="center",
                 fontsize=9, fontweight="bold", color="white")
        node_pos[name] = (x, y)

    def fsm_arr(a, b, label="", color="#E87D1E"):
        x1,y1 = node_pos[a]; x2,y2 = node_pos[b]
        ax2.annotate("", xy=(x2,y2), xytext=(x1,y1),
            arrowprops=dict(arrowstyle="-|>", color=color, lw=1.5,
                            connectionstyle="arc3,rad=0.12"))
        mx,my = (x1+x2)/2,(y1+y2)/2
        if label:
            ax2.text(mx+0.1, my+0.18, label, fontsize=7, color="#333", ha="center")

    fsm_arr("W_IDLE",   "W_WAIT_W", "awvalid only")
    fsm_arr("W_IDLE",   "W_WAIT_A", "wvalid only")
    fsm_arr("W_IDLE",   "W_BRESP",  "both valid")
    fsm_arr("W_WAIT_W", "W_BRESP",  "wvalid")
    fsm_arr("W_WAIT_A", "W_BRESP",  "awvalid")
    fsm_arr("W_BRESP",  "W_IDLE",   "bready")

    ax2.text(3.0, 0.85,
             "addr[31:4]≠0 → SLVERR, skip write\n"
             "addr[31:4]=0 → OKAY, do_write()",
             ha="center", fontsize=8, color="#333",
             bbox=dict(boxstyle="round,pad=0.3", fc="white", ec="#008B8B", lw=1.2))

    add_image_stream(sl, fig_to_stream(fig), 0.5, 1.1, 12.0, 5.9)

    # Key facts strip
    add_rect(sl, 0, 6.6, 13.33, 0.9, fill=C_NAVY)
    facts = ("4 × 32-bit regs  |  Byte-WSTRB  |  3 write paths (W_IDLE/W_WAIT_W/W_WAIT_A)  "
             "|  SLVERR for addr[31:4]≠0  |  133/133 checks passed")
    add_text_box(sl, facts, 0.3, 6.65, 12.7, 0.6,
                 font_size=12, color=C_TEAL, align=PP_ALIGN.CENTER)

make_regfile_slide()


# ─────────────────────────────────────────────────────────────────────────────
# Slide 4 – AXI-Lite Verification Coverage (checks chart)
# ─────────────────────────────────────────────────────────────────────────────

def make_regfile_coverage_slide():
    sl = prs.slides.add_slide(BLANK)
    add_rect(sl, 0, 0, 13.33, 7.5, fill=C_LGRAY)
    add_heading(sl, "AXI-Lite Register File — Verification Coverage  (133 Checks)")

    labels = [
        "T1: Reset defaults",
        "T2: Write all-ones",
        "T3: Unique values",
        "T4: Write all-zeros",
        "T5: Partial WSTRB",
        "T5b: Byte isolation",
        "T6: AW-before-W",
        "T7: W-before-AW",
        "T8: Invalid addr 0x10",
        "T9: Same-cycle AW+W",
        "T10: B backpressure",
        "T11: R backpressure",
        "T12: OOB sweep W_IDLE",
        "T13: OOB AW-first",
        "T14: OOB W-first",
    ]
    counts = [8, 12, 12, 12, 10, 12, 4, 4, 5, 4, 8, 8, 15, 9, 9]
    colors = (["#2C5F8A"]*4 + ["#008B8B"]*2 +
              ["#2C5F8A"]*2 + ["#E87D1E"] +
              ["#2C5F8A"]*3 +
              ["#C0392B"]*3)

    fig, (ax_bar, ax_pie) = plt.subplots(1, 2, figsize=(11.5, 5.2))
    fig.patch.set_facecolor("#F2F4F6")

    # Bar chart
    ax_bar.set_facecolor("#F2F4F6")
    bars = ax_bar.barh(labels[::-1], counts[::-1], color=colors[::-1],
                       edgecolor="white", height=0.65)
    for bar, val in zip(bars, counts[::-1]):
        ax_bar.text(bar.get_width()+0.1, bar.get_y()+bar.get_height()/2,
                    str(val), va="center", fontsize=8, color="#333")
    ax_bar.set_xlabel("Checks", fontsize=9)
    ax_bar.set_xlim(0, 20)
    ax_bar.tick_params(labelsize=8)
    ax_bar.spines[["top","right","bottom"]].set_visible(False)
    ax_bar.set_title("Checks per Test", fontsize=10, fontweight="bold", color="#1A2E4A")
    ax_bar.axvline(x=0, color="#888", lw=0.8)

    # Pie – category breakdown
    ax_pie.set_facecolor("#F2F4F6")
    cat_labels = ["Functional\n(T1–T4, T6–T7, T9)", "WSTRB\n(T5, T5b)",
                  "SLVERR\n(T8, T12–T14)", "Backpressure\n(T10–T11)"]
    cat_vals   = [8+12+12+12+4+4+4, 10+12, 5+15+9+9, 8+8]
    cat_colors = ["#2C5F8A", "#008B8B", "#C0392B", "#E87D1E"]
    wedges, texts, autotexts = ax_pie.pie(
        cat_vals, labels=cat_labels, autopct="%1.0f%%",
        colors=cat_colors, startangle=140,
        textprops={"fontsize": 8.5},
        wedgeprops={"edgecolor": "white", "linewidth": 1.5})
    for at in autotexts: at.set_color("white"); at.set_fontweight("bold")
    ax_pie.set_title("Category Breakdown", fontsize=10, fontweight="bold", color="#1A2E4A")

    fig.tight_layout(pad=1.5)
    add_image_stream(sl, fig_to_stream(fig), 0.6, 1.1, 12.1, 5.9)

    add_rect(sl, 0, 6.6, 13.33, 0.9, fill=C_NAVY)
    add_text_box(sl,
                 "133 / 133 checks PASSED  ·  0 failures  ·  CI exit code 0  ·  Simulation time 3720 ns",
                 0.3, 6.65, 12.7, 0.6,
                 font_size=13, bold=True, color=C_GREEN, align=PP_ALIGN.CENTER)

make_regfile_coverage_slide()


# ─────────────────────────────────────────────────────────────────────────────
# Slide 5 – AXI4 Memory Model
# ─────────────────────────────────────────────────────────────────────────────

def make_mem_model_slide():
    sl = prs.slides.add_slide(BLANK)
    add_rect(sl, 0, 0, 13.33, 7.5, fill=C_LGRAY)
    add_heading(sl, "AXI4 Memory Model  (tb/axi_mem_model.sv)")

    fig, axes = plt.subplots(1, 2, figsize=(11.5, 5.3))
    fig.patch.set_facecolor("#F2F4F6")

    # --- Left: block diagram ---
    ax = axes[0]
    ax.set_facecolor("#F2F4F6")
    ax.set_xlim(0, 6.5); ax.set_ylim(0, 6.5); ax.axis("off")
    ax.set_title("Memory Model Block Diagram", fontsize=10, fontweight="bold", color="#1A2E4A")

    def bx2(x,y,w,h,lines,fc="#1A2E4A",tc="white",fs=9,ec="#777"):
        r = mpatches.FancyBboxPatch((x,y),w,h,
            boxstyle="round,pad=0.07", facecolor=fc, edgecolor=ec, lw=1.2)
        ax.add_patch(r)
        for i,line in enumerate(lines):
            nh = len(lines)
            oy = (nh-1)*0.17/2 - i*0.17
            ax.text(x+w/2, y+h/2+oy, line,
                    ha="center", va="center", fontsize=fs,
                    fontweight="bold" if i==0 else "normal", color=tc)

    # AXI channels
    bx2(0.1, 4.9, 1.7, 0.8, ["AW", "awaddr/awvalid", "/awready"], fc="#008B8B", fs=8)
    bx2(0.1, 3.9, 1.7, 0.8, ["W", "wdata/wstrb/wlast", "/wvalid/wready"], fc="#008B8B", fs=8)
    bx2(0.1, 2.9, 1.7, 0.8, ["B", "bresp/bvalid", "/bready"], fc="#008B8B", fs=8)
    bx2(0.1, 1.9, 1.7, 0.8, ["AR", "araddr/arvalid", "/arready"], fc="#1A6E8B", fs=8)
    bx2(0.1, 0.9, 1.7, 0.8, ["R", "rdata/rresp", "/rlast/rvalid/rready"], fc="#1A6E8B", fs=8)

    # Core logic box
    bx2(2.1, 1.5, 1.9, 3.6,
        ["axi_mem", "_model",
         "", "Write FSM", "4-state",
         "", "Read FSM", "2-state"],
        fc="#1A2E4A", fs=8.5)

    # Memory array
    bx2(4.3, 1.5, 1.9, 3.6,
        ["mem[0..1023]",
         "", "1024 × 32-bit", "(4 KB)",
         "", "init to 0x0", "at sim start"],
        fc="#2C5F8A", fs=8.5)

    # arrows
    for y in [5.3, 4.3, 3.3]: ax.annotate("",xy=(2.1,y),xytext=(1.8,y),
        arrowprops=dict(arrowstyle="-|>",color="#E87D1E",lw=1.5))
    ax.annotate("",xy=(1.8,2.3),xytext=(2.1,2.3),
        arrowprops=dict(arrowstyle="-|>",color="#008B8B",lw=1.5))
    ax.annotate("",xy=(1.8,1.3),xytext=(2.1,1.3),
        arrowprops=dict(arrowstyle="-|>",color="#008B8B",lw=1.5))
    ax.annotate("",xy=(4.3,3.3),xytext=(4.0,3.3),
        arrowprops=dict(arrowstyle="-|>",color="#E87D1E",lw=1.5))
    ax.annotate("",xy=(4.0,2.3),xytext=(4.3,2.3),
        arrowprops=dict(arrowstyle="-|>",color="#008B8B",lw=1.5))

    ax.text(3.0, 0.45, "addr ∈ [MEM_BASE, MEM_END) → OKAY\naddr out-of-range → SLVERR, rdata=0",
            ha="center", fontsize=8, color="#C0392B",
            bbox=dict(boxstyle="round,pad=0.3", fc="#FDECEA", ec="#C0392B", lw=1.2))

    ax.text(3.25, 5.6, "Byte-WSTRB\ndo_write()", ha="center", fontsize=7.5,
            color="#333",
            bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="#888", lw=0.8))

    # --- Right: test coverage chart ---
    ax2 = axes[1]
    ax2.set_facecolor("#F2F4F6")
    ax2.set_title("Test Coverage (30 checks)", fontsize=10, fontweight="bold", color="#1A2E4A")

    test_labels = ["T1: Full word\nwrite/readback",
                   "T2: Multiple\naddresses",
                   "T3: Byte-lane\nWSTRB",
                   "T4: Unwritten\naddr = 0"]
    test_counts = [6, 12, 10, 2]
    test_colors = ["#2C5F8A", "#1A6E8B", "#008B8B", "#E87D1E"]

    bars = ax2.bar(test_labels, test_counts, color=test_colors,
                   edgecolor="white", width=0.55)
    for bar, val in zip(bars, test_counts):
        ax2.text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.2,
                 str(val), ha="center", va="bottom", fontsize=11,
                 fontweight="bold", color="#333")
    ax2.set_ylabel("Checks", fontsize=9)
    ax2.set_ylim(0, 16)
    ax2.tick_params(labelsize=8.5)
    ax2.spines[["top","right"]].set_visible(False)
    ax2.yaxis.grid(True, alpha=0.4, linestyle="--")
    ax2.set_axisbelow(True)

    fig.tight_layout(pad=1.5)
    add_image_stream(sl, fig_to_stream(fig), 0.5, 1.1, 12.2, 5.9)

    add_rect(sl, 0, 6.6, 13.33, 0.9, fill=C_NAVY)
    add_text_box(sl,
                 "Parameterised MEM_DEPTH / MEM_BASE  ·  30/30 checks PASSED  ·  Simulation time 690 ns",
                 0.3, 6.65, 12.7, 0.6,
                 font_size=13, bold=True, color=C_GREEN, align=PP_ALIGN.CENTER)

make_mem_model_slide()


# ─────────────────────────────────────────────────────────────────────────────
# Slide 6 – Simple AXI4 Master: FSM
# ─────────────────────────────────────────────────────────────────────────────

def make_master_fsm_slide():
    sl = prs.slides.add_slide(BLANK)
    add_rect(sl, 0, 0, 13.33, 7.5, fill=C_LGRAY)
    add_heading(sl, "Simple AXI4 Master  —  6-State FSM  (rtl/simple_axi_master.v)")

    fig, ax = plt.subplots(figsize=(11.5, 5.5))
    fig.patch.set_facecolor("#F2F4F6")
    ax.set_facecolor("#F2F4F6")
    ax.set_xlim(0, 12); ax.set_ylim(0, 6.5); ax.axis("off")

    # State positions
    states = {
        "IDLE":    (2.0,  5.0),
        "WR_ADDR": (2.0,  3.5),
        "WR_RESP": (2.0,  2.0),
        "RD_ADDR": (7.0,  2.0),
        "RD_DATA": (7.0,  3.5),
        "DONE":    (7.0,  5.0),
    }
    colors_map = {
        "IDLE":    "#2C3E50",
        "WR_ADDR": "#1A2E4A",
        "WR_RESP": "#2C5F8A",
        "RD_ADDR": "#1A6E8B",
        "RD_DATA": "#008B8B",
        "DONE":    "#27AE60",
    }
    desc_map = {
        "IDLE":    "Wait for start\nlatch addr, write_data",
        "WR_ADDR": "awvalid=wvalid=1\nwait awready&&wready",
        "WR_RESP": "bready=1\nwait bvalid",
        "RD_ADDR": "arvalid=1\nwait arready",
        "RD_DATA": "rready=1\nwait rvalid",
        "DONE":    "done=1 (1 cycle)\nerror=computed",
    }

    W, H = 2.5, 0.9
    for name, (x, y) in states.items():
        # shadow
        shadow = mpatches.FancyBboxPatch(
            (x - W/2 + 0.05, y - H/2 - 0.05), W, H,
            boxstyle="round,pad=0.1", facecolor="#BBBBBB", edgecolor="none")
        ax.add_patch(shadow)
        r = mpatches.FancyBboxPatch(
            (x - W/2, y - H/2), W, H,
            boxstyle="round,pad=0.1",
            facecolor=colors_map[name], edgecolor="white", linewidth=1.8)
        ax.add_patch(r)
        ax.text(x, y + 0.12, name, ha="center", va="center",
                fontsize=11, fontweight="bold", color="white")
        ax.text(x, y - 0.22, desc_map[name], ha="center", va="center",
                fontsize=7.5, color="#DDD")

    # Transitions
    transitions = [
        ("IDLE",    "WR_ADDR", "start=1",          "arc3,rad=0"),
        ("WR_ADDR", "WR_RESP", "awready&&wready",   "arc3,rad=0"),
        ("WR_RESP", "RD_ADDR", "bvalid → capture bresp", "arc3,rad=-0.35"),
        ("RD_ADDR", "RD_DATA", "arready",           "arc3,rad=0"),
        ("RD_DATA", "DONE",    "rvalid → capture rdata", "arc3,rad=0"),
        ("DONE",    "IDLE",    "unconditional",      "arc3,rad=-0.5"),
    ]
    for a, b, label, style in transitions:
        x1, y1 = states[a]
        x2, y2 = states[b]
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(
                        arrowstyle="-|>", color="#E87D1E", lw=2.0,
                        connectionstyle=style))
        mx = (x1 + x2) / 2
        my = (y1 + y2) / 2
        offset_x = 0.6 if "arc3,rad=-0.3" in style else (1.2 if "arc3,rad=-0.5" in style else 0.0)
        offset_y = 0.25 if "arc3,rad=0" in style else 0.0
        ax.text(mx + offset_x, my + offset_y, label,
                ha="center", va="center", fontsize=8.5, color="#222",
                bbox=dict(boxstyle="round,pad=0.2", fc="white", ec="#DDD", lw=0.8))

    # AXI signal legend table
    sig_rows = [
        ("WR_ADDR", "awvalid=1, wvalid=1, awaddr, wdata, wstrb=0xF, wlast=1"),
        ("WR_RESP", "bready=1"),
        ("RD_ADDR", "arvalid=1, araddr"),
        ("RD_DATA", "rready=1"),
        ("IDLE / DONE", "all valids=0"),
    ]
    ax.text(9.8, 5.6, "AXI Output Signals", ha="center", va="center",
            fontsize=9.5, fontweight="bold", color="#1A2E4A")
    for i, (state, sigs) in enumerate(sig_rows):
        y_row = 5.1 - i * 0.62
        fc_row = "#E8F4F8" if i % 2 == 0 else "white"
        r = mpatches.FancyBboxPatch((9.0, y_row - 0.25), 2.7, 0.5,
            boxstyle="square,pad=0", facecolor=fc_row, edgecolor="#CCC", lw=0.6)
        ax.add_patch(r)
        ax.text(9.15, y_row, state, va="center", fontsize=7.5,
                fontweight="bold", color="#1A2E4A")
        ax.text(9.15, y_row - 0.18, sigs, va="center", fontsize=6.8, color="#444")

    # Error logic
    ax.text(4.5, 0.65,
            "error = write_err (bresp≠OKAY)  |  read_err (rresp≠OKAY)  |  data_err (rdata≠write_data)",
            ha="center", va="center", fontsize=9, color="#C0392B",
            bbox=dict(boxstyle="round,pad=0.3", fc="#FDECEA", ec="#C0392B", lw=1.5))

    add_image_stream(sl, fig_to_stream(fig), 0.5, 1.1, 12.2, 5.9)

    add_rect(sl, 0, 6.6, 13.33, 0.9, fill=C_NAVY)
    add_text_box(sl,
                 "Combinatorial AXI outputs from FSM state  ·  "
                 "Registered data latches  ·  done pulses for exactly one cycle",
                 0.3, 6.65, 12.7, 0.6,
                 font_size=12, color=C_TEAL, align=PP_ALIGN.CENTER)

make_master_fsm_slide()


# ─────────────────────────────────────────────────────────────────────────────
# Slide 7 – Simple AXI4 Master: Timing + Test Results
# ─────────────────────────────────────────────────────────────────────────────

def make_master_timing_slide():
    sl = prs.slides.add_slide(BLANK)
    add_rect(sl, 0, 0, 13.33, 7.5, fill=C_LGRAY)
    add_heading(sl, "Simple AXI4 Master  —  Transaction Timing & Test Results")

    fig = plt.figure(figsize=(11.5, 5.4))
    fig.patch.set_facecolor("#F2F4F6")

    # Top: timing waveform diagram
    ax_wave = fig.add_axes([0.04, 0.45, 0.92, 0.50])
    ax_wave.set_facecolor("#1A2E4A")
    ax_wave.set_xlim(0, 14); ax_wave.set_ylim(-0.5, 9)
    ax_wave.axis("off")
    ax_wave.set_title("Single Write→Read Transaction (≈8 clock cycles)",
                      fontsize=10, fontweight="bold", color="#1A2E4A", pad=6)

    clk_times   = list(range(15))
    signal_defs = [
        # (name,  y_base,  height, color,          segments: (t_start, t_end, level))
        ("aclk",     8.2, 0.4,  "#AACCDD",  None),       # drawn separately
        ("aresetn",  7.3, 0.4,  "#FFDD66",  [(0,1,0),(1,14,1)]),
        ("start",    6.4, 0.4,  "#E87D1E",  [(0,1.5,0),(1.5,2.5,1),(2.5,14,0)]),
        ("awvalid",  5.5, 0.4,  "#27AE60",  [(0,2,0),(2,3,1),(3,14,0)]),
        ("awready",  4.6, 0.4,  "#27AE60",  [(0,3,1),(3,4,0),(4,14,1)]),
        ("bvalid",   3.7, 0.4,  "#008B8B",  [(0,4,0),(4,5,1),(5,14,0)]),
        ("arvalid",  2.8, 0.4,  "#C0392B",  [(0,5,0),(5,6,1),(6,14,0)]),
        ("rvalid",   1.9, 0.4,  "#C0392B",  [(0,7,0),(7,8,1),(8,14,0)]),
        ("done",     1.0, 0.4,  "#FFDD66",  [(0,9,0),(9,10,1),(10,14,0)]),
    ]

    # Draw clock
    clk_x, clk_y = [], []
    for t in range(14):
        clk_x += [t, t, t+0.5, t+0.5, t+1]
        clk_y += [signal_defs[0][1], signal_defs[0][1]+signal_defs[0][2],
                  signal_defs[0][1]+signal_defs[0][2],
                  signal_defs[0][1], signal_defs[0][1]]
    ax_wave.plot(clk_x, clk_y, color=signal_defs[0][3], lw=1.2)

    for name, yb, yh, color, segs in signal_defs[1:]:
        ax_wave.text(-0.1, yb + yh/2, name, ha="right", va="center",
                     fontsize=8, color="white", fontweight="bold")
        if segs:
            prev_x, prev_lev = 0, segs[0][2]
            for t0, t1, lev in segs:
                if lev != prev_lev:
                    ax_wave.plot([t0, t0], [yb, yb+yh], color=color, lw=1.4)
                ax_wave.plot([t0, t1], [yb + lev*yh, yb + lev*yh],
                             color=color, lw=1.8)
                prev_lev = lev

    # Phase labels
    phases = [(2.0, "IDLE→\nWR_ADDR"), (3.2, "WR_\nRESP"),
              (5.2, "RD_\nADDR"), (7.2, "RD_\nDATA"), (9.2, "DONE")]
    for tx, lab in phases:
        ax_wave.axvline(tx, color="#888", lw=0.8, linestyle="--", alpha=0.6)
        ax_wave.text(tx + 0.35, 0.1, lab, ha="center", fontsize=7.5,
                     color="#AACCEE")

    # Bottom: test results table
    ax_tbl = fig.add_axes([0.04, 0.02, 0.92, 0.38])
    ax_tbl.set_facecolor("#F2F4F6")
    ax_tbl.axis("off")
    ax_tbl.set_title("Test Results (14 Checks)", fontsize=10,
                     fontweight="bold", color="#1A2E4A", pad=4)

    cols = ["Test", "Address", "Write Data", "Expected done", "Expected error",
            "Expected read_data", "Result"]
    rows = [
        ["T1: Single W/R",    "0x0000_0000", "0xDEAD_BEEF", "1", "0", "0xDEAD_BEEF", "PASS"],
        ["T2a: Multi-addr",   "0x0000_0004", "0xCAFE_F00D", "1", "0", "0xCAFE_F00D", "PASS"],
        ["T2b: Multi-addr",   "0x0000_0008", "0xA5A5_A5A5", "1", "0", "0xA5A5_A5A5", "PASS"],
        ["T2c: Multi-addr",   "0x0000_000C", "0x0000_0001", "1", "0", "0x0000_0001", "PASS"],
        ["T3: OOB (0x1000)",  "0x0000_1000", "0x1234_5678", "1", "1", "— (SLVERR)",  "PASS"],
    ]
    col_widths = [0.16, 0.14, 0.14, 0.12, 0.12, 0.16, 0.10]
    col_x      = [0.01]
    for cw in col_widths[:-1]: col_x.append(col_x[-1]+cw)

    # Header
    for j, (cx, cw, hdr) in enumerate(zip(col_x, col_widths, cols)):
        r = mpatches.FancyBboxPatch((cx, 0.72), cw-0.005, 0.23,
            boxstyle="square,pad=0", facecolor="#1A2E4A", edgecolor="white", lw=0.5)
        ax_tbl.add_patch(r)
        ax_tbl.text(cx + (cw-0.005)/2, 0.835, hdr, ha="center", va="center",
                    fontsize=8, fontweight="bold", color="white")

    for i, row in enumerate(rows):
        yrow = 0.55 - i * 0.145
        row_fc = "#E8F4F8" if i % 2 == 0 else "white"
        for j, (cx, cw, cell) in enumerate(zip(col_x, col_widths, row)):
            r = mpatches.FancyBboxPatch((cx, yrow), cw-0.005, 0.13,
                boxstyle="square,pad=0", facecolor=row_fc, edgecolor="#DDD", lw=0.4)
            ax_tbl.add_patch(r)
            fc = "#27AE60" if cell == "PASS" else (
                 "#C0392B" if cell == "FAIL" else "#333")
            fw = "bold" if cell in ("PASS","FAIL") else "normal"
            ax_tbl.text(cx + (cw-0.005)/2, yrow + 0.065, cell,
                        ha="center", va="center",
                        fontsize=8, color=fc, fontweight=fw)

    ax_tbl.set_xlim(0, 1); ax_tbl.set_ylim(0, 1)

    add_image_stream(sl, fig_to_stream(fig), 0.5, 1.1, 12.2, 5.9)

    add_rect(sl, 0, 6.6, 13.33, 0.9, fill=C_NAVY)
    add_text_box(sl,
                 "14/14 checks PASSED  ·  CI exit code 0  ·  Simulation time 445 ns",
                 0.3, 6.65, 12.7, 0.6,
                 font_size=13, bold=True, color=C_GREEN, align=PP_ALIGN.CENTER)

make_master_timing_slide()


# ─────────────────────────────────────────────────────────────────────────────
# Slide 8 – Overall Summary
# ─────────────────────────────────────────────────────────────────────────────

def make_summary_slide():
    sl = prs.slides.add_slide(BLANK)
    add_rect(sl, 0, 0, 13.33, 7.5, fill=C_NAVY)
    add_rect(sl, 0, 0, 13.33, 1.05, fill=C_TEAL)

    add_text_box(sl, "Summary & Overall Verification Status",
                 0.35, 0.10, 12.6, 0.85,
                 font_size=34, bold=True, color=C_WHITE, align=PP_ALIGN.LEFT)

    # Component status boxes
    components = [
        ("AXI-Lite\nRegister File",
         "rtl/axi_lite_regfile.v",
         "133 / 133", "checks",
         ["4 × 32-bit registers",
          "SLVERR on addr[31:4]≠0",
          "3 write FSM paths",
          "Backpressure coverage"]),
        ("AXI4\nMemory Model",
         "tb/axi_mem_model.sv",
         "30 / 30", "checks",
         ["1 KB parameterised RAM",
          "Byte-WSTRB do_write()",
          "SLVERR for OOB addresses",
          "Initial zero guarantee"]),
        ("Simple\nAXI4 Master",
         "rtl/simple_axi_master.v",
         "14 / 14", "checks",
         ["6-state FSM",
          "Write → Readback sequence",
          "Error flag: SLVERR / mismatch",
          "Comb. AXI output drivers"]),
    ]

    xstarts = [0.5, 4.72, 8.94]
    for (title, file, count, unit, bullets), x in zip(components, xstarts):
        # Card background
        add_rect(sl, x, 1.25, 3.9, 5.55, fill=RGBColor(0x1E, 0x3A, 0x5A))

        # Title
        add_text_box(sl, title, x+0.1, 1.3, 3.7, 0.7,
                     font_size=18, bold=True, color=C_TEAL,
                     align=PP_ALIGN.CENTER)
        # File
        add_text_box(sl, file, x+0.1, 1.95, 3.7, 0.35,
                     font_size=10, color=RGBColor(0xAA, 0xCC, 0xDD),
                     align=PP_ALIGN.CENTER)
        # Count
        add_rect(sl, x+0.5, 2.45, 2.9, 0.9, fill=C_GREEN)
        add_text_box(sl, count, x+0.5, 2.48, 2.9, 0.55,
                     font_size=28, bold=True, color=C_WHITE,
                     align=PP_ALIGN.CENTER)
        add_text_box(sl, unit, x+0.5, 2.95, 2.9, 0.35,
                     font_size=11, color=C_LGRAY,
                     align=PP_ALIGN.CENTER)
        # Bullets
        for i, b in enumerate(bullets):
            add_text_box(sl, "▸  " + b, x+0.2, 3.52 + i*0.54, 3.5, 0.45,
                         font_size=12, color=C_LGRAY)

    # Totals row
    add_rect(sl, 0.5, 6.85, 12.33, 0.45, fill=C_ORANGE)
    add_text_box(sl,
                 "Total:  177 / 177 checks passed  ·  0 failures  ·  3 CI scripts  ·  All exit code 0",
                 0.5, 6.88, 12.33, 0.38,
                 font_size=15, bold=True, color=C_WHITE,
                 align=PP_ALIGN.CENTER)

make_summary_slide()


# ─────────────────────────────────────────────────────────────────────────────
# Save
# ─────────────────────────────────────────────────────────────────────────────

os.makedirs("slides", exist_ok=True)
OUT = "slides/project_overview.pptx"
prs.save(OUT)
print(f"Saved: {OUT}")
print(f"Slides: {len(prs.slides)}")
