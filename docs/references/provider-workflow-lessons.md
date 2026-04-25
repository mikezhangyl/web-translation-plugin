# Provider Workflow Lessons

Concise reference for provider validation and acceptance behavior that should survive future integrations.

## Canonical Sequence

Use this order for first-time provider or model-family work:

1. official docs
2. curl connectivity
3. integration wiring
4. live E2E

Do not start browser/UI debugging before the docs and curl gates are satisfied.

## LLM Invocation Changes

Treat LLM invocation changes as provider-facing work, even when the code diff looks like a small prompt edit.

An invocation change means changing how this product calls a model or interprets the model response. It does not mean changing the model itself.

This applies when changing:

- prompts or system instructions
- message layout
- temperature, top-p/top-k, streaming, or other sampling/request parameters
- structured-output schema
- model selection or routing
- expected semantic output such as idiom handling, tone, explanation style, or translation policy

Required sequence:

1. Define representative probe inputs before changing product code.
2. Run the candidate invocation directly against the real provider with `curl` or a temporary probe script.
3. Capture raw request parameters and raw provider outputs.
4. Compare at least one positive case, one ordinary case, and one regression-sensitive case.
5. Ask the user to confirm the observed behavior when the requested semantics are subjective or product-defining.
6. Only after confirmation, update product code, tests, UI, and docs.

For translation prompt work, representative probes should include:

- the exact phrase or sentence that exposed the issue
- a normal word or short phrase that should remain simple
- a normal sentence that should not gain noisy notes
- a phrase where literal translation would be misleading

Do not treat mock tests as proof of invocation quality. Mock tests only prove parsing and UI handling for known shapes; real provider probes prove whether the prompt and parameters actually elicit the desired output.

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
- LLM invocation changes require real provider probe evidence before product implementation
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
