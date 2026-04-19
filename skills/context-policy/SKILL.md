---
name: context-policy
description: Keep main-thread context compact during multi-step execution. Use `/context` to decide when to summarize, split tasks, or delegate.
---

# Context Policy

Use this skill to prevent long-thread context bloat.

## Trigger Phrase

`/context`

## Policy

1. Keep main-thread updates high-signal and short.
2. Summarize after each major completed batch.
3. Delegate bounded side tasks (tests/review) to sub-agent roles where available.
4. If one thread accumulates too many unrelated decisions, split by objective.

## Practical Thresholds

- If response drafts exceed ~15 lines repeatedly, compress to summary + next action.
- If there are more than 3 independent workstreams, split ownership.
- After each `/ship`, write a one-paragraph checkpoint summary before starting next objective.

## Output Contract

Return:

- Current context risk (`LOW` / `MEDIUM` / `HIGH`)
- Compression action
- Delegation/splitting action
- Next single step
