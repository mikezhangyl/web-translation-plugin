# AGENTS

Repository-specific operating guide for `web-translation-plugin`.

## Start Here

1. Read this file first.
2. Use `docs/index.md` as the entrypoint into the durable docs system.
3. Use `codex/` for session continuity and work logs.
4. Treat `.codex/` as the project-local Codex control layer.
5. Rely on the globally installed ECC skills for generic workflows; keep this file focused on repo facts only.

## Repository Map

- Stack: Plasmo + React + TypeScript + Manifest V3.
- Runtime:
  - `background.ts`
  - `popup.tsx`
  - `contents/selection-translator.tsx`
  - `ui/selection-translator.tsx`
  - `lib/`
- Verification:
  - `tests/`
  - `playwright.config.mjs`
  - `scripts/check-live-gate.mjs`
  - `scripts/run-live-e2e.mjs`
- Durable docs:
  - `docs/index.md`
- Repo-local Codex surfaces:
  - `.codex/config.toml`
  - `.codex/AGENTS.md`
  - `.codex/agents/*.toml`
- Session memory:
  - `codex/current-session.md`
  - `codex/log-template.md`
  - `codex/logs/`

## Product Guardrails

- Word and short-phrase selections use flash-card mode.
- Sentence selections use plain translation mode with no phonetic or example fields.
- Paragraph translation remains exploratory and is not a stable acceptance path yet.
- Popup-visible provider settings may show env-derived defaults when storage is empty.
- Real runtime translation requests must use stored settings only; do not reintroduce hidden env fallback in request execution.
- Troubleshooting logs are part of the product, not optional debugging noise.

## Working Rules

- Keep changes surgical and avoid unrelated refactors.
- Validate behavior with concrete commands before closing work.
- For provider or browser-platform changes, verify against primary docs before implementation.
- For first-time provider or model-family work, follow `docs -> curl -> integration -> live E2E`.
- For LLM invocation changes, do not edit product code first. This means changes to how this product calls a model, not changes to the model itself. If a request changes prompts, message layout, temperature, top-p/top-k or other sampling parameters, structured-output schema, model selection, provider routing, streaming mode, or expected semantic output, first run a provider probe with representative inputs and review the raw outputs with the user. Only implement after the desired invocation behavior is confirmed.
- Treat mock browser flows as regression checks only; final provider acceptance is live E2E.
- Log file-changing instructions in the active session file referenced by `codex/current-session.md`.
- Use the exact section layout from `codex/log-template.md` for each logged step.

## Sub-Agent Gate

- The main thread must first decide whether a task should stay local or be recommended for delegation.
- Do not start a sub-agent silently. If delegation is recommended, ask the user first and let them choose.
- Recommend delegation when the work is high-noise, read-heavy, parallelizable, or a clean fit for one of the repo roles:
  - `explorer`
  - `reviewer`
  - `docs_researcher`
- Keep the work on the main thread when it is tightly coupled to the next edit, immediately blocking, or cheaper to do directly than to synchronize through a child agent.
- If the user declines delegation, continue on the main thread and do not re-ask unless the task shape materially changes.
- Use `docs/references/sub-agent-delegation.md` as the durable reference for the decision rule and ask pattern.

## Core Commands

- `npm run dev`
- `npm run build`
- `npm run package`
- `npm run check:codex`
- `npm run check:docs`
- `npm run check:memory`
- `npm run test:ui-logic`
- `npm run test:e2e:mock`
- `npm run test:live`
- `npm run test:e2e`
- `npm run check:local`
- `npm run check:verify`
