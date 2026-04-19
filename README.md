# Vibe Coding OS Translation Plugin

Minimal Plasmo extension scaffold (React + TypeScript + Manifest V3).

## Install

```bash
npm install
```

## Dev

```bash
npm run dev
```

Load unpacked extension from:

- `build/chrome-mv3-dev`

## Build

```bash
npm run build
```

Production output is generated under:

- `build/chrome-mv3-prod`

## Harness Scaffold

Harness engineering scaffold files are located under:

- `harness/`
- `docs/harness-engineering.md`

## Workflow Surfaces

Canonical workflow implementation lives in `skills/`.

Current core skills:

- `skills/github-release-flow`
- `skills/local-test-flow`
- `skills/verify-flow`
- `skills/review-flow`
- `skills/plan-flow`
- `skills/context-policy`

Compatibility command shims live in `commands/` and delegate to skills:

- `/ship`, `/land`, `/test`, `/verify`, `/review`, `/plan`

Sub-agent role templates live in `agents/`:

- `planner`
- `code-reviewer`
- `build-error-resolver`

## Logging Compliance

Run log validation locally:

```bash
npm run check:logs
```

Run unified local release gate:

```bash
npm run check:local
```

This validates:

- `codex/current-session.md` format and next step pointer.
- `codex/log-template.md` exact required structure.
- Active session log step sequence and required section completeness.
- Session rollover policy (`session-001.md`, `session-002.md`, `session-003.md`) and max 100 steps per session file.

## E2E Automation (Playwright)

Install Playwright browser once:

```bash
npx playwright install chromium
```

Run selection-flow E2E:

```bash
npm run test:e2e
```

This test loads the extension from `build/chrome-mv3-prod` and verifies:

- select text -> translation dot appears
- hover dot -> translation card appears
- press `Escape` -> translation card closes
