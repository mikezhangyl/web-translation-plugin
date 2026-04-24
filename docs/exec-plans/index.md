# Execution Plans Index

This directory holds active implementation plans and cross-cutting deferred follow-up.

## Canonical Files

- [active/index.md](./active/index.md)
  active implementation plans
- [tech-debt-tracker.md](./tech-debt-tracker.md)
  cross-cutting gaps that are real but not necessarily active in the current turn

## Notes

- Active sequencing belongs in `active/`.
- Durable unresolved gaps belong in the tech-debt tracker.

## Precedence

- An execution plan does not replace a governing PRD.
- Where a requirement PRD exists, the PRD owns product intent, scope, and success criteria.
- The execution plan owns implementation sequencing and work decomposition only.
- If the two diverge, fix the PRD first and then update the plan.
