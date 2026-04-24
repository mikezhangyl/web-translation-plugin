# Reliability

## Acceptance Vocabulary

- `live E2E`
  real user flow, real provider connectivity, and real response validation
- `mock`
  simulated browser or provider behavior for deterministic regression checks
- `contract`
  schema-, storage-, or interface-level validation

Mock success must not be presented as final provider acceptance.

## Provider Validation Sequence

For first-time provider or model-family work, use this order:

1. official docs
2. curl connectivity
3. extension integration
4. live E2E

If curl fails, browser/UI debugging should stop until connectivity is repaired.

## Runtime Configuration Reliability

- Popup-visible config and runtime-effective config must stay aligned.
- Popup display can show env-derived defaults when storage is empty.
- Real runtime requests must use saved storage values only.
- Hidden env fallback during request execution is a reliability bug because it obscures which provider configuration is actually live.

## Observability Reliability

Reliable behavior requires traceable evidence across:

- UI open and pipeline-start events
- queue, cache, and inflight-reuse events
- background request lifecycle
- provider request and response stages
- final rendered success or failure state

The popup troubleshooting panel is part of the product's reliability surface because it is how operators inspect real behavior.

## Execution Reliability

- Prefer bounded concurrency over naive full fan-out for upstream LLM requests.
- Use evidence-driven retries rather than blind reruns.
- Keep logs consistent enough that a rendered result can be traced back to a request, cache hit, or inflight reuse event.

## Current Validated Reliability Patterns

- live E2E remains the final acceptance path when live config is available
- flash-card and sentence modes are tested separately
- host-page attempts to suppress native button rendering are covered by regression tests for marker visibility
- request queue behavior is covered for cache hits, inflight reuse, TTL expiry, and bounded concurrency
- popup troubleshooting logs capture provider success and failure evidence
