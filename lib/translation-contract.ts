export type TranslationProvider = "openai_compatible" | "anthropic_compatible"
export type TranslationProviderFlavor = "openai-compatible" | "anthropic-compatible"

export type TranslateRequest = {
  text: string
  targetLang: "zh-CN"
  sourceLang?: string
  modelOverride?: string
  traceId?: string
  e2eMode?: "openai_success" | "anthropic_success" | "provider_fail"
}

export type TranslationEnvDefaultsRequest = {
  profileId?: "custom" | "qwen-flash-card"
  providerFlavor?: TranslationProviderFlavor
  model?: string
}

export type TranslationCard = {
  phonetic: string
  meaning: string
  literal?: string
  note?: string
  example: string
}

export type TranslationRiskNotice = {
  source: string
  translation?: string
  reason: string
  suggestedMeaning?: string
  risk: "low" | "medium" | "high"
}

export type TranslateResponse = {
  translatedText: string
  detectedSourceLang?: string
  provider: TranslationProvider
  fallbackUsed: boolean
  card?: TranslationCard
  riskNotices?: TranslationRiskNotice[]
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

export type TranslationComparisonItem =
  | {
      model: string
      ok: true
      translatedText: string
      provider: TranslationProvider
      durationMs: number
    }
  | {
      model: string
      ok: false
      provider: TranslationProvider
      errorCode: TranslateErrorCode
      message: string
      durationMs: number
    }

export type TranslationComparisonResponse = {
  overallDurationMs: number
  results: TranslationComparisonItem[]
}

export type TranslationCompareResult =
  | {
      ok: true
      data: TranslationComparisonResponse
    }
  | {
      ok: false
      error: TranslateError
    }

export type TranslationMessage = {
  type: "translation:translate"
  payload: TranslateRequest
}

export type TranslationDebugLogMessage = {
  type: "translation:debug-log"
  payload: {
    level?: "info" | "error"
    event: string
    payload?: Record<string, unknown>
  }
}

export type TranslationEnvDefaultsMessage = {
  type: "translation:env-defaults"
  payload?: TranslationEnvDefaultsRequest
}

export type TranslationEnvDefaultsResponse = {
  ok: true
  data: {
    profileId: "custom" | "qwen-flash-card"
    providerFlavor: TranslationProviderFlavor
    apiKey: string
    baseUrl: string
    model: string
  }
}

export type TranslationStreamStartMessage = {
  type: "translation:stream-start"
  payload: TranslateRequest
}

export type TranslationStreamClientMessage = TranslationStreamStartMessage

export type TranslationStreamServerMessage =
  | {
      type: "translation:stream-update"
      payload: {
        traceId?: string
        model?: string
        provider: TranslationProvider
        card: Partial<TranslationCard>
        translatedText: string
      }
    }
  | {
      type: "translation:stream-complete"
      payload: {
        result: TranslateResult
      }
    }
  | {
      type: "translation:stream-error"
      payload: {
        message: string
      }
    }

export type TranslationCompareMessage = {
  type: "translation:compare"
  payload: TranslateRequest & {
    models?: string[]
  }
}

export type TranslationMessageResponse =
  | TranslateResult
  | TranslationCompareResult
  | TranslationEnvDefaultsResponse
