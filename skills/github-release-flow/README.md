# GitHub Release Flow Skill

Use this skill with the `/ship` trigger.

Format:

`/ship <one-line-task-intent>`

Optional exception:

`/ship --no-pr <one-line-task-intent>`

## Samples

1. `/ship add logging compliance workflow and create draft pr`
2. `/ship fix session step pointer mismatch and prepare draft pr`
3. `/ship update AGENTS rules and open draft pr for review`
4. `/ship continue current branch work and refresh draft pr body`
5. `/ship prepare release handoff after passing check:logs`
6. `/ship --no-pr backup branch changes only`

## What the Skill Does

- Decide whether to create a new branch or reuse the current branch.
- Suggest a normalized branch name.
- Run preflight checks before commit/push.
- Keep commit scope focused on the current objective.
- Create a draft PR by default after push.
- Produce concise push/PR handoff output with PR URL.
