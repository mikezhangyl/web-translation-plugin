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

## Logging Compliance

Run log validation locally:

```bash
npm run check:logs
```

This validates:

- `codex/current-session.md` format and next step pointer.
- `codex/log-template.md` exact required structure.
- Active session log step sequence and required section completeness.
- Session rollover policy (`session-001.md`, `session-002.md`, `session-003.md`) and max 100 steps per session file.
