import type {
  TranslationMessage,
  TranslationMessageResponse
} from "./lib/translation-contract"
import { translateText, type TranslateDependencies } from "./lib/translation-service"

const isTranslationMessage = (message: unknown): message is TranslationMessage => {
  if (!message || typeof message !== "object") {
    return false
  }
  const candidate = message as Partial<TranslationMessage>
  return candidate.type === "translation:translate" && typeof candidate.payload?.text === "string"
}

const getE2EDependencies = (mode: NonNullable<TranslationMessage["payload"]["e2eMode"]>) => {
  const mockFetch: typeof fetch = async (input) => {
    const url = String(input)
    if (mode === "azure_success") {
      if (url.includes("microsofttranslator")) {
        await new Promise((resolve) => setTimeout(resolve, 120))
        return new Response(
          JSON.stringify([
            {
              detectedLanguage: { language: "en" },
              translations: [{ text: "黑曜石（Azure）" }]
            }
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      return new Response("Unexpected DeepL call", { status: 500 })
    }

    if (mode === "azure_rate_limit_then_deepl_success") {
      if (url.includes("microsofttranslator")) {
        return new Response("Too many requests", { status: 429 })
      }
      return new Response(
        JSON.stringify({
          translations: [{ text: "黑曜石（DeepL）", detected_source_language: "EN" }]
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    }

    return new Response("Upstream unavailable", { status: 500 })
  }

  const mockEnv: Record<string, string> = {
    AZURE_TRANSLATOR_KEY: "e2e-azure-key",
    AZURE_TRANSLATOR_REGION: "eastasia",
    DEEPL_API_KEY: "e2e-deepl-key"
  }

  return {
    env: mockEnv,
    fetchImpl: mockFetch
  } satisfies TranslateDependencies
}

export const handleTranslationMessage = async (
  message: TranslationMessage,
  deps?: TranslateDependencies
): Promise<TranslationMessageResponse> => {
  const text = message.payload.text.trim()
  if (!text) {
    return {
      ok: false,
      error: {
        code: "BAD_REQUEST",
        provider: "azure",
        message: "Text is empty"
      }
    }
  }

  return translateText(
    {
      text,
      targetLang: message.payload.targetLang ?? "zh-CN",
      sourceLang: message.payload.sourceLang
    },
    message.payload.e2eMode ? getE2EDependencies(message.payload.e2eMode) : deps
  )
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
        sendResponse({
          ok: false,
          error: {
            code: "UNKNOWN",
            provider: "azure",
            message: error instanceof Error ? error.message : "Unexpected translation error"
          }
        })
      })

    return true
  })
}
