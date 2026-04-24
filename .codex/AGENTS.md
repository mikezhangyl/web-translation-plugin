# Codex Supplement

This repository keeps Codex-specific settings in `.codex/` and repo-specific operating guidance in the root `AGENTS.md`.

## Usage Order

1. Read root `AGENTS.md`.
2. Use `.codex/config.toml` as the project-local Codex baseline.
3. Use `.codex/agents/*.toml` for optional multi-agent delegation when the task benefits from focused read-only support.

## Local Role Set

- `explorer`
  - read-only codebase discovery before non-trivial changes
- `reviewer`
  - owner-style review focused on correctness, regressions, and missing tests
- `docs_researcher`
  - verification against official provider, browser-extension, and framework docs

## Delegation Handshake

- This repository uses opt-in delegation, not silent delegation.
- Before substantial work, classify the task as either:
  - main-thread default
  - delegation recommended
- If delegation is recommended, ask the user before starting a child agent.
- The ask should include:
  - why delegation is recommended
  - the suggested role (`explorer`, `reviewer`, or `docs_researcher`)
  - a clear choice between main-thread execution and sub-agent execution
- If the user does not approve delegation, continue on the main thread.
- Use `docs/references/sub-agent-delegation.md` for the durable scoring rule and examples.

## ECC Assumption

This repository assumes ECC generic skills are installed globally for Codex. It intentionally does not ship repo-local `.agents/skills/`, `skills/`, `commands/`, or `agents/` directories.
