import assert from "node:assert/strict"
import test from "node:test"

import { handleTranslationMessage } from "../background"

test("handleTranslationMessage validates empty text", async () => {
  const result = await handleTranslationMessage({
    type: "translation:translate",
    payload: {
      text: "   ",
      targetLang: "zh-CN"
    }
  })

  assert.equal(result.ok, false)
  if (result.ok) {
    return
  }
  assert.equal(result.error.code, "BAD_REQUEST")
})

test("content -> background response keeps contract shape", async () => {
  const result = await handleTranslationMessage(
    {
      type: "translation:translate",
      payload: { text: "Obsidian", targetLang: "zh-CN" }
    },
    {
      env: {
        AZURE_TRANSLATOR_KEY: "azure-key",
        AZURE_TRANSLATOR_REGION: "eastasia",
        DEEPL_API_KEY: "deepl-key"
      },
      fetchImpl: async (input) => {
        const url = String(input)
        if (url.includes("microsofttranslator")) {
          return new Response("Too many requests", { status: 429 })
        }
        return new Response(
          JSON.stringify({
            translations: [{ text: "黑曜石", detected_source_language: "EN" }]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
      }
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
