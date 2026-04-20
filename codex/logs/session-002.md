## Step 1

### User Instruction
```text
[Translated from Chinese] Let's agree on this first: for the UI information, read the related configuration according to the selected model, preferring local storage first and then the related values from env.local. If nothing can be read, do not use any values and leave the UI blank. Then, for the information sent to the model, use the information configured in the UI, which means the information stored in storage. Let's agree on it like this. Please change it again and do not get it wrong.
```

### Understanding
The user wants a stricter configuration contract. Popup/UI display should resolve values with this priority: storage first, then env.local as display-only fallback, else blank. Actual runtime requests must use storage settings only and must not silently fall back to environment values.

### Plan
1. Roll over session logging to `session-002.md` because the previous session already reached 100 steps.
2. Update popup configuration loading so storage values take precedence, env.local only backfills visible fields, and unresolved fields remain blank.
3. Update background/runtime configuration resolution so translation requests use storage settings only and no longer fall back to runtime environment values.
4. Update tests and rerun targeted validation until the new contract is actually enforced.

### Actions Taken
- Created `codex/logs/session-002.md` for the new session because `session-001.md` already reached Step 100.
- Updated `lib/translation-settings.ts`:
  - removed automatic base URL/model injection for custom settings.
  - empty UI settings now stay blank instead of silently defaulting to OpenAI values.
- Updated `lib/translation-contract.ts`:
  - added a `translation:env-defaults` message contract so popup can request env.local-backed display defaults from background.
- Updated `lib/translation-service.ts`:
  - added `allowProcessEnvFallback` to translation dependencies.
  - provider config loading can now run in strict storage-only mode without silently reading process env or public env defaults.
- Updated `background.ts`:
  - added env-defaults response handling for popup display backfill.
  - removed runtime fallback to environment values for actual translation requests.
  - storage-backed translation requests now run with `allowProcessEnvFallback: false`.
  - storage loading no longer injects default base URL/model values when storage fields are blank.
- Updated `popup.tsx`:
  - popup load now resolves settings with this order: storage first, then env defaults for display only, otherwise blank.
  - switching provider profile now refreshes visible fields using the selected profile's env defaults when needed.
  - Qwen profile base URL remains editable/savable, while the model stays fixed.
  - helper text now explicitly states that runtime requests use only saved storage values.
- Updated `tests/background-message.test.ts`:
  - replaced the old runtime-env fallback test with a strict storage-only failure assertion.
  - kept coverage proving that storage values override process env.
  - kept coverage proving that the saved Qwen profile uses storage values only.
- Updated `tests/translation-settings.test.ts`:
  - updated settings expectations to match the new blank-by-default UI contract.

### Validation
- `npm run test:ui-logic`: PASS
- `npm run build`: PASS
- `npm run test:e2e:mock`: PASS
- `RUN_LIVE_E2E=1 npm run test:e2e -- tests/e2e/live-selection-flow.spec.ts`: PASS
- `npm run check:logs`: PASS

### Result
- Success. The popup now displays configuration using `storage -> env.local display fallback -> blank`, while actual translation requests use storage settings only. The previous hidden runtime fallback path was removed, so the effective model request configuration now matches the saved UI configuration contract.

## Step 2

### User Instruction
```text
[Translated from Chinese] Finally I got a more reassuring result. Next, fix some small issues. This UI did not correctly read the configuration information according to the model selection. You need to read it. If I choose Qwen Flash or any Qwen model, you should check env.local to see whether I have set the Qwen URL there, and also the API key. If I have them, you should read them in. Just now I found those fields were not filled and had to be entered manually.
```

### Understanding
The user wants the popup display layer to select env fallback values based on the chosen model, not only based on the selected profile. In particular, when the current model is any `qwen-mt-*` model, popup fallback display should use `QWEN_API_KEY` and `QWEN_BASE_URL` from `env.local`, while keeping runtime requests storage-only.

### Plan
1. Extend popup/background env-default lookup so the selected model participates in the fallback decision.
2. Make custom-mode Qwen models use `QWEN_*` env defaults for popup display.
3. Add tests proving that custom Qwen models use Qwen env defaults while non-Qwen custom models still use generic env defaults.
4. Run logic/build validation and re-run log validation.

### Actions Taken
- Updated `lib/translation-contract.ts`:
  - extended `translation:env-defaults` request payload to include `providerFlavor` and `model`.
- Updated `background.ts`:
  - added `isQwenModel()` and exported `getEnvDefaultsForSelection()`.
  - env-default resolution now uses `QWEN_*` fallback whenever the selected model matches `qwen-mt-*`, even under the custom profile.
  - non-Qwen custom models still use generic `LLM_*` display defaults.
- Updated `popup.tsx`:
  - popup now requests env defaults using `profileId + providerFlavor + model`.
  - initial load now picks fallback display values based on the stored model.
  - changing provider flavor or model now re-evaluates env fallback display values.
- Updated `tests/background-message.test.ts`:
  - added coverage proving that `custom + qwen-mt-plus` uses `QWEN_API_KEY/QWEN_BASE_URL`.
  - added coverage proving that non-Qwen custom models still use generic `LLM_*` defaults.

### Validation
- `npm run test:ui-logic`: PASS
- `npm run build`: PASS

### Result
- Success. Popup fallback display now follows the selected model, so choosing any `qwen-mt-*` model automatically pulls Qwen URL/API key from `env.local` for display instead of forcing manual entry.

## Step 3

### User Instruction
```text
[Translated from Chinese] Execute ship and land.
```

### Understanding
The user wants the current branch work published and merged. The correct flow is to validate the unified local gate, commit the current worktree on the active feature branch, push it, update the existing PR for that branch, merge it, and then synchronize local `main`.

### Plan
1. Confirm the active branch, dirty worktree, and whether an open PR already exists.
2. Run the required local preflight gate before shipping.
3. Stage the intended repository changes, commit them, and push the branch.
4. Mark the existing draft PR ready for review if needed, merge it, and update local `main`.

### Actions Taken
- Confirmed the active branch is `codex/feat-llm-performance-optimization`.
- Confirmed Draft PR `#10` already exists for this branch.
- Ran the required local gate `npm run check:local` and it passed, including the live E2E gate.

### Validation
- `npm run check:local`: PASS

### Result
- In progress.
