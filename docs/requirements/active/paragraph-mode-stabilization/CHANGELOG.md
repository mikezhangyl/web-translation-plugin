---
status: active
created: 2026-04-24
updated: 2026-04-24
source:
  - repo: web-translation-plugin
    path: docs/requirements/active/paragraph-mode-stabilization/PRD.md
related_prs: []
supersedes: []
superseded_by: []
---

# Paragraph Mode Stabilization Changelog

## 2026-04-24

- Initialized the active requirement record for paragraph-mode stabilization.
- Locked the initial requirement scope:
  - preserve word/flash-card behavior
  - preserve sentence/plain-translation behavior
  - define a real paragraph contract before treating it as stable
  - keep storage-only runtime configuration and live-E2E acceptance rules intact
- Added the first explicit paragraph-selection guardrails:
  - single paragraph only
  - maximum `250` whitespace-delimited words
  - maximum `1500` characters
  - show a guidance card when the selection must be trimmed
