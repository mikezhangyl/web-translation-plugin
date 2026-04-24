# Provider Workflow Lessons

Concise reference for provider validation and acceptance behavior that should survive future integrations.

## Canonical Sequence

Use this order for first-time provider or model-family work:

1. official docs
2. curl connectivity
3. integration wiring
4. live E2E

Do not start browser/UI debugging before the docs and curl gates are satisfied.

## Acceptance Vocabulary

- `mock pass`
  simulated or stubbed browser flow passed
- `live pass`
  real provider flow passed
- `partial`
  some checks passed, but final acceptance did not
- `blocked`
  a hard gate failed and downstream work should stop
- `unstable`
  behavior passed inconsistently and should not be treated as accepted

Avoid collapsing these outcomes into a generic `pass`.

## Verified Patterns

- live integration is the final source of truth
- mock flows are regression tools, not final proof
- popup-visible config and runtime-effective config must stay aligned
- troubleshooting logs are part of the operator workflow
- bounded concurrency is safer than naive full parallelism for provider-facing work

## What To Record After First Success

After the first verified successful integration for a provider or model family, write down:

- required base URL and auth shape
- protocol quirks or incompatibilities
- curl facts that were actually verified
- accepted model names used in this repository
- live E2E constraints discovered during validation
