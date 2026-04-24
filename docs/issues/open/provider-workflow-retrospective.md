---
status: issue-input
created: 2026-04-24
updated: 2026-04-24
source:
  - repo: vibe-coding-os-translation-plugin
    path: docs/provider-workflow-retrospective-todo.md
related_prs: []
supersedes: []
superseded_by: []
---

# Provider Workflow Retrospective

This document is preserved as issue input and workflow-improvement source material. It is not the current canonical workflow spec.

## What Repeatedly Went Wrong

- Live behavior did not always match mock expectations.
- Some earlier results were labeled as "pass" even when final user-visible acceptance was not proven.
- Observability had to be repaired during debugging instead of being ready before debugging started.
- Multi-model execution exposed overload behavior that made naive full parallelism unsafe.
- Provider debugging sometimes started before the doc-first and curl-first checks were complete.

## Durable Lessons

### Provider Validation

- First-time provider or model-family work should follow:
  - docs
  - curl
  - integration
  - live E2E
- Live integration is the final acceptance source of truth.
- Mock success is useful evidence, but not final proof.

### Acceptance Language

- `mock pass`, `live pass`, `partial`, `blocked`, and `unstable` should stay distinct.
- Final assertions should reflect real user-visible completion, not only internal sub-checks.

### Observability

- Request, render, cache, and failure paths should all be traceable.
- Logging consistency matters as much as logging volume.
- Troubleshooting logs are part of the product workflow, not optional debugging noise.

### Concurrency

- Bounded concurrency is safer than unrestricted fan-out for upstream provider calls.
- Retry behavior should remain evidence-driven.

## Open Follow-Up Themes

- provider knowledge still needs a cleaner long-lived home
- trace consistency can still be tightened
- acceptance vocabulary should stay explicit across docs and tests
- paragraph-mode work should preserve these provider-validation lessons instead of relearning them

## Current Follow-Up Homes

- [../../RELIABILITY.md](../../RELIABILITY.md)
- [../../references/provider-workflow-lessons.md](../../references/provider-workflow-lessons.md)
- [../../references/observability-and-acceptance.md](../../references/observability-and-acceptance.md)
- [../../exec-plans/tech-debt-tracker.md](../../exec-plans/tech-debt-tracker.md)
- [../../exec-plans/active/paragraph-mode-and-provider-validation.md](../../exec-plans/active/paragraph-mode-and-provider-validation.md)
