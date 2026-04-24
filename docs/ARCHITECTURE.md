# Architecture Map

## Repository Boundaries

- `background.ts`
  runtime message router, storage-backed settings load, popup env-default lookup, troubleshooting-log persistence, and streaming-port handling
- `popup.tsx`
  settings editor plus diagnostics surface for logs, copy/clear actions, and benchmark-model configuration
- `contents/selection-translator.tsx`
  content-script entrypoint that mounts the translation UI on pages
- `ui/selection-translator.tsx`
  selection classification, marker placement, card lifecycle, streaming flash-card rendering, and request queue usage
- `lib/translation-service.ts`
  provider protocol adapters plus mode routing for flash-card output vs plain translation output
- `lib/translation-settings.ts`
  storage keys, profile ids, defaults, and the `qwen-flash-card` profile lock
- `lib/selection-ui.ts`
  supported-selection limits, marker-position helpers, and dry-run placeholder data
- `lib/translation-request-queue.ts`
  cache/inflight reuse and bounded concurrency for repeated requests
- `tests/`
  unit-style logic tests, mock Playwright flows, and live provider/browser validation
- `docs/`
  durable repository memory for product, architecture, security, and active planning
- `codex/`
  current-session pointer plus concise execution history

## Runtime Flow

### Selection Translation Flow

1. `contents/selection-translator.tsx` mounts the main-world selection UI.
2. `ui/selection-translator.tsx` watches the current selection, rejects unsupported or overlong text, and computes the floating marker position.
3. Opening the card triggers a translation request with a fixed `qwen-mt-flash` model override for the current primary UX.
4. Word and short-phrase selections use the flash-card path. The UI prefers streaming partial card updates when available.
5. Sentence-length selections use the plain translation path and render only the translated sentence.
6. `background.ts` loads saved settings from `chrome.storage.local`, applies the profile lock when `profileId === "qwen-flash-card"`, and delegates provider calls to `lib/translation-service.ts`.
7. Troubleshooting events from UI, background, and provider layers are written back to `chrome.storage.local` for popup inspection.

### Secondary Comparison Path

- `background.ts` still exposes `translation:compare`.
- Comparison uses explicit models from the request or saved `benchmarkModels`.
- This path is diagnostics-oriented. The current primary product acceptance path is the single-card translation flow, not multi-model comparison.

## Runtime Configuration Contract

- Settings live under the keys defined in `lib/translation-settings.ts`.
- Two profile shapes exist today:
  - `custom`
  - `qwen-flash-card`
- The `qwen-flash-card` profile forces:
  - `providerFlavor = openai-compatible`
  - `model = qwen-mt-flash`
- Popup-visible settings resolve in this order:
  - saved storage values
  - env-derived defaults for display only
  - blank if neither exists
- Env display defaults are model-aware:
  - `qwen-flash-card` uses `QWEN_*`
  - custom selections whose model matches `qwen-mt-*` also use `QWEN_*` for display backfill
- Real runtime requests use saved storage values only. If storage is empty, requests fail explicitly instead of silently falling back to env values.

## Current Product Modes

- Word and short phrase:
  - accepted path
  - flash-card output with phonetic, meaning, and example
  - currently centered on `qwen-mt-flash`
- Sentence:
  - accepted path
  - plain translation only
  - no phonetic line
  - no example line
- Paragraph:
  - technically adjacent to the current selection flow
  - not yet documented or validated as a stable product mode

## Observability Contract

- Troubleshooting logs are part of the product surface, not disposable debugging noise.
- Expected event families include:
  - UI lifecycle such as `ui_pipeline_start`, `ui_runtime_send_start`, `ui_result_rendered`
  - queue/caching events such as `ui_cache_hit` and `ui_inflight_reused`
  - provider lifecycle such as `provider_request_start`, `provider_response_success`, `provider_response_error`
  - request outcome events such as `request_succeeded` and `request_failed`
- `traceId` is the main correlation handle across UI, background, and provider events.
- Logs intentionally mask secrets, but they may still include request/response previews and should be treated as sensitive user-content surfaces.

## Verification Surfaces

- `npm run test:ui-logic`
  unit-style tests for settings, service routing, queue behavior, selection rules, and background message handling
- `npm run test:e2e:mock`
  deterministic Playwright regression flow on `example.com`
- `npm run test:live`
  direct live provider request check
- `npm run test:e2e`
  live Playwright browser flow against the real provider path
- `npm run check:local`
  UI logic, mock E2E, and live-gate enforcement when live config is present
- `npm run check:verify`
  local gate plus packaging

Live acceptance should continue to prove both accepted product modes:

- real flash-card flow
- real sentence flow
