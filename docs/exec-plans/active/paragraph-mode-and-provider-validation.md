# Paragraph Mode And Provider Validation

## Governing Requirement

- Governing PRD: [../../requirements/active/paragraph-mode-stabilization/PRD.md](../../requirements/active/paragraph-mode-stabilization/PRD.md)
- This plan owns sequencing and work decomposition.
- The governing PRD owns product intent, scope, and success criteria.
- If they diverge, update the PRD first and then realign this plan.

## Status

- Status: active
- Theme: stabilize the next translation mode without losing the current provider/configuration contract

## Why This Plan Exists

- Word and short-phrase flash-card mode is stable.
- Sentence translation is stable.
- Paragraph translation is still exploratory and does not yet have a clear product contract.
- The old repository exposed real provider workflow lessons, but the new repository should keep only the durable rules:
  - docs first
  - curl connectivity second
  - integration wiring third
  - live E2E last

## Goal

Make paragraph translation a deliberate, testable product mode while preserving storage-only runtime configuration, strong diagnostics, and live-provider acceptance discipline.

## Scope

In scope:

- paragraph selection contract and UX rules
- provider validation sequence for future provider/model work
- trace visibility for accepted translation modes
- durable capture of verified provider quirks

Out of scope:

- restoring old workflow layers such as `skills/`, `commands/`, `agents/`, or `harness/`
- broad redesign of the popup or translation card
- adding multiple new providers at once

## Workstreams

### 1. Paragraph Product Contract

- define supported paragraph length and rejection behavior
- decide what the card should render for paragraph output
- keep word/flash-card and sentence/plain-translation behavior unchanged

### 2. Provider Validation Rules

- keep `docs -> curl -> integration -> live E2E` as the default for first-time provider or model-family work
- record verified base URLs, auth shape, and accepted model names in docs instead of session-only notes
- preserve the current rule that runtime requests use saved storage values only

### 3. Diagnostics And Acceptance Hardening

- ensure paragraph success and failure states are visible in popup troubleshooting logs
- keep live E2E as the final acceptance source for provider-backed behavior
- keep mock flows clearly labeled as regression checks only

### 4. Benchmark Boundary

- treat benchmark/comparison settings as diagnostics, not the main user-facing acceptance path
- preserve bounded concurrency if multi-model comparison grows again

## Validation Signals

- paragraph mode has an explicit product contract
- accepted user-visible modes have matching tests and live acceptance criteria
- verified provider quirks are documented in repo docs
- no hidden env fallback reappears in runtime execution

## Exit Criteria

- paragraph mode is either:
  - promoted to a stable path with clear tests and UX rules
  - or explicitly constrained as unsupported with documented reasons
- provider workflow expectations are discoverable from the lightweight repo docs
- future sessions do not need the old repository logs to recover provider rules
