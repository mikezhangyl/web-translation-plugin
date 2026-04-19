---
description: Compatibility shim for `/land`. Delegates to `skills/github-release-flow/SKILL.md`.
---

# /land (Compatibility Shim)

Use `github-release-flow` skill as the canonical implementation.

- Resolve PR from current branch when possible.
- Merge approved PR (squash by default).
- Sync local `main` after merge.
