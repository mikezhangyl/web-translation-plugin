import assert from "node:assert/strict"
import test from "node:test"

import { translateText } from "../lib/translation-service"

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  })

const textResponse = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" }
  })

test("translateText returns azure result when azure succeeds", async () => {
  const fetchMock: typeof fetch = async (input) => {
    assert.match(String(input), /microsofttranslator/)
    return jsonResponse(200, [
      {
        detectedLanguage: { language: "en" },
        translations: [{ text: "黑曜石" }]
      }
    ])
  }

  const result = await translateText(
    {
      text: "Obsidian",
      targetLang: "zh-CN"
    },
    {
      env: {
        AZURE_TRANSLATOR_KEY: "azure-key",
        AZURE_TRANSLATOR_REGION: "eastasia",
        DEEPL_API_KEY: "deepl-key"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    return
  }
  assert.equal(result.data.provider, "azure")
  assert.equal(result.data.translatedText, "黑曜石")
  assert.equal(result.data.fallbackUsed, false)
})

test("translateText falls back to deepl when azure is rate-limited", async () => {
  const fetchMock: typeof fetch = async (input) => {
    const url = String(input)
    if (url.includes("microsofttranslator")) {
      return textResponse(429, "Too many requests")
    }
    assert.match(url, /deepl/)
    return jsonResponse(200, {
      translations: [{ text: "黑曜石", detected_source_language: "EN" }]
    })
  }

  const result = await translateText(
    {
      text: "Obsidian",
      targetLang: "zh-CN"
    },
    {
      env: {
        AZURE_TRANSLATOR_KEY: "azure-key",
        AZURE_TRANSLATOR_REGION: "eastasia",
        DEEPL_API_KEY: "deepl-key"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) {
    return
  }
  assert.equal(result.data.provider, "deepl")
  assert.equal(result.data.fallbackUsed, true)
  assert.equal(result.data.translatedText, "黑曜石")
})

test("translateText returns deepl error when both providers fail", async () => {
  const fetchMock: typeof fetch = async (input) => {
    const url = String(input)
    if (url.includes("microsofttranslator")) {
      return textResponse(500, "Azure upstream error")
    }
    return textResponse(500, "DeepL upstream error")
  }

  const result = await translateText(
    {
      text: "Obsidian",
      targetLang: "zh-CN"
    },
    {
      env: {
        AZURE_TRANSLATOR_KEY: "azure-key",
        AZURE_TRANSLATOR_REGION: "eastasia",
        DEEPL_API_KEY: "deepl-key"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    return
  }
  assert.equal(result.error.provider, "deepl")
  assert.equal(result.error.code, "UPSTREAM_5XX")
})

test("translateText does not fallback on azure bad request", async () => {
  const fetchMock: typeof fetch = async () => textResponse(400, "Bad request")

  const result = await translateText(
    {
      text: "Obsidian",
      targetLang: "zh-CN"
    },
    {
      env: {
        AZURE_TRANSLATOR_KEY: "azure-key",
        AZURE_TRANSLATOR_REGION: "eastasia",
        DEEPL_API_KEY: "deepl-key"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, false)
  if (result.ok) {
    return
  }
  assert.equal(result.error.provider, "azure")
  assert.equal(result.error.code, "BAD_REQUEST")
})
