---
status: active
created: 2026-04-27
updated: 2026-04-27
source:
  - repo: web-translation-plugin
    path: codex/logs/session-001.md
related_prs: []
supersedes: []
superseded_by: []
---

# PRD: Vocabulary Notebook Page

## Summary

Move serious vocabulary review out of the constrained popup and into a dedicated extension page. The popup should become a launcher and status surface, while the new notebook page provides enough space for saved words, phonetics, explanations, examples, sorting, search, and trash management.

## Problem

The popup is too small for reading and reviewing vocabulary. It is acceptable for quick entry, settings, and diagnostics, but it makes word detail cards feel cramped and does not match the scenario of studying saved words.

## Target User

- Primary first user: the owner of this extension.
- Forward-looking audience: university students learning English from real web pages.
- Tone: soft, warm, friendly, and study-oriented without becoming childish.

## Goals

- make the vocabulary notebook a distinct product surface
- keep the popup lightweight as a launcher
- display saved vocabulary in a roomy list/detail layout
- preserve existing local storage and trash semantics
- support search and sort on the notebook page
- keep review/learning mechanics deferred but visible as future direction

## Non-Goals

- spaced repetition
- cloze recall
- new/due/mastered learning states
- cloud sync
- import/export
- account login
- paid glossary or TMS integration

## MVP Scope

### Slice 1: Popup Launcher

- Popup shows a compact vocabulary summary.
- Popup has an `Open Notebook` action.
- `Open Notebook` opens the dedicated vocabulary page.
- Popup still exposes settings and diagnostics.
- Popup keeps a trash shortcut.

### Slice 2: Notebook Page Skeleton

- Add a dedicated extension page for the vocabulary notebook.
- Read existing entries from `chrome.storage.local`.
- Show a left-side vocabulary list.
- Show a right-side selected-word detail panel.
- Detail panel includes:
  - source text
  - phonetic
  - explanation
  - example
  - optional literal translation
  - optional usage note
  - added date
  - source URL/title/context when available

### Slice 3: Search, Sort, And Trash

- Notebook page supports sorting by:
  - newest
  - oldest
  - A-Z
  - Z-A
- Notebook page supports search by source text, normalized text, translation, explanation, and example.
- Deleting from the notebook page moves the entry to trash.
- Trash view shows deleted entries and explains the 15-day purge rule.
- Existing 15-day purge behavior remains storage-layer owned.

### Slice 4: Review Mode Placeholder

- The notebook page can show a `Review` entry point.
- The entry point is disabled or placeholder-only in this MVP.
- It should clearly communicate that active review mode is coming later.

## User Stories

1. As a student, I want to open a full notebook page from the extension popup, so I can review saved words without cramped popup space.
2. As a student, I want to scan saved words in a list and inspect one word in detail, so I can study without losing context.
3. As a student, I want to search saved vocabulary, so I can quickly find a word I remember partially.
4. As a student, I want to sort by time or alphabet, so I can review recent words or browse like a dictionary.
5. As a student, I want deleted words to move to trash, so accidental deletion is not immediately permanent.
6. As a student, I want to see a future review-mode entry point, so the product direction is clear without implementing learning logic yet.

## Acceptance Criteria

- Popup includes an `Open Notebook` action.
- Clicking `Open Notebook` opens the dedicated vocabulary page.
- The notebook page loads saved active entries from `chrome.storage.local`.
- The notebook page can display a seeded saved word with phonetic, explanation, and example.
- Selecting a word updates the detail panel.
- Search filters the list.
- Sorting changes list order.
- Deleting a word moves it to trash and removes it from the active list.
- Trash view shows deleted entries and the 15-day purge message.
- Review mode remains non-functional placeholder scope only.
- `npm run check:local` passes.
