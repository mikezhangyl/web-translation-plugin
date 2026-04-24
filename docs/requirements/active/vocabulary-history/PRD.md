---
status: active
created: 2026-04-24
updated: 2026-04-24
source:
  - repo: web-translation-plugin
    path: docs/exec-plans/active/vocabulary-history.md
related_prs: []
supersedes: []
superseded_by: []
---

# PRD: Vocabulary History

## Summary

Turn the extension into a personal vocabulary notebook for the local user. After translating a word or short phrase, the user can save it locally, reopen the extension later, and review saved entries with phonetic spelling, explanation, example sentence, source context, and sorting by added time or alphabetical order.

## Target User

- Primary first user: the owner of this extension.
- Forward-looking audience: university students learning English from real web pages.
- UI direction: friendly, lively, and lightly cute, while keeping review and lookup efficient.

## Goals

- allow saving translated word and short-phrase flash cards into local storage
- show saved vocabulary entries in the popup
- support sorting by:
  - newest added
  - oldest added
  - A-Z
  - Z-A
- preserve flash-card fields:
  - phonetic
  - explanation
  - example
- preserve source memory when available:
  - source URL
  - source title
  - nearby context text
- allow deleting an entry that was added by mistake

## Non-Goals

- account login
- cloud sync
- Anki-style spaced repetition
- bulk import or export
- social sharing
- automatic saving for every translation
- a full standalone vocabulary dashboard in the first pass

## Product Rules

- First version saves entries manually from the translation card.
- Runtime translation behavior must stay unchanged for word, sentence, and paragraph modes.
- Sentence translations can appear in history later, but the first vocabulary notebook path focuses on word and short-phrase flash cards.
- Duplicate saves of the same normalized word should not create identical primary entries.
- When a duplicate is saved, update the existing entry's `updatedAt` and latest flash-card details while preserving the original `createdAt`.
- Alphabetical sorting uses `normalizedText`.
- Time sorting uses `createdAt`.
- Source context is memory aid only; it does not participate in sorting.

## Data Contract

```ts
type VocabularyEntry = {
  id: string
  sourceText: string
  normalizedText: string
  translation: string
  phonetic?: string
  explanation?: string
  example?: string
  sourceUrl?: string
  sourceTitle?: string
  contextText?: string
  selectionType: "word" | "phrase" | "sentence" | "paragraph"
  createdAt: string
  updatedAt: string
}
```

## User Stories

1. As a university student, I want to save a translated word from the card, so I can review it later.
2. As a user, I want to see recently saved words in the popup, so I can quickly revisit what I just learned.
3. As a user, I want to sort words by added time, so I can review recent or older learning sessions.
4. As a user, I want to sort words alphabetically, so I can find a saved word quickly.
5. As a user, I want each word to keep phonetic spelling, explanation, and example, so review does not require another translation call.
6. As a user, I want to delete mistaken entries, so my vocabulary list stays clean.

## Acceptance Criteria

- A translated word or short phrase can be saved from the translation card.
- Saved entries persist after closing and reopening the extension popup.
- Popup shows saved entries with source text, phonetic, explanation, and example when available.
- Popup sorting supports newest, oldest, A-Z, and Z-A.
- Deleting an entry removes it from persistent storage and from the popup list.
- Saving the same normalized word twice does not create duplicate primary entries.
- `npm run check:local` passes.
