---
name: plan-flow
description: Lightweight planning skill for this repository. Use `/plan` to output a decision-ready implementation plan with four required sections.
---

# Plan Flow

Use this skill before non-trivial code changes.

## Trigger Phrase

`/plan <task-intent>`

## Required Sections

Every plan must contain exactly these sections:

1. Goal
2. Scope
3. Acceptance Criteria
4. Risks

## Constraints

- Keep plan aligned with existing repository conventions.
- Keep plan implementation-ready (no unresolved key decisions).
- Prefer incremental steps over large batch changes.

## Output Contract

Return the plan with the four required sections only, concise and executable.
