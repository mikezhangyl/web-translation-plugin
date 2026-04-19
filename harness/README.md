# Harness Engineering Scaffold

This directory contains a runnable baseline skeleton for harness engineering work.

## Scope

- Define repeatable test harness interfaces.
- Isolate harness concerns from extension business logic.
- Provide a stable place for future harness runners and fixtures.

## Step-by-Step Learning Path

Step 1. Run the baseline harness once.

```bash
npm run harness:run
```

Step 2. Run the harness smoke test.

```bash
npm run harness:test
```

Optional: run smoke suites independently for faster failure localization.

```bash
npm run harness:test:positive
npm run harness:test:negative
```

CI also runs these suites as separate jobs (`harness-positive` and `harness-negative`)
via `.github/workflows/harness-smoke.yml`.
Each job uploads `harness/reports/latest.json` as an artifact for debugging.

Step 3. Inspect generated report.

```bash
cat harness/reports/latest.json
```

Step 4. Add your next scenario under `harness/scenarios/` using the same structure.

Current built-in scenarios:

- `dry-run.translation.baseline` (intentionally mismatch sample, demonstrates diff output)
- `dry-run.translation.variant` (intentionally matched sample)
- `dry-run.translation.edge-null-missing` (edge case: missing key + null value handling)
- `dry-run.translation.invalid-extra-field` (intentionally invalid schema, for negative smoke test)

Diff output uses nested paths, for example:

- `metadata.generator`

Value-level diff output is also available in `comparison.differences`, each entry containing:

- `path`
- `actual`
- `expected`

Scenario loading now enforces strict schema validation from
`harness/contracts/scenario.schema.json` (including `additionalProperties: false`).

## Structure

- `config/` for harness configuration templates.
- `contracts/` for harness interface definitions and schema contracts.
- `fixtures/` for deterministic input/output samples.
- `scenarios/` for execution scenario definitions.
- `scripts/` for harness runner logic.
- `tests/` for harness-level smoke/regression checks.
- `reports/` for generated harness run results.

No extension business logic is included at this stage.
