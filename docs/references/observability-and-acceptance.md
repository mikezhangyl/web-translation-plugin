# Observability And Acceptance

Reference for the evidence expectations used across the extension workflow.

## Why This Matters

- debugging without correlated logs becomes guesswork
- provider behavior should be inspected through evidence, not UI impression alone
- acceptance should be tied to real user-visible completion

## Event Families

### Selection And UI

- `ui_card_open`
- `ui_pipeline_start`
- `ui_queue_enqueued`
- `ui_runtime_send_start`
- `ui_selection_rejected`
- `ui_selection_rect_missing`
- `ui_marker_position_computed`
- `ui_marker_rendered`
- `ui_result_rendered`

### Queue And Reuse

- `ui_cache_hit`
- `ui_inflight_reused`

### Provider And Request Lifecycle

- `provider_provider_resolved`
- `provider_request_start`
- `provider_response_success`
- `provider_response_error`
- `request_succeeded`
- `request_failed`

## Correlation Expectations

For a normal successful flow, the logs should make it possible to follow:

1. selection/UI start
2. runtime dispatch
3. provider resolution
4. request start
5. provider response
6. rendered result

If the flow uses cache or inflight reuse, that should be visible instead of looking like a missing request.

## Acceptance Expectations

- UI presence alone is not enough.
- A successful provider path should show both provider lifecycle evidence and a user-visible result.
- A failed provider path should still leave enough evidence to explain what failed.
- Live E2E is the final acceptance source for provider-backed integration.
