# Web Translation Plugin

Browser extension for selection-based web translation, built with Plasmo, React, TypeScript, and Manifest V3.

## Install

```bash
npm install
```

## Dev

```bash
npm run dev
```

Load the unpacked extension from `build/chrome-mv3-dev`.

## Build

```bash
npm run build
```

Production output is generated under `build/chrome-mv3-prod`.

## Package

```bash
npm run package
```

This creates the packaged browser-extension artifact for store submission.

## Provider Setup

Set provider values before running live translation flows:

```bash
export LLM_PROVIDER_FLAVOR="openai-compatible" # or anthropic-compatible
export LLM_API_KEY="your-api-key"
export LLM_BASE_URL="https://api.openai.com"
export LLM_MODEL="gpt-4o-mini"
```

If Plasmo does not pick up shell values during build, set the public equivalents:

```bash
export PLASMO_PUBLIC_LLM_API_KEY="$LLM_API_KEY"
export PLASMO_PUBLIC_LLM_BASE_URL="$LLM_BASE_URL"
export PLASMO_PUBLIC_LLM_MODEL="$LLM_MODEL"
```

Runtime behavior:

- target language defaults to `zh-CN`
- popup settings take precedence over env defaults
- popup display may backfill from env when storage is empty
- actual runtime requests must use stored values only

You can also configure provider settings in the extension popup.

## Tests

Unit and logic tests:

```bash
npm run test:ui-logic
```

Docs integrity check:

```bash
npm run check:docs
```

Codex control-layer check:

```bash
npm run check:codex
```

Session memory check:

```bash
npm run check:memory
```

Mock browser-flow validation:

```bash
npm run test:e2e:mock
```

Live provider translation check:

```bash
npm run test:live
```

Live end-to-end browser flow:

```bash
npm run test:e2e
```

Local validation gates:

```bash
npm run check:local
npm run check:verify
```

Install Playwright's Chromium build once before browser tests:

```bash
npx playwright install chromium
```

## ECC Surfaces

This repository assumes ECC is installed globally. Repo-local control files live in:

- `AGENTS.md`
- `.codex/`
- `docs/`
- `codex/`

Start with:

- `docs/index.md`
- `AGENTS.md`
