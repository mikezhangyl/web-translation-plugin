---
name: local-test-flow
description: Standardize local verification before `/ship` and during implementation. Use `/test` to run focused local checks via the `test-runner` sub-agent by default and return concise PASS/FAIL evidence.
---

# Local Test Flow

Use this skill whenever local verification is needed.
Default behavior is to keep main-thread context short by delegating test execution to the `test-runner` sub-agent.

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

## Sub-Agent Rule (Default)

Default path:

1. Delegate test execution to `agents/test-runner.md`.
2. Keep main-thread output short and structured.
3. Return only high-signal results to the main thread.

Fallback path:

- If sub-agent execution is unavailable in the runtime, execute commands directly and keep the same output contract.

## Workflow

1. Resolve requested scope (`quick`, `harness`, `pre-ship`).
2. Delegate to `test-runner` with selected scope and mapped command(s).
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
