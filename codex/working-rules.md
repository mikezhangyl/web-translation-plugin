# Working Rules

## 1. Small-Step Development

- Split work into minimal, testable increments.
- Complete one clear step before starting the next.

## 2. Mandatory Logging

- Every user instruction must be logged to `codex/logs/session-*.md`.
- Each step record must include:
  - Raw instruction
  - Understanding
  - Plan
  - Actions taken
  - Validation
  - Result

## 3. No Large Changes

- Avoid broad refactors or multi-feature edits in one step.
- Keep each commit/readable delta focused and reversible.

## 4. MVP-First Principle

- Prioritize a working baseline over feature completeness.
- Defer non-essential optimizations and abstractions.
