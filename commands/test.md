---
description: Compatibility shim for `/test`. Delegates to `skills/local-test-flow/SKILL.md` with sub-agent-only execution by default.
---

# /test (Compatibility Shim)

Use `local-test-flow` skill as the canonical implementation.
Execution policy:

1. Always delegate to `agents/test-runner.md`.
2. Main thread does not run test commands directly.
3. If sub-agent execution is unavailable, return `BLOCKED` and ask for explicit fallback authorization.

Supported scopes:

- `quick`
- `harness`
- `pre-ship`

Default scope when omitted:

- `pre-ship`
