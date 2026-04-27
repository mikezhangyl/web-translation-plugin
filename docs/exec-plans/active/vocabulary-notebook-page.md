# Vocabulary Notebook Page Plan

## Governing Requirement

- Governing PRD: [../../requirements/active/vocabulary-notebook-page/PRD.md](../../requirements/active/vocabulary-notebook-page/PRD.md)
- The PRD owns user-visible scope and acceptance criteria.
- This plan owns implementation sequencing and verification.

## Status

- [x] Persist requirement and execution plan
- [x] Add popup launcher tests
- [x] Add notebook page E2E coverage
- [x] Implement popup launcher
- [x] Implement dedicated notebook page
- [x] Add search, sort, and trash interactions
- [x] Add review-mode placeholder
- [x] Update docs and memory
- [x] Run `npm run check:local`

## Feature Slices

### Slice 1: Popup Launcher

1. Keep popup compact.
2. Add `Open Notebook`.
3. Open the extension notebook page with `chrome.tabs.create`.
4. Keep settings, diagnostics, and trash shortcut reachable.

### Slice 2: Notebook Page Skeleton

1. Add a Plasmo page under `tabs/vocabulary.tsx`.
2. Load entries with existing vocabulary storage helpers.
3. Split active and trashed entries with existing helpers.
4. Render a roomy two-panel desktop layout:
   - left list
   - right detail
5. Use a warm, study-notebook visual direction.

### Slice 3: Search, Sort, And Trash

1. Add pure search helper coverage if needed.
2. Support newest, oldest, A-Z, and Z-A sorting.
3. Filter active entries by source text, normalized text, translation, explanation, and example.
4. Soft-delete entries through the existing storage helper.
5. Show trash entries and 15-day purge copy.

### Slice 4: Review Placeholder

1. Add a clear `Review` entry point.
2. Keep it disabled or placeholder-only.
3. Do not add spaced repetition, cloze recall, or learning-state storage.

## TDD Plan

1. Extend mock E2E coverage:
   - popup `Open Notebook` action opens the notebook page
   - notebook page displays seeded vocabulary details
   - notebook search filters the list
   - notebook sort changes order
   - notebook delete moves entry to trash
2. Add logic tests for search helper if the filtering logic is extracted.
3. Run RED before implementation.
4. Implement only enough to satisfy the MVP.
5. Run full local verification.

## Validation

- `npm run test:ui-logic`: PASS.
- `npm run build`: PASS.
- `npm run test:e2e:mock`: PASS.
- `npm run check:docs`: PASS.
- `npm run check:memory`: PASS.
- `npm run check:local`: PASS, including live provider gate.
