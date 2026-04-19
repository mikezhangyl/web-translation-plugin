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

## Translation Provider Setup (MVP)

Set environment variables before running `npm run dev` or `npm run build`:

```bash
export AZURE_TRANSLATOR_KEY="your-azure-key"
export AZURE_TRANSLATOR_REGION="your-azure-region"
export DEEPL_API_KEY="your-deepl-key"
export DEEPL_API_URL="https://api-free.deepl.com/v2/translate"
```

If your shell env is not picked up by Plasmo build, set `PLASMO_PUBLIC_*` equivalents:

```bash
export PLASMO_PUBLIC_AZURE_TRANSLATOR_KEY="$AZURE_TRANSLATOR_KEY"
export PLASMO_PUBLIC_AZURE_TRANSLATOR_REGION="$AZURE_TRANSLATOR_REGION"
export PLASMO_PUBLIC_DEEPL_API_KEY="$DEEPL_API_KEY"
export PLASMO_PUBLIC_DEEPL_API_URL="$DEEPL_API_URL"
```

Provider strategy in MVP:

- primary: Azure Translator (F0)
- fallback: DeepL Free
- target language default: `zh-CN`

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

- success path: select text -> loading -> Azure success
- fallback path: Azure rate-limited -> DeepL success
- failure path: both providers fail -> error UI + placeholder details

Note: E2E uses internal mock modes on `example.com` to make provider behavior deterministic.
