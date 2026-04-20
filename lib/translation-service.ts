import type {
  TranslateError,
  TranslateErrorCode,
  TranslateRequest,
  TranslateResult,
  TranslateResponse,
  TranslationCard,
  TranslationProvider,
  TranslationProviderFlavor
} from "./translation-contract"
import {
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENAI_MODEL
} from "./translation-settings"

type EnvMap = Record<string, string | undefined>

export type TranslateDependencies = {
  env?: EnvMap
  fetchImpl?: typeof fetch
  providerTimeoutMs?: number
  debugHook?: (event: TranslationDebugEvent) => void
  allowProcessEnvFallback?: boolean
}

export type TranslationDebugEvent = {
  provider: TranslationProvider
  stage:
    | "provider_resolved"
    | "request_start"
    | "response_success"
    | "response_error"
    | "translate_failed"
  requestUrl?: string
  model?: string
  status?: number
  durationMs?: number
  ttfbMs?: number
  requestTextPreview?: string
  responseTextPreview?: string
  bodyPreview?: string
  message?: string
}

export type TranslationStreamUpdate = {
  provider: TranslationProvider
  model: string
  card: Partial<TranslationCard>
  translatedText: string
}

type ProviderConfig = {
  providerFlavor: TranslationProviderFlavor
  apiKey: string
  baseUrl: string
  model: string
}

type ProviderError = TranslateError

const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000
const FLASH_CARD_MODEL = "qwen-mt-flash"
const SYSTEM_PROMPT =
  "You are an expert bilingual translation specialist. Translate the user's input into Simplified Chinese (zh-CN) with high semantic fidelity. Keep proper nouns, product names, and technical terms accurate. Preserve intended tone and concise style. Return only the final translated text, with no explanations, notes, markdown, quotes, or extra lines."
const SERVICE_LOG_PREFIX = "[translation:svc]"

const maskSecret = (value: string) => {
  if (!value) return "<empty>"
  if (value.length <= 6) return `${value[0]}***${value.at(-1)}`
  return `${value.slice(0, 3)}***${value.slice(-3)}`
}

const logInfo = (event: string, payload?: Record<string, unknown>) => {
  console.info(`${SERVICE_LOG_PREFIX} ${event}`, payload ?? {})
}

const logError = (event: string, payload?: Record<string, unknown>) => {
  console.error(`${SERVICE_LOG_PREFIX} ${event}`, payload ?? {})
}

const previewText = (value: string, max = 240) => value.slice(0, max)

const readEnv = (env: EnvMap, key: string) => (env[key] ?? "").trim()

const resolveOpenAIBaseUrl = (candidate: string) => candidate || DEFAULT_OPENAI_BASE_URL
const resolveAnthropicBaseUrl = (candidate: string) => candidate || DEFAULT_ANTHROPIC_BASE_URL
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "")
const isQwenMtModel = (model: string) => /^qwen-mt-/i.test(model.trim())
const isFlashCardModel = (model: string) => model.trim().toLowerCase() === FLASH_CARD_MODEL
const toQwenMtLang = (lang: string) => {
  const normalized = lang.trim().toLowerCase()
  if (normalized === "zh-cn" || normalized === "zh" || normalized === "zh-hans") {
    return "Chinese"
  }
  if (normalized === "en" || normalized === "en-us" || normalized === "en-gb") {
    return "English"
  }
  return lang
}

const buildFlashCardPrompt = (text: string) =>
  [
    "You are a translation expert for English learners.",
    "Return strict JSON only.",
    'Use exactly these keys: phonetic, meaning, example.',
    "phonetic is required.",
    'phonetic: IPA string for the English word or phrase. Never leave it empty. For short phrases, provide best-effort IPA for the phrase or its key word.',
    "meaning: concise Simplified Chinese explanation.",
    'example: one short example sentence followed by its Simplified Chinese translation on the same line, separated by " — ".',
    `Word or phrase: ${text}`
  ].join(" ")

const stripMarkdownCodeFence = (value: string) => {
  const match = value.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match ? match[1].trim() : value.trim()
}

const parseFlashCard = (raw: string): TranslationCard | null => {
  try {
    const parsed = JSON.parse(stripMarkdownCodeFence(raw)) as Partial<TranslationCard>
    const phonetic = String(parsed.phonetic ?? "").trim()
    const meaning = String(parsed.meaning ?? "").trim()
    const example = String(parsed.example ?? "").trim()
    if (!meaning) {
      return null
    }
    return { phonetic, meaning, example }
  } catch {
    return null
  }
}

