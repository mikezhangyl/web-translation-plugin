import type {
  TranslateError,
  TranslateErrorCode,
  TranslateRequest,
  TranslateResult,
  TranslateResponse,
  TranslationProvider
} from "./translation-contract"

type EnvMap = Record<string, string | undefined>

export type TranslateDependencies = {
  env?: EnvMap
  fetchImpl?: typeof fetch
  providerTimeoutMs?: number
}

type ProviderConfig = {
  azureKey: string
  azureRegion: string
  deepLKey: string
  deepLApiUrl: string
}

type ProviderError = TranslateError & {
  retryable: boolean
  fallbackEligible: boolean
}

const AZURE_TRANSLATE_URL = "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0"
const DEFAULT_DEEPL_API_URL = "https://api-free.deepl.com/v2/translate"
const DEFAULT_PROVIDER_TIMEOUT_MS = 4_000

const toAzureTargetLang = (targetLang: TranslateRequest["targetLang"]) => {
  if (targetLang === "zh-CN") {
    return "zh-Hans"
  }
  return "zh-Hans"
}

const toDeepLTargetLang = (targetLang: TranslateRequest["targetLang"]) => {
  if (targetLang === "zh-CN") {
    return "ZH"
  }
  return "ZH"
}

const readEnv = (env: EnvMap, key: string) => (env[key] ?? "").trim()

const loadProviderConfig = (env: EnvMap): ProviderConfig => {
  const explicitAzureKey =
    (process.env.AZURE_TRANSLATOR_KEY ?? process.env.PLASMO_PUBLIC_AZURE_TRANSLATOR_KEY ?? "").trim()
  const explicitAzureRegion =
    (process.env.AZURE_TRANSLATOR_REGION ?? process.env.PLASMO_PUBLIC_AZURE_TRANSLATOR_REGION ?? "").trim()
  const explicitDeepLKey =
    (process.env.DEEPL_API_KEY ?? process.env.PLASMO_PUBLIC_DEEPL_API_KEY ?? "").trim()
  const explicitDeepLApiUrl =
    (process.env.DEEPL_API_URL ?? process.env.PLASMO_PUBLIC_DEEPL_API_URL ?? "").trim()

  return {
    azureKey: readEnv(env, "AZURE_TRANSLATOR_KEY") || explicitAzureKey,
    azureRegion: readEnv(env, "AZURE_TRANSLATOR_REGION") || explicitAzureRegion,
    deepLKey: readEnv(env, "DEEPL_API_KEY") || explicitDeepLKey,
    deepLApiUrl: readEnv(env, "DEEPL_API_URL") || explicitDeepLApiUrl || DEFAULT_DEEPL_API_URL
  }
}

const toProviderError = (
  provider: TranslationProvider,
  code: TranslateErrorCode,
  message: string,
  status?: number
): ProviderError => {
  const fallbackEligible =
    code === "TIMEOUT" ||
    code === "RATE_LIMITED" ||
    code === "QUOTA_EXCEEDED" ||
    code === "UPSTREAM_5XX" ||
    code === "MISSING_API_KEY" ||
    code === "MISSING_REGION"

  return {
    code,
    message,
    provider,
    retryable: code === "TIMEOUT" || code === "RATE_LIMITED" || code === "UPSTREAM_5XX",
    fallbackEligible,
    status
  }
}

