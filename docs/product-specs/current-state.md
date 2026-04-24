# Current Product State

## User-Facing Surface

- Stack: Plasmo + React + TypeScript + Manifest V3.
- Main interaction: a distinct golden/orange floating marker appears near supported text selections and opens the translation card.
- Popup surface includes:
  - provider settings
  - benchmark-model settings
  - local vocabulary notebook
  - troubleshooting log viewer
  - copy-logs action
  - clear-logs action
- Local vocabulary history stores saved flash-card entries in `chrome.storage.local`.
- Current target language default remains `zh-CN`.

## Vocabulary Notebook

- First shipped path is manual save from successful word and short-phrase flash cards.
- Saved entries preserve:
  - source text
  - normalized text
  - translation
  - phonetic
  - explanation
  - example
  - optional source URL/title/context
  - created and updated timestamps
- Duplicate saves use `normalizedText` as the primary de-dupe key.
- Duplicate saves preserve the original `createdAt` and refresh `updatedAt` plus the latest flash-card details.
- Popup review supports:
  - newest added
  - oldest added
  - A-Z
  - Z-A
  - delete

## Accepted Translation Modes

### Word And Short Phrase

- Stable product path.
- Uses flash-card output from `qwen-mt-flash`.
- Card shape:
  - phonetic
  - meaning
  - example
- Streaming partial card updates are acceptable before the final response settles.

### Sentence

- Stable product path.
- Uses plain translation output on the same underlying model path.
- Card shape:
  - translated sentence only
  - no phonetic row
  - no example row

### Paragraph

- Still exploratory.
- Translation is attempted only for a single selected paragraph.
- Current guardrails:
  - reject selections that span multiple paragraphs
  - reject selections longer than `250` whitespace-delimited words
  - reject selections longer than `1500` characters
- When paragraph selection is rejected by these limits, the card stays user-visible and explains how to trim the selection instead of silently failing.
- Not yet a stable acceptance path for translation quality or rendering richness.

## Provider And Settings Rules

- Popup supports two saved profiles:
  - `custom`
  - `qwen-flash-card`
- `qwen-flash-card` is a built-in product profile:
  - provider flavor is fixed to `openai-compatible`
  - model is fixed to `qwen-mt-flash`
  - base URL defaults to `https://dashscope.aliyuncs.com/compatible-mode`
  - API key is still user-provided or explicitly saved from env-backed display defaults
- Popup display resolves values in this order:
  - storage first
  - built-in profile defaults and env-derived defaults second
  - blank otherwise
- Display fallback is model-aware for Qwen:
  - selecting `qwen-flash-card` uses `QWEN_API_KEY` and `QWEN_BASE_URL`
  - custom configurations whose model matches `qwen-mt-*` also use `QWEN_*` for display backfill
- If `QWEN_BASE_URL` is absent, Qwen display and runtime profile construction use the built-in DashScope compatible-mode URL.
- Runtime translation requests use only saved storage values.
- There is no hidden runtime env fallback and no automatic provider failover.
- Empty or incomplete saved config should fail loudly rather than silently switching providers or models.

## Diagnostics And Acceptance

- Troubleshooting logs are part of normal operation, not a developer-only afterthought.
- The popup log panel is the expected place to inspect:
  - request lifecycle
  - provider/model choice
  - timings
  - success/failure evidence
- Mock browser flows are regression checks only.
- Final provider acceptance requires live E2E with a real provider response and readable troubleshooting evidence.
- Current live acceptance should continue to cover:
  - real flash-card output
  - real sentence translation output

## Known Limits And Risks

- Paragraph translation remains constrained and is not yet productized beyond the single-paragraph limit contract.
- Vocabulary history is local-device only; there is no account sync, export, spaced repetition, or dashboard view yet.
- Provider knowledge is more stable than before, but there is still no dedicated long-lived provider-facts template beyond the core docs.
- Benchmark/comparison settings remain diagnostics-oriented and are not the main user-visible acceptance path.
- Troubleshooting logs intentionally help diagnosis, but they can expose selected text, translated text, URLs, and timing details.

## Next Recommended Workstream

- Polish the vocabulary notebook for study workflows, including denser review states, import/export, or spaced repetition only after the local save path proves useful.
- Continue stabilizing paragraph translation as an explicit product mode.
- Keep the provider workflow strict for any new provider/model work:
  - docs
  - curl connectivity
  - integration wiring
  - live E2E
- Capture newly verified provider quirks in repo docs instead of leaving them only in session history.
