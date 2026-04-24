# Vocabulary History Plan

## Governing Requirement

- Governing PRD: [../../requirements/active/vocabulary-history/PRD.md](../../requirements/active/vocabulary-history/PRD.md)
- The PRD owns user-visible scope, data requirements, and acceptance criteria.
- This plan owns implementation sequencing and verification.

## Status

- [x] Persist requirement and execution plan
- [ ] Define storage contract and repository helpers
- [ ] Add save action to the translation card
- [ ] Add popup vocabulary list
- [ ] Add sorting: newest, oldest, A-Z, Z-A
- [ ] Add delete action
- [ ] Add focused tests
- [ ] Run `npm run check:local`

## Implementation Sequence

1. Add a `lib/vocabulary-history.ts` module that owns `chrome.storage.local` access and pure sorting helpers.
2. Extend the translation card UI with a manual save action for flash-card results.
3. Include source context where the content script can provide it without broad page scraping.
4. Add a vocabulary section to the popup that reads saved entries and displays the first review list.
5. Add sort controls for newest, oldest, A-Z, and Z-A.
6. Add delete support from the popup list.
7. Cover storage/sorting behavior with logic tests and add browser-flow coverage only where the UI path is at risk.

## Storage Notes

- First version uses `chrome.storage.local`.
- Use one stable key for the vocabulary list.
- Keep storage access behind a small module so a later IndexedDB migration does not touch UI components directly.
- Store ISO timestamps for `createdAt` and `updatedAt`.

## UI Notes

- Keep the first pass usable before visual polish.
- Prefer a friendly, lively tone and compact card layout for university-student review.
- Avoid turning the popup into a large dashboard in the first pass.

## Validation

- `npm run check:codex`
- `npm run check:docs`
- `npm run check:memory`
- `npm run test:ui-logic`
- `npm run test:e2e:mock` if card or popup flows change
- `npm run check:local` before closing the implementation pass
