---
description: Compatibility shim for `/ship`. Delegates to `skills/github-release-flow/SKILL.md`.
---

# /ship (Compatibility Shim)

Use `github-release-flow` skill as the canonical implementation.

- Keep preflight on `npm run check:local`.
- Create draft PR by default.
- Delegate Git mutations to `agents/git-operator.md`.
- Return concise handoff summary.
