import type {
  TranslationMessage,
  TranslationMessageResponse,
  TranslationProviderFlavor
} from "./lib/translation-contract"
import {
  translateText,
  type TranslateDependencies,
  type TranslationDebugEvent
} from "./lib/translation-service"
import {
  DEBUG_LOG_LIMIT,
  DEFAULT_DEBUG_ENABLED,
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  type TranslationDebugLogEntry,
  TRANSLATION_STORAGE_KEYS,
  type TranslationSettings
} from "./lib/translation-settings"

const BG_LOG_PREFIX = "[translation:bg]"

const maskSecret = (value: string) => {
  if (!value) return "<empty>"
  if (value.length <= 6) return `${value[0]}***${value.at(-1)}`
  return `${value.slice(0, 3)}***${value.slice(-3)}`
}

const logInfo = (event: string, payload?: Record<string, unknown>) => {
  console.info(`${BG_LOG_PREFIX} ${event}`, payload ?? {})
}

const logError = (event: string, payload?: Record<string, unknown>) => {
  console.error(`${BG_LOG_PREFIX} ${event}`, payload ?? {})
}
let logWriteQueue: Promise<void> = Promise.resolve()

const buildLogEntry = (
  level: "info" | "error",
  event: string,
  payload: Record<string, unknown> = {}
): TranslationDebugLogEntry => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  ts: new Date().toISOString(),
  level,
  event,
  payload
})

const appendTroubleshootingLog = async (entry: TranslationDebugLogEntry) => {
  if (
    typeof chrome === "undefined" ||
    !chrome.storage?.local ||
    typeof chrome.storage.local.get !== "function" ||
    typeof chrome.storage.local.set !== "function"
  ) {
    return
  }

  await (logWriteQueue = logWriteQueue.then(async () => {
    const values = await chrome.storage.local.get([
      TRANSLATION_STORAGE_KEYS.debugEnabled,
      TRANSLATION_STORAGE_KEYS.debugLogs
    ])
    const debugEnabled =
      values[TRANSLATION_STORAGE_KEYS.debugEnabled] === undefined
        ? DEFAULT_DEBUG_ENABLED
        : values[TRANSLATION_STORAGE_KEYS.debugEnabled] !== false

    if (!debugEnabled) {
      return
    }

    const existing = values[TRANSLATION_STORAGE_KEYS.debugLogs]
    const logs = Array.isArray(existing) ? (existing as TranslationDebugLogEntry[]) : []
    logs.push(entry)
    const trimmed = logs.slice(-DEBUG_LOG_LIMIT)
    await chrome.storage.local.set({
      [TRANSLATION_STORAGE_KEYS.debugLogs]: trimmed
    })
  })).catch((error) => {
    console.error(`${BG_LOG_PREFIX} troubleshooting_log_write_queue_failed`, {
      message: error instanceof Error ? error.message : String(error)
    })
  })
}

const emitTroubleshootingLog = (
  level: "info" | "error",
  event: string,
  payload?: Record<string, unknown>
) => {
  const entry = buildLogEntry(level, event, payload ?? {})
  void appendTroubleshootingLog(entry).catch((error) => {
    console.error(`${BG_LOG_PREFIX} troubleshooting_log_write_failed`, {
      message: error instanceof Error ? error.message : String(error)
    })
  })
}

const onProviderDebugEvent = (event: TranslationDebugEvent) => {
  emitTroubleshootingLog("info", `provider_${event.stage}`, {
    provider: event.provider,
    requestUrl: event.requestUrl ?? null,
    model: event.model ?? null,
    status: event.status ?? null,
    durationMs: event.durationMs ?? null,
    requestTextPreview: event.requestTextPreview ?? null,
    responseTextPreview: event.responseTextPreview ?? null,
    bodyPreview: event.bodyPreview ?? null,
    message: event.message ?? null
  })
}

const isTranslationMessage = (message: unknown): message is TranslationMessage => {
  if (!message || typeof message !== "object") {
    return false
  }
  const candidate = message as Partial<TranslationMessage>
  return candidate.type === "translation:translate" && typeof candidate.payload?.text === "string"
}

