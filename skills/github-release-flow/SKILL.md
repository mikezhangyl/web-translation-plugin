---
name: github-release-flow
description: Standardize branch-based GitHub delivery for this repository. Use when preparing to commit/push with `/ship` and when merging an approved PR with `/land`. Default `/ship` behavior is commit + push + create draft PR, with optional `/ship --no-pr` exception. `/land` merges the active PR and performs branch cleanup/sync. Enforce branch naming, preflight checks, commit scope control, and auditable release handoff.
---

# Github Release Flow

Run a safe, repeatable workflow before any commit/push/PR action.
Keep changes focused, avoid direct work on `main`, and produce a concise handoff summary.

## Trigger Phrase

Primary delivery trigger:

`/ship <one-line-task-intent>`

Exception trigger:

`/ship --no-pr <one-line-task-intent>`

Landing trigger:

`/land`

Landing exception:

`/land --keep-branch`

Examples:
- `/ship add logging compliance workflow and create draft pr`
- `/ship fix popup crash and prepare PR handoff`
- `/ship --no-pr backup current branch changes only`
- `/land`
- `/land --keep-branch`

If only `/ship` is provided without intent, ask for one sentence before continuing.

## Low-Memory Usage Model

Users only need to remember two commands:
- `/ship <intent>`: deliver changes and open/update PR flow
- `/land`: merge approved PR and clean up

If user sends natural language such as "submit this change" or "merge this PR":
- Map "submit" intent to `/ship`.
- Map "merge" intent to `/land`.
- Confirm detected intent in one line, then continue.

## Workflow

1. Clarify one-sentence task intent.
2. Determine whether to create a new branch.
3. Propose branch name from task intent.
4. Run preflight checks.
5. Commit only scoped files.
6. Push the current branch.
7. Create draft PR by default.
8. Prepare PR handoff summary.

## Landing Workflow (`/land`)

1. Resolve target PR:
   - Prefer PR associated with current branch.
   - If missing, stop and ask user for PR number.
2. Validate merge readiness:
   - PR state must be open.
   - PR must not be draft.
   - Approval and checks should be satisfied per repo policy.
3. Merge PR:
   - Default merge method: squash.
   - Command:
     - `gh pr merge <number> --squash --delete-branch`
4. Post-merge sync:
   - `git fetch origin main`
   - `git switch main`
   - `git pull origin main`
5. Output:
   - merged PR URL/number
   - merge method used
   - cleanup result

## 1) Clarify Task Intent

Capture one sentence that states what will be delivered in this branch.
Use this sentence as the source for branch naming and commit summary.

## 2) Branch Decision Rule

Create a new branch only when starting a new objective.
Reuse the current branch when continuing the same objective.

If current branch is `main` and code changes will be committed:
- Create a branch before commit.
- Do not commit directly to `main`.

## 3) Branch Naming

Use:

`type/scope-short-topic`

Allowed `type` values:
- `feat`
- `fix`
- `chore`
- `docs`
- `refactor`
- `test`

Naming constraints:
- Lowercase only.
- Hyphen-separated words.
- No date, no username, no ticket noise unless explicitly required.
- Keep total branch name short (target under 40 characters).

Use helper script:

```bash
python3 skills/github-release-flow/scripts/suggest_branch_name.py --type chore --scope logging --summary "add github release flow skill"
```

See naming rationale:
- `skills/github-release-flow/references/branch-naming.md`

## 4) Preflight Checks

Run in order:

```bash
git status --short
npm run check:logs
```

If any check fails:
- Stop the flow.
- Report the failure and actionable fix.

## 5) Commit Scope Control

Stage only files related to the current objective.
Do not include unrelated generated or local-only files.
Use a focused commit message:

`type(scope): summary`

Examples:
- `chore(logging): add GitHub release flow skill`
- `fix(logs): align next-step pointer validation`

## 6) Push Rule

Push current branch to `origin`.
Do not force push unless explicitly requested.

## 7) Draft PR Rule (Default)

After push, create a draft PR unless the user explicitly invoked `/ship --no-pr`.

Preferred CLI command:

```bash
gh pr create --draft --fill
```

If title/body must be explicit, use:

```bash
gh pr create --draft --title "<title>" --body "<body>"
```

If no PR URL is produced and `/ship --no-pr` was not used, treat the workflow as incomplete.

## 8) PR Handoff Summary

Produce a short handoff with:
- Change intent
- Files touched (high-level)
- Validation commands and outcomes
- Known risks or follow-up items

## Output Contract

At the end of the flow, return:
- Selected branch name
- Commands executed
- Checks passed/failed
- PR URL (required unless `/ship --no-pr`)
- Suggested next single action
