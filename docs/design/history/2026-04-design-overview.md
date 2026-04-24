---
status: historical
created: 2026-04-24
updated: 2026-04-24
source:
  - repo: vibe-coding-os-translation-plugin
    path: docs/DESIGN.md
related_prs: []
supersedes: []
superseded_by: []
---

# Historical Design Overview

This is a preserved historical design note from the predecessor repository. It is not the current canonical design contract for this repository.

## Historical Purpose

The earlier repository combined two concerns:

1. building and validating the browser translation extension
2. building a wider engineering workflow surface around that product

## Durable Product Framing That Still Matters

- Platform: Plasmo + React + TypeScript + Manifest V3
- Core interaction: select text, show a floating marker, open a translation card
- Product modes evolved toward:
  - word or short phrase -> flash-card mode
  - sentence -> plain translation mode
  - paragraph -> not yet fully validated
- Popup acts as the operator console for provider settings and troubleshooting logs

## Historical Documentation Insight

The predecessor repository discovered that a single top-level entry file could not hold all durable rules cleanly. That led to progressive disclosure:

- a small entry map
- a durable docs layer
- separate operating history

That principle still survives in the current repository, but the workflow-heavy layers themselves were intentionally not restored.

## What Changed In The New Repository

- workflow-surface documents are no longer the center of the docs system
- the docs system now prioritizes:
  - current canonical specs
  - requirement history
  - references
  - issue-input notes
  - archived snapshots