const e2eConfigForMode = (mode: NonNullable<TranslationMessage["payload"]["e2eMode"]>) => {
  if (mode === "anthropic_success") {
    return {
      providerFlavor: "anthropic-compatible" as const,
      model: DEFAULT_ANTHROPIC_MODEL,
      baseUrl: DEFAULT_ANTHROPIC_BASE_URL
    }
  }
  if (mode === "provider_fail") {
    return {
      providerFlavor: "openai-compatible" as const,
      model: DEFAULT_OPENAI_MODEL,
      baseUrl: DEFAULT_OPENAI_BASE_URL
    }
  }
  return {
    providerFlavor: "openai-compatible" as const,
    model: DEFAULT_OPENAI_MODEL,
    baseUrl: DEFAULT_OPENAI_BASE_URL
  }
}

const getE2EDependencies = (mode: NonNullable<TranslationMessage["payload"]["e2eMode"]>) => {
  const cfg = e2eConfigForMode(mode)
  const mockFetch: typeof fetch = async () => {
    if (mode === "provider_fail") {
      return new Response("mock provider unavailable", { status: 503 })
    }

    if (cfg.providerFlavor === "anthropic-compatible") {
      return new Response(
        JSON.stringify({
          content: [{ type: "text", text: "黑曜石（Anthropic）" }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "黑曜石（OpenAI）" } }]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }

  return {
    env: {
      LLM_PROVIDER_FLAVOR: cfg.providerFlavor,
      LLM_API_KEY: "e2e-api-key",
      LLM_BASE_URL: cfg.baseUrl,
      LLM_MODEL: cfg.model
    },
    fetchImpl: mockFetch
  } satisfies TranslateDependencies
}

const readRuntimeEnvSetting = (...keys: string[]) => {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) {
      return value
    }
  }
  return ""
}

const getRuntimeEnvDeps = (): TranslateDependencies => ({
  env: {
    LLM_PROVIDER_FLAVOR: readRuntimeEnvSetting(
      "LLM_PROVIDER_FLAVOR",
      "PLASMO_PUBLIC_LLM_PROVIDER_FLAVOR"
    ),
    LLM_API_KEY: readRuntimeEnvSetting("LLM_API_KEY", "PLASMO_PUBLIC_LLM_API_KEY"),
    LLM_BASE_URL: readRuntimeEnvSetting("LLM_BASE_URL", "PLASMO_PUBLIC_LLM_BASE_URL"),
    LLM_MODEL: readRuntimeEnvSetting("LLM_MODEL", "PLASMO_PUBLIC_LLM_MODEL")
  }
})

const readStoredTranslationSettings = async (): Promise<TranslationSettings | null> => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return null
  }

  const values = await chrome.storage.local.get([
    TRANSLATION_STORAGE_KEYS.providerFlavor,
    TRANSLATION_STORAGE_KEYS.apiKey,
    TRANSLATION_STORAGE_KEYS.baseUrl,
    TRANSLATION_STORAGE_KEYS.model
  ])

  const readStoredString = (key: string) => String(values[key] ?? "").trim()
  const flavorValue = readStoredString(TRANSLATION_STORAGE_KEYS.providerFlavor)
  const storedApiKey = readStoredString(TRANSLATION_STORAGE_KEYS.apiKey)
  const storedBaseUrl = readStoredString(TRANSLATION_STORAGE_KEYS.baseUrl)
  const storedModel = readStoredString(TRANSLATION_STORAGE_KEYS.model)
  const hasStoredConfig =
    Boolean(flavorValue) || Boolean(storedApiKey) || Boolean(storedBaseUrl) || Boolean(storedModel)

  if (!hasStoredConfig) {
    logInfo("storage_settings_empty_use_runtime_env")
    emitTroubleshootingLog("info", "storage_settings_empty_use_runtime_env")
    return null
  }

  const providerFlavor: TranslationProviderFlavor =
    flavorValue === "anthropic-compatible" ? "anthropic-compatible" : "openai-compatible"

  const defaultBaseUrl =
    providerFlavor === "anthropic-compatible" ? DEFAULT_ANTHROPIC_BASE_URL : DEFAULT_OPENAI_BASE_URL
  const defaultModel =
    providerFlavor === "anthropic-compatible" ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL

  const settings = {
    providerFlavor,
    apiKey: storedApiKey,
    baseUrl: storedBaseUrl || defaultBaseUrl,
    model: storedModel || defaultModel,
    debugEnabled:
      values[TRANSLATION_STORAGE_KEYS.debugEnabled] === undefined
        ? DEFAULT_DEBUG_ENABLED
        : values[TRANSLATION_STORAGE_KEYS.debugEnabled] !== false
  }

  logInfo("storage_settings_loaded", {
    providerFlavor: settings.providerFlavor,
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKeyMasked: maskSecret(settings.apiKey)
  })
  emitTroubleshootingLog("info", "storage_settings_loaded", {
    providerFlavor: settings.providerFlavor,
    baseUrl: settings.baseUrl,
    model: settings.model,
    apiKeyMasked: maskSecret(settings.apiKey)
  })

  return settings
}

