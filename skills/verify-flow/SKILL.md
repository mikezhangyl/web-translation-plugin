---
name: verify-flow
description: Standardize repository verification before review or release. Use `/verify` to run local gates in fixed order with graceful fallback when a command is unavailable.
---

# Verify Flow

Use this skill for pre-review and pre-ship verification.

## Trigger Phrase

`/verify`

Optional:

`/verify quick`

## Verification Order

Default order:

1. `npm run check:local`
2. `npm run build`
3. `npm run package`

Quick mode:

1. `npm run check:local`

## Fallback Rule

If `build` or `package` script is not available, skip that step and mark it as `SKIPPED`.

## Output Contract

Return:

- Mode (`default` or `quick`)
- Commands executed
- Per-step status (`PASS` / `FAIL` / `SKIPPED`)
- Overall status (`READY` / `NOT READY`)
- If failed:
  - failing command
  - first actionable error line
  - next single fix action
