# GitHub Release Flow Skill

Use this skill with two commands only.

Primary commands:

`/ship <one-line-task-intent>`
`/land`

Optional exception:

`/ship --no-pr <one-line-task-intent>`
`/land --keep-branch`

## Minimal Memory Rule

Only remember:

1. `/ship` = submit changes and create/update PR flow
2. `/land` = merge approved PR and sync/cleanup

Natural language fallback is supported:

- "submit this change" -> `/ship`
- "merge this PR" -> `/land`

## Samples

1. `/ship add logging compliance workflow and create draft pr`
2. `/ship fix session step pointer mismatch and prepare draft pr`
3. `/ship update AGENTS rules and open draft pr for review`
4. `/ship continue current branch work and refresh draft pr body`
5. `/ship prepare release handoff after passing check:logs`
6. `/ship --no-pr backup branch changes only`
7. `/land`
8. `/land --keep-branch`

## What the Skill Does

- Decide whether to create a new branch or reuse the current branch.
- Suggest a normalized branch name.
- Run preflight checks before commit/push.
- Keep commit scope focused on the current objective.
- Create a draft PR by default after push.
- Merge approved PRs with `/land` using squash by default.
- Sync local `main` after merge.
- Produce concise push/PR handoff output with PR URL.
