import type { TranslationProviderFlavor } from "./translation-contract"

export const TRANSLATION_STORAGE_KEYS = {
  providerFlavor: "translation.provider.flavor",
  apiKey: "translation.provider.apiKey",
  baseUrl: "translation.provider.baseUrl",
  model: "translation.provider.model",
  debugEnabled: "translation.debug.enabled",
  debugLogs: "translation.debug.logs"
} as const

export type TranslationSettings = {
  providerFlavor: TranslationProviderFlavor
  apiKey: string
  baseUrl: string
  model: string
  debugEnabled: boolean
}

export type TranslationDebugLogLevel = "info" | "error"

export type TranslationDebugLogEntry = {
  id: string
  ts: string
  level: TranslationDebugLogLevel
  event: string
  payload: Record<string, unknown>
}

export const DEFAULT_DEBUG_ENABLED = true
export const DEBUG_LOG_LIMIT = 200

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com"
export const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com"
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
export const DEFAULT_ANTHROPIC_MODEL = "claude-3-5-haiku-latest"

export const EMPTY_TRANSLATION_SETTINGS: TranslationSettings = {
  providerFlavor: "openai-compatible",
  apiKey: "",
  baseUrl: DEFAULT_OPENAI_BASE_URL,
  model: DEFAULT_OPENAI_MODEL,
  debugEnabled: DEFAULT_DEBUG_ENABLED
}

export const withFlavorDefaults = (settings: TranslationSettings): TranslationSettings => {
  if (settings.providerFlavor === "anthropic-compatible") {
    return {
      ...settings,
      baseUrl: settings.baseUrl || DEFAULT_ANTHROPIC_BASE_URL,
      model: settings.model || DEFAULT_ANTHROPIC_MODEL
    }
  }

  return {
    ...settings,
    baseUrl: settings.baseUrl || DEFAULT_OPENAI_BASE_URL,
    model: settings.model || DEFAULT_OPENAI_MODEL
  }
}
