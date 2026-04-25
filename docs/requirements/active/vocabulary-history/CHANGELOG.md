---
status: active
created: 2026-04-24
updated: 2026-04-24
source:
  - repo: web-translation-plugin
    path: docs/requirements/active/vocabulary-history/PRD.md
related_prs: []
supersedes: []
superseded_by: []
---

# Vocabulary History Changelog

## 2026-04-24

- Opened the vocabulary-history requirement stream.
- Set the first version scope to manual local saving, popup review, time sorting, alphabetical sorting, and deletion.
- Corrected the sorting requirement from a speech-recognition mistake: the product needs alphabetical sorting, not subtitle ordering.
- Chose `chrome.storage.local` as the first implementation target because it matches the extension's existing local settings and troubleshooting-log storage model.
- Implemented the first local vocabulary notebook slice:
  - flash-card manual save from the translation card
  - `chrome.storage.local` persistence
  - duplicate normalized-word updates
  - popup review list
  - newest, oldest, A-Z, and Z-A sorting
  - delete action
- Added logic and mock browser coverage for storage helpers and the save/list/sort/delete path.
- Extended flash-card semantics for non-literal expressions:
  - natural meaning remains the primary displayed meaning
  - optional literal translation can be shown when useful
  - optional usage note explains idioms, slang, cultural expressions, and domain-specific phrases
  - vocabulary history persists the added literal and note fields
