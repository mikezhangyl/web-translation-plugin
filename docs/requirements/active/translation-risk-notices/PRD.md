---
status: active
created: 2026-04-24
updated: 2026-04-24
source:
  - repo: web-translation-plugin
    path: docs/references/qwen-mt-self-review-probe-2026-04-24.txt
related_prs: []
supersedes: []
superseded_by: []
---

# Translation Risk Notices PRD

## Problem

Machine translation can produce a readable sentence while still mishandling slang, idioms, neologisms, domain terms, or misleading literal expressions. For English learners, the product should make this uncertainty visible without pretending the model knows the correct meaning.

## Current Scope

- Keep sentence translation output simple and primary.
- Run a second Qwen MT self-review pass after successful sentence translation.
- Display a warning below the translation only when the review flags suspicious expressions.
- Treat self-review output as a candidate warning, not a verified definition.
- Show the flagged source expression, but do not present the model's proposed explanation as fact.

## Non-Goals

- Do not replace the main translation with the self-review output.
- Do not claim confidence or correctness.
- Do not add glossary/TMS integration in this slice.
- Do not change flash-card streaming behavior in this slice.

## Acceptance

- Sentence card still shows the translated sentence as the main result.
- Sentence card still has no phonetic or example rows.
- If a suspicious expression is returned, the card shows a visible risk notice below the translation.
- The risk notice warns about the flagged source expression without claiming the correct meaning.
- If review fails or returns no suspicious terms, the main translation still succeeds without a warning.
- Mock E2E covers the UI warning path.
