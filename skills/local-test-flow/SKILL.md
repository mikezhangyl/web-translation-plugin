---
name: local-test-flow
description: Standardize local verification before `/ship` and during implementation. Use `/test` to run focused local checks, preferably via a sub-agent, and return a concise PASS/FAIL report with failing command details.
---

# Local Test Flow

Use this skill whenever local verification is needed.
Default behavior is to keep main-thread context short by delegating test execution to a sub-agent when available.

## Trigger Phrase

Primary trigger:

`/test <scope>`

Examples:
- `/test quick`
- `/test harness`
- `/test pre-ship`

If no scope is provided, default to `pre-ship`.

## Scope Mapping

- `quick` -> `npm run check:logs`
- `harness` -> `npm run harness:test`
- `pre-ship` -> `npm run check:local`

## Sub-Agent Rule

When sub-agent delegation is available:

1. Delegate test execution to a sub-agent.
2. Keep main-thread output short and structured.
3. Return only high-signal results to the main thread.

If sub-agent delegation is unavailable, run commands directly and keep the same output contract.

## Workflow

1. Resolve requested scope (`quick`, `harness`, `pre-ship`).
2. Run mapped command(s).
3. Capture exit code and key failures.
4. Return a compact test report.

## Output Contract

At the end, return:

- Scope executed
- Commands run
- Result (`PASS` or `FAIL`)
- If failed:
  - failing command
  - first actionable error line
  - suggested next single fix action
