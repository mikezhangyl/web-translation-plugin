---
status: archived
created: 2026-04-24
updated: 2026-04-24
source:
  - repo: vibe-coding-os-translation-plugin
    path: docs/QUALITY_SCORE.md
related_prs: []
supersedes: []
superseded_by: []
---

# Archived Quality Score Snapshot

This is a preserved historical status snapshot from the predecessor repository. It is not a current canonical quality contract.

## Historical Snapshot

| Area | Historical Status | Historical Notes |
| --- | --- | --- |
| Provider acceptance discipline | Strong | live E2E and curl-gated onboarding were established |
| Mock vs live vocabulary | Strong | mock and live labels had been separated more clearly |
| Observability | Strong | popup logs, trace phases, provider events, and request outcome logs existed |
| Popup/runtime config contract | Strong | storage-first display and storage-only runtime contract had been established |
| Sentence translation coverage | Good | logic, mock browser, and live provider checks existed |
| Paragraph translation clarity | Weak | paragraph mode remained directional and not yet productized |

## Why It Is Archived

- it is a point-in-time snapshot, not a stable rule set
- the current canonical rules now live in:
  - [../../RELIABILITY.md](../../RELIABILITY.md)
  - [../../product-specs/current-state.md](../../product-specs/current-state.md)
  - [../../exec-plans/tech-debt-tracker.md](../../exec-plans/tech-debt-tracker.md)
