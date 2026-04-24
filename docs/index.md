# Docs Index

This directory is the durable system of record for `web-translation-plugin`.

Use it in this order:

1. current canonical docs
2. active requirements and execution plans
3. references, issue inputs, and archived history

## Current Canonical Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [RELIABILITY.md](./RELIABILITY.md)
- [SECURITY.md](./SECURITY.md)
- [product-specs/current-state.md](./product-specs/current-state.md)

## Partition Indexes

- [product-specs/index.md](./product-specs/index.md)
  current product-facing behavior and acceptance shape
- [requirements/index.md](./requirements/index.md)
  active PRDs, requirement changelogs, and the global requirement timeline
- [design/index.md](./design/index.md)
  design history and future design-document home
- [issues/index.md](./issues/index.md)
  open issue-input notes and resolved follow-up records
- [references/index.md](./references/index.md)
  concise reusable lessons and reference contracts
- [exec-plans/index.md](./exec-plans/index.md)
  active implementation plans plus cross-cutting technical debt
- [archive/index.md](./archive/index.md)
  archived snapshots and older-but-useful historical material

## Notes

- `codex/logs/` is execution history, not canonical product or requirement history.
- Historical and issue-input docs are intentionally preserved, but they should not be read as current normative rules unless they are linked from the canonical docs above.
- `docs/generated/` is intentionally not created yet. Add it only when generated docs become a real committed surface.
- Run `npm run check:docs` to verify docs links, required indexes, requirement-file completeness, and portable provenance rules.

## Metadata Conventions

- Historical or derived docs may use frontmatter fields such as:
  - `status`
  - `created`
  - `updated`
  - `source`
  - `related_prs`
  - `supersedes`
  - `superseded_by`
- `source` must use repo-portable provenance, not machine-local absolute filesystem paths.
- Recommended `source` shape:

```yaml
source:
  - repo: web-translation-plugin
    path: docs/example.md
```
