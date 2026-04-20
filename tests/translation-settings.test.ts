import assert from "node:assert/strict"
import test from "node:test"
import {
  DEFAULT_DEBUG_ENABLED,
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_QWEN_BENCHMARK_MODELS,
  DEBUG_LOG_LIMIT,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  EMPTY_TRANSLATION_SETTINGS,
  TRANSLATION_STORAGE_KEYS,
  withFlavorDefaults
} from "../lib/translation-settings"

test("translation settings defaults are stable", () => {
  assert.equal(DEFAULT_OPENAI_BASE_URL, "https://api.openai.com")
  assert.equal(DEFAULT_ANTHROPIC_BASE_URL, "https://api.anthropic.com")
  assert.equal(DEFAULT_OPENAI_MODEL, "gpt-4o-mini")
  assert.equal(DEFAULT_ANTHROPIC_MODEL, "claude-3-5-haiku-latest")
  assert.equal(EMPTY_TRANSLATION_SETTINGS.profileId, "custom")
  assert.equal(EMPTY_TRANSLATION_SETTINGS.providerFlavor, "openai-compatible")
  assert.equal(EMPTY_TRANSLATION_SETTINGS.apiKey, "")
  assert.equal(EMPTY_TRANSLATION_SETTINGS.baseUrl, "")
  assert.equal(EMPTY_TRANSLATION_SETTINGS.model, "")
  assert.deepEqual(EMPTY_TRANSLATION_SETTINGS.benchmarkModels, DEFAULT_QWEN_BENCHMARK_MODELS)
  assert.equal(EMPTY_TRANSLATION_SETTINGS.debugEnabled, DEFAULT_DEBUG_ENABLED)
  assert.equal(DEBUG_LOG_LIMIT, 200)
})

test("translation storage keys are stable", () => {
  assert.equal(TRANSLATION_STORAGE_KEYS.profileId, "translation.provider.profileId")
  assert.equal(TRANSLATION_STORAGE_KEYS.providerFlavor, "translation.provider.flavor")
  assert.equal(TRANSLATION_STORAGE_KEYS.apiKey, "translation.provider.apiKey")
  assert.equal(TRANSLATION_STORAGE_KEYS.baseUrl, "translation.provider.baseUrl")
  assert.equal(TRANSLATION_STORAGE_KEYS.model, "translation.provider.model")
  assert.equal(TRANSLATION_STORAGE_KEYS.benchmarkModels, "translation.provider.benchmarkModels")
  assert.equal(TRANSLATION_STORAGE_KEYS.debugEnabled, "translation.debug.enabled")
  assert.equal(TRANSLATION_STORAGE_KEYS.debugLogs, "translation.debug.logs")
})

test("withFlavorDefaults preserves custom profile values without injecting provider defaults", () => {
  const anthropic = withFlavorDefaults({
    profileId: "custom",
    providerFlavor: "anthropic-compatible",
    apiKey: "key",
    baseUrl: "",
    model: "",
    benchmarkModels: [],
    debugEnabled: true
  })

  assert.equal(anthropic.baseUrl, "")
  assert.equal(anthropic.model, "")
})

test("withFlavorDefaults locks qwen flash card profile to openai-compatible flash model", () => {
  const profile = withFlavorDefaults({
    profileId: "qwen-flash-card",
    providerFlavor: "anthropic-compatible",
    apiKey: "key",
    baseUrl: "https://api.minimaxi.com/anthropic",
    model: "MiniMax-M2.7",
    benchmarkModels: [],
    debugEnabled: true
  })

  assert.equal(profile.providerFlavor, "openai-compatible")
  assert.equal(profile.model, "qwen-mt-flash")
})
