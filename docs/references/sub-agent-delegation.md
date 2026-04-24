# Sub-Agent Delegation

This repository uses a user-visible delegation gate instead of silent child-agent execution.

## Goal

Keep the main thread focused on decisions and implementation while still using sub-agents when they reduce noise or enable clean parallel work.

## Hard Rule

- The main agent decides whether delegation is recommended.
- If delegation is recommended, the main agent must ask the user before starting a sub-agent.
- Without explicit user approval, the work stays on the main thread.

This policy does not override harness-level restrictions. It standardizes the decision and the ask pattern inside this repository.

## Decision Rule

Keep the work on the main thread if any of these are true:

- the result is needed immediately for the very next edit or decision
- the task is small enough to do directly with less overhead than delegation
- the work is tightly coupled to an in-progress edit and would create avoidable sync cost

Otherwise, count the delegation signals below. If two or more are true, delegation is recommended and the user should be asked.

## Delegation Signals

- the task is primarily read-only or evidence gathering
- the task is expected to produce noisy output such as long logs, broad file scans, or large doc extracts
- the task can run in parallel with useful main-thread work
- the task cleanly matches an existing repo role
- the task is broad enough that an independent pass is more valuable than inline multitasking

## Role Mapping

- `explorer`
  use for codebase tracing, architecture discovery, symbol/file mapping, and read-only evidence gathering before edits
- `reviewer`
  use for independent review after non-trivial changes, especially for regressions, correctness risks, and missing tests
- `docs_researcher`
  use for official-doc verification of provider behavior, browser-extension behavior, framework APIs, and release-note claims

## Ask Pattern

When delegation is recommended, ask in one short message:

1. why delegation is recommended
2. which role is recommended
3. whether the user wants sub-agent execution or main-thread execution

Suggested wording:

```text
This task is a good fit for a sub-agent because it is read-heavy and likely to produce noisy output. Recommended role: reviewer. Do you want me to run it in a sub-agent or keep it on the main thread?
```

## No-Repeat Rule

- If the user chooses the main thread, continue there and do not ask again unless the task shape materially changes.
- If the user approves delegation, keep the sub-agent scoped to the stated role and return only the high-signal result to the main thread.

## Examples

Recommend delegation:

- large read-only codebase exploration before a refactor
- independent review after a multi-file change
- primary-doc lookup for provider/platform behavior
- long-running test or log gathering that can run while the main thread keeps working

Keep on the main thread:

- a one-file fix that blocks the very next step
- a tiny review where the changed surface is already in active context
- an edit where the cost of explaining the current state to a child exceeds the value of delegation
