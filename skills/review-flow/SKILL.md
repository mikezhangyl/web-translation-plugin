---
name: review-flow
description: Standardize local change review before merge. Use `/review` to produce severity-ranked findings and block on high-risk issues.
---

# Review Flow

Use this skill to review local changes before converting PR to ready or before merge.

## Trigger Phrase

`/review`

Optional:

`/review <path>`

## Scope Rule

If path is not specified, review all changed files in `git diff --name-only`.

## Required Checks

1. Gather change scope (`git diff --name-only`).
2. Detect high-risk issues:
   - secret exposure patterns (`sk-`, `api_key`, `token=`)
   - unsafe command usage in scripts
   - missing validation around new external-input boundaries
3. Detect quality issues:
   - missing tests for new logic paths
   - TODO/FIXME in modified code
   - noisy debug output in committed code

## Severity Model

- `HIGH`: must be fixed before merge
- `LOW`: recommended follow-up

## Blocking Rule

Any `HIGH` finding means `BLOCKED`.
No `HIGH` findings means `READY`.

## Output Contract

Return:

- Reviewed files
- Findings grouped by `HIGH` then `LOW`
- Overall decision (`READY` / `BLOCKED`)
- Next single action
