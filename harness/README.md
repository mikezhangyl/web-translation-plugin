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

Step 3. Inspect generated report.

```bash
cat harness/reports/latest.json
```

Step 4. Add your next scenario under `harness/scenarios/` using the same structure.

Current built-in scenarios:

- `dry-run.translation.baseline` (intentionally mismatch sample, demonstrates diff output)
- `dry-run.translation.variant` (intentionally matched sample)

Diff output uses nested paths, for example:

- `metadata.generator`

## Structure

- `config/` for harness configuration templates.
- `contracts/` for harness interface definitions and schema contracts.
- `fixtures/` for deterministic input/output samples.
- `scenarios/` for execution scenario definitions.
- `scripts/` for harness runner logic.
- `tests/` for harness-level smoke/regression checks.
- `reports/` for generated harness run results.

No extension business logic is included at this stage.
