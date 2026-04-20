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
export LLM_PROVIDER_FLAVOR="openai-compatible" # or anthropic-compatible
export LLM_API_KEY="your-api-key"
export LLM_BASE_URL="https://api.openai.com"
export LLM_MODEL="gpt-4o-mini"
```

If your shell env is not picked up by Plasmo build, set `PLASMO_PUBLIC_*` equivalents:

```bash
export PLASMO_PUBLIC_LLM_API_KEY="$LLM_API_KEY"
export PLASMO_PUBLIC_LLM_BASE_URL="$LLM_BASE_URL"
export PLASMO_PUBLIC_LLM_MODEL="$LLM_MODEL"
```

Provider strategy in MVP:

- protocol: OpenAI-compatible or Anthropic-compatible
- routing: single configured provider (no automatic fallback)
- target language default: `zh-CN`

You can also configure provider settings in the extension popup:

1. Open extension popup.
2. Fill Provider Flavor / API Key / Base URL / Model.
3. Keep `Enable troubleshooting logs` switched ON (default).
4. Click `Save`.

Troubleshooting panel in popup:

- shows runtime logs from background and LLM provider adapters
- includes request/response previews and per-request timing (`durationMs`)
- supports `Refresh Logs` and `Clear Logs`

Logs are stored in `chrome.storage.local` and can be toggled by the troubleshooting switch.

Live provider check (uses `.env.local`):

```bash
npm run test:live
```

This runs one real translation request with your configured `LLM_*` values and prints masked config + latency/result.

Popup settings are stored in `chrome.storage.local` and take precedence over environment variables.

Base URL examples:

- OpenAI-compatible: `https://api.openai.com`
- Anthropic-compatible: `https://api.anthropic.com`

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

- success path: select text -> loading -> OpenAI-compatible success
- success path: select text -> loading -> Anthropic-compatible success
- failure path: provider fails -> error UI + placeholder details

Note: E2E uses internal mock modes on `example.com` to make provider behavior deterministic.
