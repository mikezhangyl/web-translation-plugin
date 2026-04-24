# Security

## Secret Boundaries

- API keys belong only in local environment variables or saved popup storage.
- Never commit raw provider secrets to source, docs, screenshots, or logs.
- `.env.local` remains local-only and must stay untracked.
- Existing troubleshooting paths should keep secrets masked. Do not regress this when expanding logging.

## Runtime Configuration Trust

- Popup fields may display env-derived defaults when storage is empty.
- Real runtime requests must use saved storage values only.
- Reintroducing hidden runtime env fallback is forbidden because it weakens both security expectations and operator trust about which provider configuration is actually live.

## Data Exposure Surfaces

- Troubleshooting logs can contain:
  - user-selected text previews
  - translated text previews
  - request URLs
  - provider/model identifiers
  - timing data
- Playwright screenshots, traces, and local browser artifacts may also expose translated content and visible page selections.
- Treat logs and artifacts as potentially sensitive user-content surfaces even when secrets are masked.

## Extension And Network Surface

- Current extension permissions are intentionally narrow on Chrome APIs:
  - `storage`
- Current network surface is broad by host:
  - `https://*/*`
- Do not add broader browser permissions or non-HTTPS provider endpoints without a specific product need and review.
- New provider integrations should stay on explicit HTTPS base URLs and documented auth/header shapes.

## Provider Validation Hygiene

- For first-time provider or model-family work, use:
  - docs first
  - curl connectivity next
  - extension integration after that
  - live E2E as final acceptance
- Do not start browser/UI debugging before connectivity and auth shape are verified.
- Keep verified provider facts in docs, not only in temporary session notes.

## Current Security Debt

- Provider-specific hardening is still lightweight.
- The repository has no dedicated provider-memory template yet, so knowledge capture still depends on disciplined doc updates.
- Diagnostics are intentionally rich, which helps debugging but increases the chance of exposing user content in logs or artifacts.
