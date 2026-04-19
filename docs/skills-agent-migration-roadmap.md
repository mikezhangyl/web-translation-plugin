# Skills/Agents Migration Roadmap

## Objective

Adopt a skills-first workflow with thin command compatibility and minimal, role-focused sub-agent templates.

## Phase A (Implemented)

1. Governance policy updated:
   - `skills/` canonical
   - `commands/` compatibility-only
2. Core execution skills:
   - `github-release-flow`
   - `local-test-flow`
   - `verify-flow`
   - `review-flow`
3. Core command shims:
   - `/ship`, `/land`, `/test`, `/verify`, `/review`, `/plan`
4. Unified preflight gate:
   - `npm run check:local`

## Phase B (Weekly Iterations)

### Week 1: Planning

- `plan-flow` used as mandatory planning surface for non-trivial work.

### Week 2: Sub-Agent Role Lock

- Use role templates:
  - `agents/test-runner.md`
  - `agents/planner.md`
  - `agents/code-reviewer.md`
  - `agents/build-error-resolver.md`

### Week 3: Context Governance

- Apply `context-policy` for summary cadence and task splitting.

## Phase C (Continuous Adoption Gate)

At most one new skill OR one new agent template per iteration.

Every addition must pass:

1. Direct relevance to translation-plugin engineering goals.
2. Runnable with current repository tooling.
3. No heavy external runtime dependency.
4. Explicit validation command and expected result.