const mapHttpError = (
  provider: TranslationProvider,
  status: number,
  message: string,
  quotaByBody = false
): ProviderError => {
  if (status === 400) {
    return toProviderError(provider, "BAD_REQUEST", message, status)
  }
  if (status === 401 || status === 403) {
    return toProviderError(provider, "UNAUTHORIZED", message, status)
  }
  if (status === 429) {
    return toProviderError(provider, "RATE_LIMITED", message, status)
  }
  if (quotaByBody) {
    return toProviderError(provider, "QUOTA_EXCEEDED", message, status)
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

const translateWithAzure = async (
  request: TranslateRequest,
  config: ProviderConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<TranslateResponse> => {
  if (!config.azureKey) {
    throw toProviderError("azure", "MISSING_API_KEY", "Missing AZURE_TRANSLATOR_KEY")
  }
  if (!config.azureRegion) {
    throw toProviderError("azure", "MISSING_REGION", "Missing AZURE_TRANSLATOR_REGION")
  }

  const target = toAzureTargetLang(request.targetLang)
  const url = `${AZURE_TRANSLATE_URL}&to=${encodeURIComponent(target)}`
  const source = request.sourceLang?.trim()

  let response: Response
  try {
    response = await withTimeout(timeoutMs, (signal) =>
      fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": config.azureKey,
          "Ocp-Apim-Subscription-Region": config.azureRegion
        },
        body: JSON.stringify([{ Text: request.text }]),
        signal
      })
    )
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw toProviderError("azure", "TIMEOUT", "Azure request timeout")
    }
    throw toProviderError("azure", "NETWORK", "Azure request failed")
  }

  if (!response.ok) {
    const text = await response.text()
    const quotaByBody = /quota|out of call volume quota|characters quota|exceeded/i.test(text)
    throw mapHttpError("azure", response.status, text || "Azure translation failed", quotaByBody)
  }

  const payload = (await response.json()) as Array<{
    detectedLanguage?: { language?: string }
    translations?: Array<{ text?: string }>
  }>
  const first = payload[0]
  const translatedText = first?.translations?.[0]?.text?.trim()

  if (!translatedText) {
    throw toProviderError("azure", "NO_TRANSLATION", "Azure response contains no translation")
  }

  return {
    translatedText,
    detectedSourceLang: source || first?.detectedLanguage?.language,
    provider: "azure",
    fallbackUsed: false
  }
}

const translateWithDeepL = async (
  request: TranslateRequest,
  config: ProviderConfig,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  fallbackUsed: boolean
): Promise<TranslateResponse> => {
  if (!config.deepLKey) {
    throw toProviderError("deepl", "MISSING_API_KEY", "Missing DEEPL_API_KEY")
  }

  const form = new URLSearchParams()
  form.set("text", request.text)
  form.set("target_lang", toDeepLTargetLang(request.targetLang))
  if (request.sourceLang?.trim()) {
    form.set("source_lang", request.sourceLang.trim().toUpperCase())
  }

  let response: Response
  try {
    response = await withTimeout(timeoutMs, (signal) =>
      fetchImpl(config.deepLApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `DeepL-Auth-Key ${config.deepLKey}`
        },
        body: form.toString(),
        signal
      })
    )
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw toProviderError("deepl", "TIMEOUT", "DeepL request timeout")
    }
    throw toProviderError("deepl", "NETWORK", "DeepL request failed")
  }

  if (!response.ok) {
    const text = await response.text()
    const quotaByBody = /quota|too many requests|character limit|usage limit/i.test(text)
    throw mapHttpError("deepl", response.status, text || "DeepL translation failed", quotaByBody)
  }

  const payload = (await response.json()) as {
    translations?: Array<{ text?: string; detected_source_language?: string }>
  }
  const first = payload.translations?.[0]
  const translatedText = first?.text?.trim()
  if (!translatedText) {
    throw toProviderError("deepl", "NO_TRANSLATION", "DeepL response contains no translation")
  }

  return {
    translatedText,
    detectedSourceLang: first.detected_source_language,
    provider: "deepl",
    fallbackUsed
  }
}

const shouldFallbackFromAzure = (error: ProviderError) => error.fallbackEligible

export const translateText = async (
  request: TranslateRequest,
  deps: TranslateDependencies = {}
): Promise<TranslateResult> => {
  const env = deps.env ?? process.env
  const fetchImpl = deps.fetchImpl ?? fetch
  const providerTimeoutMs = deps.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS
  const config = loadProviderConfig(env)

  try {
    const azureResponse = await translateWithAzure(request, config, fetchImpl, providerTimeoutMs)
    return { ok: true, data: azureResponse }
  } catch (error) {
    const azureError =
      (error as ProviderError)?.provider === "azure"
        ? (error as ProviderError)
        : toProviderError("azure", "UNKNOWN", "Unexpected Azure failure")

    if (!shouldFallbackFromAzure(azureError)) {
      return { ok: false, error: azureError }
    }

    try {
      const deepLResponse = await translateWithDeepL(
        request,
        config,
        fetchImpl,
        providerTimeoutMs,
        true
      )
      return { ok: true, data: deepLResponse }
    } catch (deepLError) {
      const normalizedDeepLError =
        (deepLError as ProviderError)?.provider === "deepl"
          ? (deepLError as ProviderError)
          : toProviderError("deepl", "UNKNOWN", "Unexpected DeepL failure")
      return { ok: false, error: normalizedDeepLError }
    }
  }
}
