import type {
  TranslateError,
  TranslateErrorCode,
  TranslateRequest,
  TranslateResult,
  TranslateResponse,
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
  requestTextPreview?: string
  responseTextPreview?: string
  bodyPreview?: string
  message?: string
}

type ProviderConfig = {
  providerFlavor: TranslationProviderFlavor
  apiKey: string
  baseUrl: string
  model: string
}

type ProviderError = TranslateError

const DEFAULT_PROVIDER_TIMEOUT_MS = 10_000
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

const mapFlavorToProvider = (flavor: TranslationProviderFlavor): TranslationProvider =>
  flavor === "anthropic-compatible" ? "anthropic_compatible" : "openai_compatible"

const loadProviderConfig = (env: EnvMap): ProviderConfig => {
  const flavorRaw = readEnv(env, "LLM_PROVIDER_FLAVOR").toLowerCase()
  const providerFlavor: TranslationProviderFlavor =
    flavorRaw === "anthropic-compatible" ? "anthropic-compatible" : "openai-compatible"

  const explicitApiKey =
    readEnv(env, "LLM_API_KEY") ||
    readEnv(env, "OPENAI_API_KEY") ||
    readEnv(env, "ANTHROPIC_API_KEY") ||
    readEnv(process.env, "PLASMO_PUBLIC_LLM_API_KEY")

  const explicitBaseUrl =
    readEnv(env, "LLM_BASE_URL") ||
    readEnv(process.env, "PLASMO_PUBLIC_LLM_BASE_URL") ||
    (providerFlavor === "anthropic-compatible"
      ? readEnv(env, "ANTHROPIC_BASE_URL")
      : readEnv(env, "OPENAI_BASE_URL"))

  const explicitModel =
    readEnv(env, "LLM_MODEL") ||
    readEnv(process.env, "PLASMO_PUBLIC_LLM_MODEL") ||
    (providerFlavor === "anthropic-compatible"
      ? readEnv(env, "ANTHROPIC_MODEL")
      : readEnv(env, "OPENAI_MODEL"))

  return {
    providerFlavor,
    apiKey: explicitApiKey,
    baseUrl:
      providerFlavor === "anthropic-compatible"
        ? resolveAnthropicBaseUrl(explicitBaseUrl)
        : resolveOpenAIBaseUrl(explicitBaseUrl),
    model: explicitModel || (providerFlavor === "anthropic-compatible" ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL)
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
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: request.text }
          ],
          temperature: 0.2
        }),
        signal
      })
    )
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
    responseTextPreview: previewText(translatedText)
  })
  return {
    translatedText,
    provider,
    fallbackUsed: false
  }
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
    responseTextPreview: previewText(translatedText)
  })
  return {
    translatedText,
    provider,
    fallbackUsed: false
  }
}

export const translateText = async (
  request: TranslateRequest,
  deps: TranslateDependencies = {}
): Promise<TranslateResult> => {
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const providerTimeoutMs = deps.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS
  const debugHook = deps.debugHook
  const config = loadProviderConfig(env)
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
      status: normalized.status,
      message: `${normalized.code}: ${normalized.message}`
    })
    return { ok: false, error: normalized }
  }
}
