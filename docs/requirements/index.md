# Requirements Index

This directory stores requirement memory across the full lifecycle of the product.

## Canonical Entry Points

- [active/index.md](./active/index.md)
  active requirement streams, each with a `PRD.md` and `CHANGELOG.md`
- [history/index.md](./history/index.md)
  global requirement timeline across major product changes
- [archive/index.md](./archive/index.md)
  superseded or closed requirement documents kept for historical traceability

## Rules

- Every active requirement stream lives under `active/<initiative-slug>/`.
- Every active stream must contain:
  - `PRD.md`
  - `CHANGELOG.md`
- Every requirement change should update:
  - the initiative `CHANGELOG.md`
  - [history/timeline.md](./history/timeline.md)

## Notes

- `codex/logs/` records execution history, not canonical requirement history.
- Formal markdown that influenced product or design decisions should stay in this system even after it becomes historical.

## Precedence

- A requirement `PRD.md` owns:
  - product intent
  - scope boundaries
  - user-visible behavior
  - success criteria
- A linked execution plan owns:
  - implementation order
  - task breakdown
  - verification sequencing
- If a PRD and execution plan diverge, update the PRD first and then align the execution plan to it.
