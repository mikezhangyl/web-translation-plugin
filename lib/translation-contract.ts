export type TranslationProvider = "openai_compatible" | "anthropic_compatible"
export type TranslationProviderFlavor = "openai-compatible" | "anthropic-compatible"

export type TranslateRequest = {
  text: string
  targetLang: "zh-CN"
  sourceLang?: string
  e2eMode?: "openai_success" | "anthropic_success" | "provider_fail"
}

export type TranslateResponse = {
  translatedText: string
  detectedSourceLang?: string
  provider: TranslationProvider
  fallbackUsed: boolean
  errorCode?: string
}

export type TranslateErrorCode =
  | "MISSING_API_KEY"
  | "MISSING_BASE_URL"
  | "MISSING_MODEL"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "TIMEOUT"
  | "UPSTREAM_5XX"
  | "NETWORK"
  | "NO_TRANSLATION"
  | "UNKNOWN"

export type TranslateError = {
  code: TranslateErrorCode
  provider: TranslationProvider
  status?: number
  message: string
}

export type TranslateResult =
  | {
      ok: true
      data: TranslateResponse
    }
  | {
      ok: false
      error: TranslateError
    }

export type TranslationMessage = {
  type: "translation:translate"
  payload: TranslateRequest
}

export type TranslationMessageResponse = TranslateResult
