export type TranslationProvider = "azure" | "deepl"

export type TranslateRequest = {
  text: string
  targetLang: "zh-CN"
  sourceLang?: string
  e2eMode?: "azure_success" | "azure_rate_limit_then_deepl_success" | "dual_fail"
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
  | "MISSING_REGION"
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
