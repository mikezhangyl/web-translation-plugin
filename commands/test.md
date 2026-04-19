---
description: Compatibility shim for `/test`. Delegates to `skills/local-test-flow/SKILL.md`.
---

# /test (Compatibility Shim)

Use `local-test-flow` skill as the canonical implementation.
By default, delegate execution to `agents/test-runner.md` and return only summary output.

Supported scopes:

- `quick`
- `harness`
- `pre-ship`
