# Branch Naming Reference

## Objective

Keep branch names short, readable, and directly tied to one objective.

## Format

Use:

`type/scope-short-topic`

Scope is optional:

`type/short-topic`

## Type Prefixes

- `feat`: user-visible feature
- `fix`: bug or regression fix
- `chore`: maintenance, tooling, or workflow update
- `docs`: documentation-only changes
- `refactor`: structural code change without behavior change
- `test`: test-only updates

## Rules

- Use lowercase only.
- Use hyphen separators.
- Keep names concise (target under 40 characters).
- Avoid date stamps, usernames, and unrelated ticket noise.
- Use one branch per objective.

## Examples

- `chore/logging-github-skill`
- `feat/popup-translation-mvp`
- `fix/log-step-sequence-check`
