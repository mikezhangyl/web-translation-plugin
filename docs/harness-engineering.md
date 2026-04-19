# Harness Engineering Plan (Scaffold Stage)

## Objective

Establish a dedicated harness layer for repeatable scenario execution and validation, independent from extension feature code.

## Current Stage

Runnable minimal harness scaffold:

- Configuration template available (`harness/config/`).
- Scenario contract schema available (`harness/contracts/scenario.schema.json`).
- Dry-run scenario and deterministic fixtures available.
- Harness runner script available (`harness/scripts/run-harness.mjs`).
- Smoke test available (`harness/tests/smoke.mjs`).
- Report output path available (`harness/reports/latest.json`).

## Next Suggested Build Order

1. Introduce a second scenario with different fixture shape.
2. Add contract-level validation against schema (strict JSON schema enforcement).
3. Add regression comparison helper for expected vs actual output artifacts.
