import type { TranslationProviderFlavor } from "./translation-contract"

export type TranslationProfileId = "custom" | "qwen-flash-card"

export const TRANSLATION_STORAGE_KEYS = {
  profileId: "translation.provider.profileId",
  providerFlavor: "translation.provider.flavor",
  apiKey: "translation.provider.apiKey",
  baseUrl: "translation.provider.baseUrl",
  model: "translation.provider.model",
  benchmarkModels: "translation.provider.benchmarkModels",
  debugEnabled: "translation.debug.enabled",
  debugLogs: "translation.debug.logs"
} as const

export type TranslationSettings = {
  profileId: TranslationProfileId
  providerFlavor: TranslationProviderFlavor
  apiKey: string
  baseUrl: string
  model: string
  benchmarkModels: string[]
  debugEnabled: boolean
}

export type TranslationDebugLogLevel = "info" | "error"

export type TranslationDebugLogEntry = {
  id: string
  seq?: number
  ts: string
  level: TranslationDebugLogLevel
  event: string
  payload: Record<string, unknown>
}

export const DEFAULT_DEBUG_ENABLED = true
export const DEBUG_LOG_LIMIT = 200

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com"
export const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com"
export const DEFAULT_QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode"
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
export const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-latest"
export const DEFAULT_QWEN_FLASH_MODEL = "qwen-mt-flash"
export const DEFAULT_QWEN_BENCHMARK_MODELS = [
  "qwen-mt-plus",
  DEFAULT_QWEN_FLASH_MODEL,
  "qwen-mt-lite",
  "qwen-mt-turbo"
]

export const EMPTY_TRANSLATION_SETTINGS: TranslationSettings = {
  profileId: "custom",
  providerFlavor: "openai-compatible",
  apiKey: "",
  baseUrl: "",
  model: "",
  benchmarkModels: [...DEFAULT_QWEN_BENCHMARK_MODELS],
  debugEnabled: DEFAULT_DEBUG_ENABLED
}

export const withFlavorDefaults = (settings: TranslationSettings): TranslationSettings => {
  if (settings.profileId === "qwen-flash-card") {
    return {
      ...settings,
      providerFlavor: "openai-compatible",
      baseUrl: settings.baseUrl || DEFAULT_QWEN_BASE_URL,
      model: DEFAULT_QWEN_FLASH_MODEL
    }
  }
  return settings
}
