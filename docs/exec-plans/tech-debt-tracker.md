# Tech Debt Tracker

Repository-level technical debt and deferred follow-up items.

## Active Debt

| Area | Priority | Gap | Next Step |
| --- | --- | --- | --- |
| Provider knowledge memory | P0 | Verified provider facts and quirks do not yet have a dedicated durable template. | Define a reusable provider-memory document before the next new provider or model-family integration. |
| Acceptance vocabulary | P0 | It is still easy for status reporting to blur `mock`, `live`, `partial`, `blocked`, and `unstable`. | Keep the vocabulary explicit across docs, tests, and future summaries. |
| Paragraph product contract | P0 | Paragraph translation still lacks a fully settled requirement and rendering contract. | Drive the active paragraph-mode PRD and implementation plan to a supported or explicitly constrained outcome. |
| Trace consistency | P1 | Not every rendered or cached result is guaranteed to have one obvious trace back to a request or reuse event. | Tighten event coverage and assertions as provider-facing behavior evolves. |
| Concurrency guardrails | P1 | Bounded concurrency is a known rule, but comparison and future provider expansion still rely partly on convention. | Preserve bounded behavior and make overload handling explicit where multi-model work grows. |
| Documentation lifecycle discipline | P1 | The new docs system now has history/archive layers, but it still needs consistent upkeep as requirements change. | Keep initiative changelogs and the requirement timeline updated alongside future requirement changes. |

## Notes

- This file tracks deferred or cross-cutting gaps.
- Active execution sequencing belongs in [active/index.md](./active/index.md).
- Issue-source material lives in [../issues/open/provider-workflow-retrospective.md](../issues/open/provider-workflow-retrospective.md).
