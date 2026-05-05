# 00. Overview — AI-assisted RTL/FPGA Verification Workflow

## Goal

This experiment tests whether an AI coding agent can participate in a realistic RTL/FPGA verification loop.

```text
Spec → Code Generation → Simulation → Failure Detection → Debugging → Patch → Re-run → Pass Summary
```

## Project

```text
/home/zealatan/AI_ORC/messi/VIVADO_MIN_EXAMPLE
```

## Core Idea

```text
Human prompt / policy
  ↓
Claude Code agent
  ↓
Read / Write / Bash / MCP tools
  ↓
Vivado xsim / logs / patches
```

## Current Status

| Layer | Component | Result |
|---|---|---|
| Layer 1 | AXI-lite register file | 133/133 PASS |
| Layer 2 | AXI4 memory model | 30/30 PASS |
| Layer 3 | Simple AXI4 master | 14/14 PASS |
| Layer 4 | 1-word DMA copy engine | 16/16 PASS |
| Layer 5 | N-word DMA copy engine | 31/31 PASS |

## One-line Summary

A single Claude Code agent, guided by structured prompts and project policy files, successfully participated in a meaningful RTL verification loop.
