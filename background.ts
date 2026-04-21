import type {
  TranslationDebugLogMessage,
  TranslationCompareMessage,
  TranslationComparisonItem,
  TranslationEnvDefaultsMessage,
  TranslationEnvDefaultsResponse,
  TranslationMessage,
  TranslationMessageResponse,
  TranslationStreamClientMessage,
  TranslationProviderFlavor
} from "./lib/translation-contract"
import {
  streamTranslateText,
  translateText,
  type TranslateDependencies,
  type TranslationDebugEvent
} from "./lib/translation-service"
import {
  DEBUG_LOG_LIMIT,
  DEFAULT_DEBUG_ENABLED,
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_QWEN_BENCHMARK_MODELS,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL,
  type TranslationDebugLogEntry,
  TRANSLATION_STORAGE_KEYS,
  type TranslationProfileId,
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
let logSequence = 0

const buildLogEntry = (
  level: "info" | "error",
  event: string,
  payload: Record<string, unknown> = {}
): TranslationDebugLogEntry => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  seq: ++logSequence,
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

const onProviderDebugEvent = (event: TranslationDebugEvent, traceId?: string) => {
  emitTroubleshootingLog("info", `provider_${event.stage}`, {
    traceId: traceId ?? null,
    provider: event.provider,
    requestUrl: event.requestUrl ?? null,
    model: event.model ?? null,
    status: event.status ?? null,
    durationMs: event.durationMs ?? null,
    ttfbMs: event.ttfbMs ?? null,
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

const isComparisonMessage = (message: unknown): message is TranslationCompareMessage => {
  if (!message || typeof message !== "object") {
    return false
  }
  const candidate = message as Partial<TranslationCompareMessage>
  return candidate.type === "translation:compare" && typeof candidate.payload?.text === "string"
}

const isDebugLogMessage = (message: unknown): message is TranslationDebugLogMessage => {
  if (!message || typeof message !== "object") {
    return false
  }
  const candidate = message as Partial<TranslationDebugLogMessage>
  return candidate.type === "translation:debug-log" && typeof candidate.payload?.event === "string"
}

const isEnvDefaultsMessage = (message: unknown): message is TranslationEnvDefaultsMessage => {
  if (!message || typeof message !== "object") {
    return false
  }
  const candidate = message as Partial<TranslationEnvDefaultsMessage>
  return candidate.type === "translation:env-defaults"
}

const isStreamStartMessage = (message: unknown): message is TranslationStreamClientMessage => {
  if (!message || typeof message !== "object") {
    return false
  }
  const candidate = message as Partial<TranslationStreamClientMessage>
  return candidate.type === "translation:stream-start" && typeof candidate.payload?.text === "string"
}

const parseBenchmarkModels = (value: unknown) =>
  String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

const isMockFlashCardRequest = (body: { model?: string; messages?: Array<{ content?: string }> }) => {
  if (body.model !== "qwen-mt-flash" || !Array.isArray(body.messages) || typeof body.messages[0]?.content !== "string") {
    return false
  }

  const content = body.messages[0].content
  if (content.includes("Return strict JSON only")) {
    return true
  }

  return content.trim().split(/\s+/).filter(Boolean).length <= 4
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
  const mockFetch: typeof fetch = async (_input, init) => {
    if (mode === "provider_fail") {
      return new Response("mock provider unavailable", { status: 503 })
    }

    const body = JSON.parse(String(init?.body ?? "{}")) as {
      model?: string
      messages?: Array<{ content?: string }>
    }
    const flashCardPayload = JSON.stringify({
      phonetic: "/əbˈsɪdiən/",
      meaning: mode === "anthropic_success" ? "黑曜石（Anthropic）" : "黑曜石（OpenAI）",
      example: "Obsidian helps me organize my notes. — Obsidian 帮助我整理笔记。"
    })
    const plainSentencePayload =
      mode === "anthropic_success"
        ? "这是一句用于 Anthropics 模拟测试的中文译文。"
        : "这是一句用于 OpenAI 模拟测试的中文译文。"

    if (cfg.providerFlavor === "anthropic-compatible") {
      return new Response(
        JSON.stringify({
          content: [
            {
              type: "text",
              text: isMockFlashCardRequest(body)
                ? flashCardPayload
                : body.model === "qwen-mt-flash"
                  ? plainSentencePayload
                  : "黑曜石（Anthropic）"
            }
          ]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: isMockFlashCardRequest(body)
                  ? flashCardPayload
                  : body.model === "qwen-mt-flash"
                    ? plainSentencePayload
                    : "黑曜石（OpenAI）"
              }
            }
          ]
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

const isQwenModel = (value: string) => /^qwen-mt-/i.test(value.trim())

const getCustomEnvDefaults = (): TranslationEnvDefaultsResponse["data"] => ({
  profileId: "custom",
  providerFlavor:
    readRuntimeEnvSetting("LLM_PROVIDER_FLAVOR", "PLASMO_PUBLIC_LLM_PROVIDER_FLAVOR") ===
    "anthropic-compatible"
      ? "anthropic-compatible"
      : "openai-compatible",
  apiKey: readRuntimeEnvSetting("LLM_API_KEY", "PLASMO_PUBLIC_LLM_API_KEY"),
  baseUrl: readRuntimeEnvSetting("LLM_BASE_URL", "PLASMO_PUBLIC_LLM_BASE_URL"),
  model: readRuntimeEnvSetting("LLM_MODEL", "PLASMO_PUBLIC_LLM_MODEL")
})

const getQwenEnvDefaults = (): TranslationEnvDefaultsResponse["data"] => ({
  profileId: "qwen-flash-card",
  providerFlavor: "openai-compatible",
  apiKey: readRuntimeEnvSetting("QWEN_API_KEY"),
  baseUrl: readRuntimeEnvSetting("QWEN_BASE_URL"),
  model: "qwen-mt-flash"
})

export const getEnvDefaultsForSelection = (selection?: {
  profileId?: TranslationProfileId
  providerFlavor?: TranslationProviderFlavor
  model?: string
}): TranslationEnvDefaultsResponse["data"] => {
  if (selection?.profileId === "qwen-flash-card" || isQwenModel(selection?.model ?? "")) {
    return {
      ...getQwenEnvDefaults(),
      profileId: selection?.profileId === "qwen-flash-card" ? "qwen-flash-card" : "custom",
      model: String(selection?.model ?? "").trim() || "qwen-mt-flash"
    }
  }

  const customDefaults = getCustomEnvDefaults()
  return {
    ...customDefaults,
    profileId: selection?.profileId === "qwen-flash-card" ? "qwen-flash-card" : "custom",
    providerFlavor:
      selection?.providerFlavor === "anthropic-compatible"
        ? "anthropic-compatible"
        : selection?.providerFlavor === "openai-compatible"
          ? "openai-compatible"
          : customDefaults.providerFlavor,
    model: String(selection?.model ?? "").trim() || customDefaults.model
  }
}

const getQwenProfileDeps = (settings?: TranslationSettings | null): TranslateDependencies => ({
  env: {
    LLM_PROVIDER_FLAVOR: "openai-compatible",
    LLM_API_KEY: settings?.apiKey ?? "",
    LLM_BASE_URL: settings?.baseUrl ?? "",
    LLM_MODEL: "qwen-mt-flash"
  },
  allowProcessEnvFallback: false
})

const readStoredTranslationSettings = async (): Promise<TranslationSettings | null> => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return null
  }

  const values = await chrome.storage.local.get([
    TRANSLATION_STORAGE_KEYS.profileId,
    TRANSLATION_STORAGE_KEYS.providerFlavor,
    TRANSLATION_STORAGE_KEYS.apiKey,
    TRANSLATION_STORAGE_KEYS.baseUrl,
    TRANSLATION_STORAGE_KEYS.model,
    TRANSLATION_STORAGE_KEYS.benchmarkModels
  ])

  const readStoredString = (key: string) => String(values[key] ?? "").trim()
  const profileId: TranslationProfileId =
    readStoredString(TRANSLATION_STORAGE_KEYS.profileId) === "qwen-flash-card" ? "qwen-flash-card" : "custom"
  const flavorValue = readStoredString(TRANSLATION_STORAGE_KEYS.providerFlavor)
  const storedApiKey = readStoredString(TRANSLATION_STORAGE_KEYS.apiKey)
  const storedBaseUrl = readStoredString(TRANSLATION_STORAGE_KEYS.baseUrl)
  const storedModel = readStoredString(TRANSLATION_STORAGE_KEYS.model)
  const storedBenchmarkModels = parseBenchmarkModels(values[TRANSLATION_STORAGE_KEYS.benchmarkModels])
  const hasStoredConfig =
    profileId !== "custom" ||
    Boolean(flavorValue) ||
    Boolean(storedApiKey) ||
    Boolean(storedBaseUrl) ||
    Boolean(storedModel)

  if (!hasStoredConfig) {
    logInfo("storage_settings_empty")
    emitTroubleshootingLog("info", "storage_settings_empty")
    return null
  }

  const providerFlavor: TranslationProviderFlavor =
    flavorValue === "anthropic-compatible" ? "anthropic-compatible" : "openai-compatible"

  const settings = {
    profileId,
    providerFlavor,
    apiKey: storedApiKey,
    baseUrl: storedBaseUrl,
    model: storedModel,
    benchmarkModels: storedBenchmarkModels.length
      ? storedBenchmarkModels
      : [...DEFAULT_QWEN_BENCHMARK_MODELS],
    debugEnabled:
      values[TRANSLATION_STORAGE_KEYS.debugEnabled] === undefined
        ? DEFAULT_DEBUG_ENABLED
        : values[TRANSLATION_STORAGE_KEYS.debugEnabled] !== false
  }

  logInfo("storage_settings_loaded", {
    profileId: settings.profileId,
    providerFlavor: settings.providerFlavor,
    baseUrl: settings.baseUrl,
    model: settings.model,
    benchmarkModels: settings.benchmarkModels.join(","),
    apiKeyMasked: maskSecret(settings.apiKey)
  })
  emitTroubleshootingLog("info", "storage_settings_loaded", {
    profileId: settings.profileId,
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
    return {
      env: {},
      allowProcessEnvFallback: false
    }
  }

  if (settings.profileId === "qwen-flash-card") {
    return getQwenProfileDeps(settings)
  }

  return {
    env: {
      LLM_PROVIDER_FLAVOR: settings.providerFlavor,
      LLM_API_KEY: settings.apiKey,
      LLM_BASE_URL: settings.baseUrl,
      LLM_MODEL: settings.model
    },
    allowProcessEnvFallback: false
  }
}

export const handleTranslationMessage = async (
  message: TranslationMessage,
  deps?: TranslateDependencies
): Promise<TranslationMessageResponse> => {
  const text = message.payload.text.trim()
  const startedAt = Date.now()
  const traceId = message.payload.traceId?.trim() || null
  logInfo("request_received", {
    textLength: text.length,
    e2eMode: message.payload.e2eMode ?? null,
    modelOverride: message.payload.modelOverride ?? null,
    traceId
  })
  emitTroubleshootingLog("info", "request_received", {
    textLength: text.length,
    e2eMode: message.payload.e2eMode ?? null,
    modelOverride: message.payload.modelOverride ?? null,
    traceId
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
    env: {
      ...(runtimeDeps?.env ?? {}),
      ...(message.payload.modelOverride
        ? {
            LLM_MODEL: message.payload.modelOverride
          }
        : {})
    },
    debugHook: (event) => onProviderDebugEvent(event, traceId ?? undefined)
  }
  const currentModel = String(
    message.payload.modelOverride ?? mergedDeps.env?.LLM_MODEL ?? runtimeDeps?.env?.LLM_MODEL ?? ""
  ).trim() || null

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
      model: currentModel,
      provider: result.data.provider,
      translatedLength: result.data.translatedText.length,
      durationMs
    })
    emitTroubleshootingLog("info", "request_succeeded", {
      traceId,
      model: currentModel,
      provider: result.data.provider,
      translatedLength: result.data.translatedText.length,
      translatedPreview: result.data.translatedText.slice(0, 160),
      durationMs
    })
  } else {
    logError("request_failed", {
      model: currentModel,
      provider: result.error.provider,
      code: result.error.code,
      status: result.error.status ?? null,
      message: result.error.message
    })
    emitTroubleshootingLog("error", "request_failed", {
      traceId,
      model: currentModel,
      provider: result.error.provider,
      code: result.error.code,
      status: result.error.status ?? null,
      message: result.error.message
    })
  }

  return result
}

const handleDebugLogMessage = async (message: TranslationDebugLogMessage) => {
  emitTroubleshootingLog(message.payload.level === "error" ? "error" : "info", message.payload.event, message.payload.payload)
  return { ok: true as const }
}

const handleEnvDefaultsMessage = async (
  message: TranslationEnvDefaultsMessage
): Promise<TranslationEnvDefaultsResponse> => {
  return {
    ok: true,
    data: getEnvDefaultsForSelection({
      profileId: message.payload?.profileId === "qwen-flash-card" ? "qwen-flash-card" : "custom",
      providerFlavor:
        message.payload?.providerFlavor === "anthropic-compatible"
          ? "anthropic-compatible"
          : message.payload?.providerFlavor === "openai-compatible"
            ? "openai-compatible"
            : undefined,
      model: message.payload?.model
    })
  }
}

export const handleComparisonMessage = async (
  message: TranslationCompareMessage,
  deps?: TranslateDependencies
): Promise<TranslationMessageResponse> => {
  const text = message.payload.text.trim()
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

  const settings = deps ? null : await readStoredTranslationSettings()
  const requestedModels = message.payload.models?.map((item) => item.trim()).filter(Boolean) ?? []
  const models =
    requestedModels.length > 0
      ? requestedModels
      : settings?.benchmarkModels?.length
        ? settings.benchmarkModels
        : [...DEFAULT_QWEN_BENCHMARK_MODELS]

  const envMap = runtimeDeps?.env ?? {}
  const baseProviderFlavor =
    String(envMap.LLM_PROVIDER_FLAVOR ?? settings?.providerFlavor ?? "openai-compatible") ===
    "anthropic-compatible"
      ? "anthropic-compatible"
      : "openai-compatible"
  const baseApiKey = String(envMap.LLM_API_KEY ?? settings?.apiKey ?? "")
  const baseBaseUrl = String(envMap.LLM_BASE_URL ?? settings?.baseUrl ?? "")

  const startedAt = Date.now()
  const results = await Promise.all(
    models.map(async (model) => {
      const modelStart = Date.now()
      const modelDeps: TranslateDependencies = {
        ...runtimeDeps,
        env: {
          ...(runtimeDeps?.env ?? {}),
          LLM_PROVIDER_FLAVOR: baseProviderFlavor,
          LLM_API_KEY: baseApiKey,
          LLM_BASE_URL: baseBaseUrl,
          LLM_MODEL: model
        },
        debugHook: onProviderDebugEvent
      }

      const result = await translateText(
        {
          text,
          targetLang: message.payload.targetLang ?? "zh-CN",
          sourceLang: message.payload.sourceLang
        },
        modelDeps
      )
      const durationMs = Date.now() - modelStart
      if (result.ok) {
        return {
          model,
          ok: true,
          translatedText: result.data.translatedText,
          provider: result.data.provider,
          durationMs
        } satisfies TranslationComparisonItem
      }
      return {
        model,
        ok: false,
        provider: result.error.provider,
        errorCode: result.error.code,
        message: result.error.message,
        durationMs
      } satisfies TranslationComparisonItem
    })
  )

  return {
    ok: true,
    data: {
      overallDurationMs: Date.now() - startedAt,
      results
    }
  }
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (
      !isTranslationMessage(message) &&
      !isComparisonMessage(message) &&
      !isDebugLogMessage(message) &&
      !isEnvDefaultsMessage(message)
    ) {
      return false
    }

    const handler = isEnvDefaultsMessage(message)
      ? handleEnvDefaultsMessage
      : isDebugLogMessage(message)
        ? handleDebugLogMessage
        : isComparisonMessage(message)
          ? handleComparisonMessage
          : handleTranslationMessage
    handler(message)
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

if (typeof chrome !== "undefined" && chrome.runtime?.onConnect) {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== "translation-stream") {
      return
    }

    port.onMessage.addListener(async (message) => {
      if (!isStreamStartMessage(message)) {
        return
      }

      try {
        if (message.payload.e2eMode) {
          const result = await handleTranslationMessage(
            {
              type: "translation:translate",
              payload: message.payload
            },
            getE2EDependencies(message.payload.e2eMode)
          )
          port.postMessage({
            type: "translation:stream-complete",
            payload: { result }
          })
          return
        }

        const text = message.payload.text.trim()
        const traceId = message.payload.traceId?.trim() || null
        const runtimeDeps = await buildDepsFromStorage(undefined)
        const mergedDeps: TranslateDependencies = {
          ...(runtimeDeps ?? {}),
          env: {
            ...(runtimeDeps?.env ?? {}),
            ...(message.payload.modelOverride
              ? {
                  LLM_MODEL: message.payload.modelOverride
                }
              : {})
          },
          debugHook: (event) => onProviderDebugEvent(event, traceId ?? undefined)
        }
        const currentModel =
          String(message.payload.modelOverride ?? mergedDeps.env?.LLM_MODEL ?? "").trim() || null

        const result = await streamTranslateText(
          {
            text,
            targetLang: message.payload.targetLang ?? "zh-CN",
            sourceLang: message.payload.sourceLang
          },
          mergedDeps,
          (update) => {
            port.postMessage({
              type: "translation:stream-update",
              payload: {
                traceId,
                model: currentModel,
                provider: update.provider,
                card: update.card,
                translatedText: update.translatedText
              }
            })
          }
        )

        if (result.ok) {
          emitTroubleshootingLog("info", "request_succeeded", {
            traceId,
            model: currentModel,
            provider: result.data.provider,
            translatedLength: result.data.translatedText.length,
            translatedPreview: result.data.translatedText.slice(0, 160)
          })
        } else {
          emitTroubleshootingLog("error", "request_failed", {
            traceId,
            model: currentModel,
            provider: result.error.provider,
            code: result.error.code,
            status: result.error.status ?? null,
            message: result.error.message
          })
        }

        port.postMessage({
          type: "translation:stream-complete",
          payload: { result }
        })
      } catch (error) {
        port.postMessage({
          type: "translation:stream-error",
          payload: {
            message: error instanceof Error ? error.message : String(error)
          }
        })
      }
    })
  })
}