const parsePartialFlashCard = (raw: string): Partial<TranslationCard> => {
  const extract = (key: keyof TranslationCard) => {
    const pattern = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`)
    const match = raw.match(pattern)
    if (!match) {
      return undefined
    }
    try {
      return JSON.parse(`"${match[1]}"`) as string
    } catch {
      return undefined
    }
  }

  return {
    ...(extract("phonetic") ? { phonetic: extract("phonetic") } : {}),
    ...(extract("meaning") ? { meaning: extract("meaning") } : {}),
    ...(extract("example") ? { example: extract("example") } : {})
  }
}

const toTranslateResponse = (
  provider: TranslationProvider,
  translatedText: string,
  card?: TranslationCard
): TranslateResponse => ({
  translatedText,
  provider,
  fallbackUsed: false,
  ...(card ? { card } : {})
})

const toCardText = (card: Partial<TranslationCard>) =>
  [card.phonetic, card.meaning, card.example].filter(Boolean).join("\n")

const mapFlavorToProvider = (flavor: TranslationProviderFlavor): TranslationProvider =>
  flavor === "anthropic-compatible" ? "anthropic_compatible" : "openai_compatible"

const loadProviderConfig = (env: EnvMap, allowProcessEnvFallback = true): ProviderConfig => {
  const flavorRaw = readEnv(env, "LLM_PROVIDER_FLAVOR").toLowerCase()
  const providerFlavor: TranslationProviderFlavor =
    flavorRaw === "anthropic-compatible" ? "anthropic-compatible" : "openai-compatible"

  const explicitApiKey =
    readEnv(env, "LLM_API_KEY") ||
    readEnv(env, "OPENAI_API_KEY") ||
    readEnv(env, "ANTHROPIC_API_KEY") ||
    (allowProcessEnvFallback ? readEnv(process.env, "PLASMO_PUBLIC_LLM_API_KEY") : "")

  const explicitBaseUrl =
    readEnv(env, "LLM_BASE_URL") ||
    (allowProcessEnvFallback ? readEnv(process.env, "PLASMO_PUBLIC_LLM_BASE_URL") : "") ||
    (providerFlavor === "anthropic-compatible"
      ? readEnv(env, "ANTHROPIC_BASE_URL")
      : readEnv(env, "OPENAI_BASE_URL"))

  const explicitModel =
    readEnv(env, "LLM_MODEL") ||
    (allowProcessEnvFallback ? readEnv(process.env, "PLASMO_PUBLIC_LLM_MODEL") : "") ||
    (providerFlavor === "anthropic-compatible"
      ? readEnv(env, "ANTHROPIC_MODEL")
      : readEnv(env, "OPENAI_MODEL"))

  return {
    providerFlavor,
    apiKey: explicitApiKey,
    baseUrl: allowProcessEnvFallback
      ? providerFlavor === "anthropic-compatible"
        ? resolveAnthropicBaseUrl(explicitBaseUrl)
        : resolveOpenAIBaseUrl(explicitBaseUrl)
      : explicitBaseUrl,
    model: allowProcessEnvFallback
      ? explicitModel || (providerFlavor === "anthropic-compatible" ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL)
      : explicitModel
  }
}

const toProviderError = (
  provider: TranslationProvider,
  code: TranslateErrorCode,
  message: string,
  status?: number
): ProviderError => ({
  code,
  message,
  provider,
  status
})

const mapHttpError = (provider: TranslationProvider, status: number, message: string): ProviderError => {
  if (status === 400) {
    return toProviderError(provider, "BAD_REQUEST", message, status)
  }
  if (status === 401 || status === 403) {
    return toProviderError(provider, "UNAUTHORIZED", message, status)
  }
  if (status === 429) {
    return toProviderError(provider, "RATE_LIMITED", message, status)
  }
  if (status >= 500) {
    return toProviderError(provider, "UPSTREAM_5XX", message, status)
  }
  return toProviderError(provider, "UNKNOWN", message, status)
}

const withTimeout = async <T>(
  timeoutMs: number,
  run: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await run(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

const translateWithOpenAICompatible = async (
  request: TranslateRequest,
  config: ProviderConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  debugHook?: (event: TranslationDebugEvent) => void
): Promise<TranslateResponse> => {
  const provider: TranslationProvider = "openai_compatible"
  if (!config.apiKey) {
    throw toProviderError(provider, "MISSING_API_KEY", "Missing LLM_API_KEY")
  }
  if (!config.baseUrl) {
    throw toProviderError(provider, "MISSING_BASE_URL", "Missing LLM_BASE_URL")
  }
  if (!config.model) {
    throw toProviderError(provider, "MISSING_MODEL", "Missing LLM_MODEL")
  }

  const url = `${trimTrailingSlash(config.baseUrl)}/v1/chat/completions`
  const startedAt = Date.now()
  logInfo("openai_request_start", {
    url,
    model: config.model,
    apiKeyMasked: maskSecret(config.apiKey),
    textLength: request.text.length
  })
  debugHook?.({
    provider,
    stage: "request_start",
    requestUrl: url,
    model: config.model,
    requestTextPreview: previewText(request.text)
  })
  let response: Response
  let ttfbMs = 0
  try {
    const qwenMtMode = isQwenMtModel(config.model)
    const flashCardMode = isFlashCardModel(config.model)
    const userOnlyPrompt = request.sourceLang
      ? `Translate the following text from ${request.sourceLang} to ${request.targetLang}.\nText:\n${request.text}`
      : `Translate the following text to ${request.targetLang}.\nText:\n${request.text}`
    const requestBody = flashCardMode
      ? {
          model: config.model,
          messages: [{ role: "user", content: buildFlashCardPrompt(request.text) }],
          temperature: 0.2
        }
      : qwenMtMode
      ? {
          model: config.model,
          messages: [{ role: "user", content: request.text }],
          translation_options: {
            source_lang: request.sourceLang ? toQwenMtLang(request.sourceLang) : "auto",
            target_lang: toQwenMtLang(request.targetLang)
          }
        }
      : {
          model: config.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userOnlyPrompt }
          ],
          temperature: 0.2
        }
    response = await withTimeout(timeoutMs, (signal) =>
      fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal
      })
    )
    ttfbMs = Date.now() - startedAt
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw toProviderError(provider, "TIMEOUT", "OpenAI-compatible request timeout")
    }
    throw toProviderError(provider, "NETWORK", "OpenAI-compatible request failed")
  }

  if (!response.ok) {
    const text = await response.text()
    const durationMs = Date.now() - startedAt
    logError("openai_response_not_ok", {
      status: response.status,
      bodyPreview: text.slice(0, 180)
    })
    debugHook?.({
      provider,
      stage: "response_error",
      requestUrl: url,
      model: config.model,
      status: response.status,
      durationMs,
      ttfbMs,
      bodyPreview: previewText(text)
    })
    throw mapHttpError(provider, response.status, text || "OpenAI-compatible translation failed")
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
  }

  const content = payload.choices?.[0]?.message?.content
  const translatedText =
    typeof content === "string"
      ? content.trim()
      : Array.isArray(content)
        ? content.map((part) => part.text ?? "").join("").trim()
        : ""

  if (!translatedText) {
    logError("openai_empty_translation")
    throw toProviderError(provider, "NO_TRANSLATION", "OpenAI-compatible response contains no translation")
  }

  const durationMs = Date.now() - startedAt
  logInfo("openai_request_success", { translatedLength: translatedText.length, durationMs })
  debugHook?.({
    provider,
    stage: "response_success",
    requestUrl: url,
    model: config.model,
    status: response.status,
    durationMs,
    ttfbMs,
    responseTextPreview: previewText(translatedText)
  })
  if (isFlashCardModel(config.model)) {
    const card = parseFlashCard(translatedText)
    if (card) {
      const normalizedText = [card.phonetic, card.meaning, card.example].filter(Boolean).join("\n")
      return toTranslateResponse(provider, normalizedText, card)
    }
  }

  return toTranslateResponse(provider, translatedText)
}

const streamWithOpenAICompatible = async (
  request: TranslateRequest,
  config: ProviderConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  onUpdate: (update: TranslationStreamUpdate) => void,
  debugHook?: (event: TranslationDebugEvent) => void
): Promise<TranslateResponse> => {
  const provider: TranslationProvider = "openai_compatible"
  if (!config.apiKey) {
    throw toProviderError(provider, "MISSING_API_KEY", "Missing LLM_API_KEY")
  }
  if (!config.baseUrl) {
    throw toProviderError(provider, "MISSING_BASE_URL", "Missing LLM_BASE_URL")
  }
  if (!config.model) {
    throw toProviderError(provider, "MISSING_MODEL", "Missing LLM_MODEL")
  }

  const url = `${trimTrailingSlash(config.baseUrl)}/v1/chat/completions`
  const startedAt = Date.now()
  debugHook?.({
    provider,
    stage: "request_start",
    requestUrl: url,
    model: config.model,
    requestTextPreview: previewText(request.text)
  })

  let response: Response
  let ttfbMs = 0
  try {
    response = await withTimeout(timeoutMs, (signal) =>
      fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: buildFlashCardPrompt(request.text) }],
          temperature: 0.2,
          stream: true
        }),
        signal
      })
    )
    ttfbMs = Date.now() - startedAt
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw toProviderError(provider, "TIMEOUT", "OpenAI-compatible stream request timeout")
    }
    throw toProviderError(provider, "NETWORK", "OpenAI-compatible stream request failed")
  }

  if (!response.ok) {
    const text = await response.text()
    const durationMs = Date.now() - startedAt
    debugHook?.({
      provider,
      stage: "response_error",
      requestUrl: url,
      model: config.model,
      status: response.status,
      durationMs,
      ttfbMs,
      bodyPreview: previewText(text)
    })
    throw mapHttpError(provider, response.status, text || "OpenAI-compatible stream request failed")
  }

  const contentType = response.headers.get("content-type") ?? ""
  if (!contentType.includes("text/event-stream") || !response.body) {
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
    }
    const content = payload.choices?.[0]?.message?.content
    const translatedText =
      typeof content === "string"
        ? content.trim()
        : Array.isArray(content)
          ? content.map((part) => part.text ?? "").join("").trim()
          : ""
    const card = parseFlashCard(translatedText)
    const normalizedText = card ? toCardText(card) : translatedText
    if (card) {
      onUpdate({
        provider,
        model: config.model,
        card,
        translatedText: normalizedText
      })
      return toTranslateResponse(provider, normalizedText, card)
    }
    return toTranslateResponse(provider, translatedText)
  }

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ""
  let rawText = ""

  const flushEvent = (eventText: string) => {
    const lines = eventText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
    for (const line of lines) {
      const data = line.replace(/^data:\s*/, "")
      if (!data || data === "[DONE]") {
        continue
      }
      try {
        const payload = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>
        }
        const delta = payload.choices?.[0]?.delta?.content ?? ""
        if (!delta) {
          continue
        }
        rawText += delta
        const card = parsePartialFlashCard(rawText)
        if (Object.keys(card).length > 0) {
          onUpdate({
            provider,
            model: config.model,
            card,
            translatedText: toCardText(card)
          })
        }
      } catch {
        continue
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""
    for (const eventText of events) {
      flushEvent(eventText)
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) {
    flushEvent(buffer)
  }

  const card = parseFlashCard(rawText)
  if (!card) {
    throw toProviderError(provider, "NO_TRANSLATION", "Streamed response contains no valid translation card")
  }

  const durationMs = Date.now() - startedAt
  const translatedText = toCardText(card)
  debugHook?.({
    provider,
    stage: "response_success",
    requestUrl: url,
    model: config.model,
    status: response.status,
    durationMs,
    ttfbMs,
    responseTextPreview: previewText(translatedText)
  })
  return toTranslateResponse(provider, translatedText, card)
}

const translateWithAnthropicCompatible = async (
  request: TranslateRequest,
  config: ProviderConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  debugHook?: (event: TranslationDebugEvent) => void
): Promise<TranslateResponse> => {
  const provider: TranslationProvider = "anthropic_compatible"
  if (!config.apiKey) {
    throw toProviderError(provider, "MISSING_API_KEY", "Missing LLM_API_KEY")
  }
  if (!config.baseUrl) {
    throw toProviderError(provider, "MISSING_BASE_URL", "Missing LLM_BASE_URL")
  }
  if (!config.model) {
    throw toProviderError(provider, "MISSING_MODEL", "Missing LLM_MODEL")
  }

  const url = `${trimTrailingSlash(config.baseUrl)}/v1/messages`
  const startedAt = Date.now()
  logInfo("anthropic_request_start", {
    url,
    model: config.model,
    apiKeyMasked: maskSecret(config.apiKey),
    textLength: request.text.length
  })
  debugHook?.({
    provider,
    stage: "request_start",
    requestUrl: url,
    model: config.model,
    requestTextPreview: previewText(request.text)
  })
  let response: Response
  let ttfbMs = 0
  try {
    response = await withTimeout(timeoutMs, (signal) =>
      fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 400,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: request.text }]
        }),
        signal
      })
    )
    ttfbMs = Date.now() - startedAt
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw toProviderError(provider, "TIMEOUT", "Anthropic-compatible request timeout")
    }
    throw toProviderError(provider, "NETWORK", "Anthropic-compatible request failed")
  }

  if (!response.ok) {
    const text = await response.text()
    const durationMs = Date.now() - startedAt
    logError("anthropic_response_not_ok", {
      status: response.status,
      bodyPreview: text.slice(0, 180)
    })
    debugHook?.({
      provider,
      stage: "response_error",
      requestUrl: url,
      model: config.model,
      status: response.status,
      durationMs,
      ttfbMs,
      bodyPreview: previewText(text)
    })
    throw mapHttpError(provider, response.status, text || "Anthropic-compatible translation failed")
  }

  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>
  }
  const translatedText = payload.content?.find((item) => item.type === "text")?.text?.trim() ?? ""
  if (!translatedText) {
    logError("anthropic_empty_translation")
    throw toProviderError(provider, "NO_TRANSLATION", "Anthropic-compatible response contains no translation")
  }

  const durationMs = Date.now() - startedAt
  logInfo("anthropic_request_success", { translatedLength: translatedText.length, durationMs })
  debugHook?.({
    provider,
    stage: "response_success",
    requestUrl: url,
    model: config.model,
    status: response.status,
    durationMs,
    ttfbMs,
    responseTextPreview: previewText(translatedText)
  })
  if (isFlashCardModel(config.model)) {
    const card = parseFlashCard(translatedText)
    if (card) {
      const normalizedText = [card.phonetic, card.meaning, card.example].filter(Boolean).join("\n")
      return toTranslateResponse(provider, normalizedText, card)
    }
  }

  return toTranslateResponse(provider, translatedText)
}

export const translateText = async (
  request: TranslateRequest,
  deps: TranslateDependencies = {}
): Promise<TranslateResult> => {
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const providerTimeoutMs = deps.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS
  const debugHook = deps.debugHook
  const config = loadProviderConfig(env, deps.allowProcessEnvFallback ?? true)
  const provider = mapFlavorToProvider(config.providerFlavor)
  logInfo("provider_resolved", {
    flavor: config.providerFlavor,
    provider,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKeyMasked: maskSecret(config.apiKey)
  })
  debugHook?.({
    provider,
    stage: "provider_resolved",
    model: config.model
  })

  try {
    const data =
      config.providerFlavor === "anthropic-compatible"
        ? await translateWithAnthropicCompatible(request, config, fetchImpl, providerTimeoutMs, debugHook)
        : await translateWithOpenAICompatible(request, config, fetchImpl, providerTimeoutMs, debugHook)

    return { ok: true, data }
  } catch (error) {
    const normalized =
      (error as ProviderError)?.provider === provider
        ? (error as ProviderError)
        : toProviderError(provider, "UNKNOWN", "Unexpected provider failure")
    logError("translate_failed", {
      provider: normalized.provider,
      code: normalized.code,
      status: normalized.status ?? null,
      message: normalized.message
    })
    debugHook?.({
      provider: normalized.provider,
      stage: "translate_failed",
      model: config.model,
      status: normalized.status,
      message: `${normalized.code}: ${normalized.message}`
    })
    return { ok: false, error: normalized }
  }
}

export const streamTranslateText = async (
  request: TranslateRequest,
  deps: TranslateDependencies = {},
  onUpdate: (update: TranslationStreamUpdate) => void
): Promise<TranslateResult> => {
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const providerTimeoutMs = deps.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS
  const debugHook = deps.debugHook
  const config = loadProviderConfig(env, deps.allowProcessEnvFallback ?? true)
  const provider = mapFlavorToProvider(config.providerFlavor)
  debugHook?.({
    provider,
    stage: "provider_resolved",
    model: config.model
  })

  try {
    const data =
      config.providerFlavor === "openai-compatible" && isFlashCardModel(config.model)
        ? await streamWithOpenAICompatible(request, config, fetchImpl, providerTimeoutMs, onUpdate, debugHook)
        : await (
            config.providerFlavor === "anthropic-compatible"
              ? translateWithAnthropicCompatible(request, config, fetchImpl, providerTimeoutMs, debugHook)
              : translateWithOpenAICompatible(request, config, fetchImpl, providerTimeoutMs, debugHook)
          )

    if (data.card) {
      onUpdate({
        provider: data.provider,
        model: config.model,
        card: data.card,
        translatedText: data.translatedText
      })
    }
    return { ok: true, data }
  } catch (error) {
    const normalized =
      (error as ProviderError)?.provider === provider
        ? (error as ProviderError)
        : toProviderError(provider, "UNKNOWN", "Unexpected provider failure")
    debugHook?.({
      provider: normalized.provider,
      stage: "translate_failed",
      model: config.model,
      status: normalized.status,
      message: `${normalized.code}: ${normalized.message}`
    })
    return { ok: false, error: normalized }
  }
}
