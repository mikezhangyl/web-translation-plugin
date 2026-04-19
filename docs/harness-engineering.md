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
- Smoke suites split for CI diagnostics:
  - `harness/tests/smoke.positive.mjs`
  - `harness/tests/smoke.negative.mjs`
- CI smoke workflow available with separate jobs:
  - `.github/workflows/harness-smoke.yml`
  - `harness-positive`
  - `harness-negative`
- Report output path available (`harness/reports/latest.json`).
- Strict scenario schema validation enabled in runner
  (`harness/contracts/scenario.schema.json`).
- Negative schema smoke case available
  (`harness/scenarios/invalid.extra-field.json`).
- Comparison payload available in reports:
  - `comparison.match`
  - `comparison.diffKeys` (nested path format, for example `metadata.generator`)
  - `comparison.differences` (value-level path diff entries with `actual` and `expected`)
  - `comparison.actual`
  - `comparison.expected`

## Next Suggested Build Order

1. Add optional schema versioning strategy for future harness contract evolution.
2. Add fixture-level edge cases for missing keys and null values in nested objects.
3. Publish `harness/reports/latest.json` as a CI artifact for failing runs to speed debugging.
