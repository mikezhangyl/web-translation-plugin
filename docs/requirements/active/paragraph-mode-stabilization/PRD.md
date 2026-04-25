---
status: active
created: 2026-04-24
updated: 2026-04-24
source:
  - repo: web-translation-plugin
    path: docs/exec-plans/active/paragraph-mode-and-provider-validation.md
related_prs: []
supersedes: []
superseded_by: []
---

# PRD: Paragraph Mode Stabilization

## Summary

Define and validate paragraph translation as an intentional product mode without regressing the accepted flash-card and sentence paths.

## Relation To Execution Plan

- Related implementation plan: [../../../exec-plans/active/paragraph-mode-and-provider-validation.md](../../../exec-plans/active/paragraph-mode-and-provider-validation.md)
- This PRD owns product intent, scope, user-visible behavior, and success criteria.
- The related execution plan owns implementation sequencing and task breakdown.
- If this PRD and the execution plan diverge, update this PRD first and then align the plan.

## Current Context

- Word and short phrase selections are stable in flash-card mode.
- Sentence selections are stable in plain translation mode.
- Paragraph translation is directionally possible but still lacks a stable product contract.

## Goals

- define what counts as a supported paragraph selection
- define how paragraph output should render in the card
- keep runtime configuration storage-only
- keep paragraph behavior visible through popup troubleshooting logs
- make paragraph acceptance testable in both logic and browser flows

## Non-Goals

- adding multiple new providers at once
- reintroducing the old workflow surface
- redesigning the popup or translation card outside what paragraph support requires

## Product Constraints

- Word and short-phrase flash-card behavior must remain unchanged.
- Sentence plain-translation behavior must remain unchanged.
- Paragraph mode must initially accept only a single paragraph at a time.
- Paragraph mode must reject selections longer than `250` whitespace-delimited words or `1500` characters.
- Over-limit or multi-paragraph selections must open a user-visible guidance card instead of silently disappearing.
- Popup display may use env defaults, but runtime requests must continue using saved storage values only.
- Live E2E remains the final acceptance path for provider-backed behavior.

## Success Criteria

- paragraph mode is either clearly promoted to supported behavior or explicitly constrained as unsupported
- the rendering rules for paragraph output are documented
- tests cover the accepted paragraph behavior and failure boundaries
- troubleshooting logs remain sufficient to explain paragraph success and failure flows
