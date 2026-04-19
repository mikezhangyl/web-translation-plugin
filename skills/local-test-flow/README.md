# Local Test Flow Skill

Use one short command:

`/test <scope>`

Short form:

`/test` (defaults to `pre-ship`)

Default execution path:

- Delegate to `agents/test-runner.md` and return summary to main thread.
- Main thread should not run test commands directly.
- If sub-agent is unavailable, return `BLOCKED` and request explicit fallback approval.

Supported scopes:

1. `quick` -> `npm run check:logs`
2. `harness` -> `npm run harness:test`
3. `pre-ship` -> `npm run check:local`

Recommended default:

- `/test pre-ship`

Sample usage:

1. `/test quick`
2. `/test harness`
3. `/test pre-ship`
