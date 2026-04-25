---
status: active
created: 2026-04-24
updated: 2026-04-24
source:
  - repo: web-translation-plugin
    path: docs/requirements/active/translation-risk-notices/PRD.md
related_prs: []
supersedes: []
superseded_by: []
---

# Translation Risk Notices Changelog

## 2026-04-24

- Opened the translation-risk-notices requirement stream.
- Confirmed through provider probe that Qwen MT self-review can surface candidate risky expressions but is not reliable enough as a source of truth.
- Added sentence translation risk notices:
  - Qwen MT sentence translation runs a second self-review pass after the main translation.
  - Self-review output is parsed into `riskNotices`.
  - The UI shows a warning below the main translation when notices are present, but does not present the model's proposed meaning as verified fact.
  - Review failure does not block the main translation.
- Added service and mock E2E coverage.
