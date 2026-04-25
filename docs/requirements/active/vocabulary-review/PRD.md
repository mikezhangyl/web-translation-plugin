---
status: active
created: 2026-04-25
updated: 2026-04-25
source:
  - repo: web-translation-plugin
    path: codex/logs/session-001.md
related_prs: []
supersedes: []
superseded_by: []
---

# PRD: Vocabulary Review

## Summary

Turn the local vocabulary notebook into a learning and reinforcement surface, not only a saved-word list. The review experience should help users remember words through original context, special-expression awareness, active recall, and lightweight spaced repetition.

## Target User

- Primary first user: the owner of this extension.
- Forward-looking audience: university students learning English from real web pages.
- UI direction: friendly, lively, and lightly cute, but not childish.

## Product Positioning

The differentiator is context-based learning. A saved word should preserve why it was confusing at lookup time and help the user rebuild meaning from the original reading situation.

## Goals

- preserve the original sentence, page title, URL, and nearby context for review
- distinguish ordinary words from phrases, idioms, slang, workplace expressions, and academic terms when that signal is available
- surface translation-risk cautions on saved vocabulary cards
- provide active-recall review modes instead of passive rereading only
- support a lightweight review queue with learning state
- prioritize repeatedly searched or weakly remembered items
- provide friendly progress feedback suitable for university students

## Non-Goals

- account login
- cloud sync
- full Anki compatibility
- complex spaced-repetition algorithms in the first pass
- community vocabulary decks
- paid dictionary or terminology integrations
- automatic correctness grading through speech recognition or handwriting

## MVP Scope

1. Vocabulary detail keeps:
   - original selected text
   - natural translation
   - phonetic spelling when available
   - example sentence when available
   - original sentence or context snippet
   - page title and URL
   - added time
   - alphabetical sorting key
   - special-expression caution when available
2. Review queue supports:
   - new
   - due
   - mastered
3. Review feedback supports three buttons:
   - `Forgot`
   - `Unsure`
   - `Know`
4. First review mode uses cloze recall:
   - show the original sentence with the saved word or phrase blanked out
   - ask the user to recall the missing expression
   - reveal the answer and explanation after feedback
5. Progress feedback stays lightweight:
   - daily review count
   - small mastery badge
   - subtle completion animation or copy

## Learning-State Rules

- New saved entries start as `new`.
- `Forgot` keeps the entry due soon, preferably today or the next review session.
- `Unsure` schedules the entry after a short delay, initially around 3 days.
- `Know` schedules the entry after a longer delay, initially around 7 days.
- Repeated `Know` feedback can promote the entry to `mastered`.
- Repeated lookups of the same normalized item should increase review priority.
- These rules are intentionally simple until real usage shows the need for a stronger algorithm.

## Special Expression Rules

- If a translation includes a risk notice, the saved vocabulary entry should keep that caution.
- The caution should not be treated as a verified dictionary definition.
- Review cards may label entries as `special expression`, `idiom`, `slang`, `workplace expression`, or `academic term` only when reliable signal exists.
- `coffee badging` is the reference example: review should emphasize that a phrase may not be understood from literal word-by-word meaning.

## User Stories

1. As a student, I want to review a saved word in its original sentence, so I can remember how it is used in real reading.
2. As a student, I want to see special-expression warnings during review, so I do not memorize a misleading literal translation.
3. As a student, I want to fill in a blank from the original sentence, so review trains recall instead of recognition only.
4. As a student, I want to mark an item as forgotten, unsure, or known, so the app can decide when to show it again.
5. As a student, I want mastered words to leave the daily queue, so review time stays focused.
6. As a student, I want repeated lookup words to become higher priority, so the app helps with words I genuinely have not learned yet.
7. As a student, I want the interface to feel friendly and rewarding, so reviewing vocabulary does not feel like a chore.

## Acceptance Criteria

- Review entries can be generated from locally saved vocabulary without another translation request.
- Review cards show source context when it is available.
- Review cards preserve special-expression cautions when they were saved with the entry.
- The first review mode can blank the saved word or phrase from the original sentence.
- Users can choose `Forgot`, `Unsure`, or `Know` after reviewing a card.
- Feedback updates learning state and next review timing in local storage.
- Popup or review UI can filter by new, due, and mastered states.
- Existing vocabulary history sorting by time and alphabet remains available.
- `npm run check:local` passes after implementation.
