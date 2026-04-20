# Provider Workflow Retrospective and TODO

## Context

This note captures lessons from recent provider integration, debugging, and workflow design work in the translation plugin. It is intended to preserve the main engineering takeaways and convert them into a small prioritized backlog for later follow-up.

## What Happened

Recent provider work exposed a repeated pattern of workflow friction:

- Live behavior did not always match mock expectations, which made some earlier checks look stronger than they really were.
- Some "pass" judgments were too weak because they did not reflect the final user-visible acceptance condition.
- Observability had to be repaired during active debugging, which slowed down diagnosis and created avoidable ambiguity.
- Parallel multi-model comparison exposed upstream overload behavior and showed that raw full parallelism is not automatically a good default.
- A curl connectivity test was attempted before a doc-first verification pass, which repeated an earlier workflow mistake.

## Lessons Learned

### Provider onboarding

- Doc-first must be the default for first-time provider, model, or protocol work.
- Curl-before-UI should be treated as the hard connectivity gate for real provider debugging.
- Live integration is the final acceptance source of truth; mock paths are useful, but they are not final proof.

### Testing and acceptance

- Test outcome labels need to be stricter and more precise.
- "Mock pass", "live pass", "partial", "blocked", and "unstable" should not be collapsed into a generic "pass".
- Real user-visible completion criteria must drive E2E assertions.

### Observability

- Observability is a first-class workflow requirement, not optional support tooling.
- If request, render, cache, and failure paths are not all traceable, debugging becomes guesswork.
- Logging consistency matters as much as logging volume; missing fields and unstable ordering weaken the entire debugging loop.

### Execution strategy

- Bounded concurrency is safer than naive full parallelism when upstream services can overload.
- Sub-agents are still the right default for document research, testing, and review because they protect main-thread context quality.
- Provider-specific knowledge needs a reusable memory layer so the same protocol mistakes are not repeated.

## Process Gaps Exposed

- Provider document lookup is expected, but not yet enforced strongly enough to prevent skipping it.
- Verified provider knowledge is not being persisted in a reusable, structured project memory.
- Acceptance/result vocabulary has been too loose, especially around mock vs live outcomes.
- Skill and command discoverability remains weaker than the workflow surface itself.
- Observability improvements were applied reactively instead of being required up front for provider-facing work.

## TODO

### P0

- Define and enforce a provider onboarding flow: `docs -> curl -> integration -> live e2e`.
- Add a dedicated doc-research sub-agent or template to repository governance.
- Add a provider knowledge memory file or template for verified provider facts and known quirks.
- Tighten acceptance and result vocabulary across tests, debugging, and status reporting.

### P1

- Stabilize multi-model execution with bounded concurrency plus retry/backoff for overload-style failures.
- Add trace consistency tests so every rendered result can be traced to request start or a documented cache/inflight reuse event.
- Standardize comparison and logging event schema so provider, model, request path, and render path stay correlated.

### P2

- Improve skill and command discoverability so workflow surfaces are easier to use without memorizing them.
- Revisit the longer-term memory strategy for how provider knowledge should be stored and reused across future sessions.

## Defaults Going Forward

- Use a doc-first workflow for first-time provider, model, or protocol investigation.
- Require a curl connectivity gate before plugin or UI debugging for real provider work.
- Treat live integration as the final acceptance source of truth.
- Treat mock flows as simulation only, not final proof of end-to-end behavior.
- Write down provider-specific quirks after the first verified successful integration.