const buildDepsFromStorage = async (
  deps?: TranslateDependencies
): Promise<TranslateDependencies | undefined> => {
  if (deps) {
    return deps
  }

  const settings = await readStoredTranslationSettings()
  if (!settings) {
    return getRuntimeEnvDeps()
  }

  return {
    env: {
      LLM_PROVIDER_FLAVOR: settings.providerFlavor,
      LLM_API_KEY: settings.apiKey,
      LLM_BASE_URL: settings.baseUrl,
      LLM_MODEL: settings.model
    }
  }
}

export const handleTranslationMessage = async (
  message: TranslationMessage,
  deps?: TranslateDependencies
): Promise<TranslationMessageResponse> => {
  const text = message.payload.text.trim()
  const startedAt = Date.now()
  logInfo("request_received", {
    textLength: text.length,
    e2eMode: message.payload.e2eMode ?? null
  })
  emitTroubleshootingLog("info", "request_received", {
    textLength: text.length,
    e2eMode: message.payload.e2eMode ?? null
  })
  if (!text) {
    return {
      ok: false,
      error: {
        code: "BAD_REQUEST",
        provider: "openai_compatible",
        message: "Text is empty"
      }
    }
  }

  const runtimeDeps = message.payload.e2eMode
    ? getE2EDependencies(message.payload.e2eMode)
    : await buildDepsFromStorage(deps)

  const mergedDeps: TranslateDependencies = {
    ...(runtimeDeps ?? {}),
    debugHook: onProviderDebugEvent
  }

  const result = await translateText(
    {
      text,
      targetLang: message.payload.targetLang ?? "zh-CN",
      sourceLang: message.payload.sourceLang
    },
    mergedDeps
  )

  if (result.ok) {
    const durationMs = Date.now() - startedAt
    logInfo("request_succeeded", {
      provider: result.data.provider,
      translatedLength: result.data.translatedText.length,
      durationMs
    })
    emitTroubleshootingLog("info", "request_succeeded", {
      provider: result.data.provider,
      translatedLength: result.data.translatedText.length,
      translatedPreview: result.data.translatedText.slice(0, 160),
      durationMs
    })
  } else {
    logError("request_failed", {
      provider: result.error.provider,
      code: result.error.code,
      status: result.error.status ?? null,
      message: result.error.message
    })
    emitTroubleshootingLog("error", "request_failed", {
      provider: result.error.provider,
      code: result.error.code,
      status: result.error.status ?? null,
      message: result.error.message
    })
  }

  return result
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isTranslationMessage(message)) {
      return false
    }

    handleTranslationMessage(message)
      .then((result) => {
        sendResponse(result)
      })
      .catch((error) => {
        logError("on_message_unhandled_exception", {
          message: error instanceof Error ? error.message : String(error)
        })
        emitTroubleshootingLog("error", "on_message_unhandled_exception", {
          message: error instanceof Error ? error.message : String(error)
        })
        sendResponse({
          ok: false,
          error: {
            code: "UNKNOWN",
            provider: "openai_compatible",
            message: error instanceof Error ? error.message : "Unexpected translation error"
          }
        })
      })

    return true
  })
}
