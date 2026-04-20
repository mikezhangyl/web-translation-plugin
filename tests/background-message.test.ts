import assert from "node:assert/strict"
import test from "node:test"
import { handleTranslationMessage } from "../background"
import { TRANSLATION_STORAGE_KEYS } from "../lib/translation-settings"

test("handleTranslationMessage validates empty text", async () => {
  const result = await handleTranslationMessage({
    type: "translation:translate",
    payload: {
      text: "   ",
      targetLang: "zh-CN"
    }
  })

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.error.code, "BAD_REQUEST")
})

test("content -> background response keeps contract shape for openai-compatible", async () => {
  const result = await handleTranslationMessage(
    {
      type: "translation:translate",
      payload: { text: "Obsidian", targetLang: "zh-CN" }
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "openai-key",
        LLM_BASE_URL: "https://api.openai.com",
        LLM_MODEL: "gpt-4o-mini"
      },
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "黑曜石（OpenAI）" } }]
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        )
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.data.provider, "openai_compatible")
  assert.equal(result.data.fallbackUsed, false)
  assert.equal(result.data.translatedText, "黑曜石（OpenAI）")
})

test("handleTranslationMessage uses popup storage settings over process env", async () => {
  const originalChrome = (globalThis as { chrome?: unknown }).chrome
  const originalFetch = globalThis.fetch
  const originalProviderFlavor = process.env.LLM_PROVIDER_FLAVOR
  const originalApiKey = process.env.LLM_API_KEY
  const originalBaseUrl = process.env.LLM_BASE_URL
  const originalModel = process.env.LLM_MODEL

  process.env.LLM_PROVIDER_FLAVOR = "openai-compatible"
  process.env.LLM_API_KEY = "env-key"
  process.env.LLM_BASE_URL = "https://env.example"
  process.env.LLM_MODEL = "env-model"

  ;(globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: async () => ({
          [TRANSLATION_STORAGE_KEYS.providerFlavor]: "anthropic-compatible",
          [TRANSLATION_STORAGE_KEYS.apiKey]: "stored-key",
          [TRANSLATION_STORAGE_KEYS.baseUrl]: "https://api.minimaxi.com/anthropic",
          [TRANSLATION_STORAGE_KEYS.model]: "MiniMax-M2.7"
        })
      }
    }
  }

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.minimaxi.com/anthropic/v1/messages")
    const headers = init?.headers as Record<string, string>
    assert.equal(headers["x-api-key"], "stored-key")
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: "黑曜石（Anthropic）" }]
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  }

  try {
    const result = await handleTranslationMessage({
      type: "translation:translate",
      payload: { text: "Obsidian", targetLang: "zh-CN" }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.data.provider, "anthropic_compatible")
    assert.equal(result.data.translatedText, "黑曜石（Anthropic）")
  } finally {
    globalThis.fetch = originalFetch

    if (originalChrome === undefined) {
      delete (globalThis as { chrome?: unknown }).chrome
    } else {
      ;(globalThis as { chrome?: unknown }).chrome = originalChrome
    }

    if (originalProviderFlavor === undefined) {
      delete process.env.LLM_PROVIDER_FLAVOR
    } else {
      process.env.LLM_PROVIDER_FLAVOR = originalProviderFlavor
    }
    if (originalApiKey === undefined) {
      delete process.env.LLM_API_KEY
    } else {
      process.env.LLM_API_KEY = originalApiKey
    }
    if (originalBaseUrl === undefined) {
      delete process.env.LLM_BASE_URL
    } else {
      process.env.LLM_BASE_URL = originalBaseUrl
    }
    if (originalModel === undefined) {
      delete process.env.LLM_MODEL
    } else {
      process.env.LLM_MODEL = originalModel
    }
  }
})

test("handleTranslationMessage falls back to runtime env when storage settings are empty", async () => {
  const originalChrome = (globalThis as { chrome?: unknown }).chrome
  const originalFetch = globalThis.fetch
  const originalProviderFlavor = process.env.LLM_PROVIDER_FLAVOR
  const originalApiKey = process.env.LLM_API_KEY
  const originalBaseUrl = process.env.LLM_BASE_URL
  const originalModel = process.env.LLM_MODEL

  process.env.LLM_PROVIDER_FLAVOR = "anthropic-compatible"
  process.env.LLM_API_KEY = "env-live-key"
  process.env.LLM_BASE_URL = "https://env.anthropic.example"
  process.env.LLM_MODEL = "env-anthropic-model"

  ;(globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: async () => ({
          [TRANSLATION_STORAGE_KEYS.providerFlavor]: "",
          [TRANSLATION_STORAGE_KEYS.apiKey]: "",
          [TRANSLATION_STORAGE_KEYS.baseUrl]: "",
          [TRANSLATION_STORAGE_KEYS.model]: ""
        })
      }
    }
  }

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://env.anthropic.example/v1/messages")
    const headers = init?.headers as Record<string, string>
    assert.equal(headers["x-api-key"], "env-live-key")
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: "黑曜石（Env）" }]
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    )
  }

  try {
    const result = await handleTranslationMessage({
      type: "translation:translate",
      payload: { text: "Obsidian", targetLang: "zh-CN" }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.data.provider, "anthropic_compatible")
    assert.equal(result.data.translatedText, "黑曜石（Env）")
  } finally {
    globalThis.fetch = originalFetch

    if (originalChrome === undefined) {
      delete (globalThis as { chrome?: unknown }).chrome
    } else {
      ;(globalThis as { chrome?: unknown }).chrome = originalChrome
    }

    if (originalProviderFlavor === undefined) {
      delete process.env.LLM_PROVIDER_FLAVOR
    } else {
      process.env.LLM_PROVIDER_FLAVOR = originalProviderFlavor
    }
    if (originalApiKey === undefined) {
      delete process.env.LLM_API_KEY
    } else {
      process.env.LLM_API_KEY = originalApiKey
    }
    if (originalBaseUrl === undefined) {
      delete process.env.LLM_BASE_URL
    } else {
      process.env.LLM_BASE_URL = originalBaseUrl
    }
    if (originalModel === undefined) {
      delete process.env.LLM_MODEL
    } else {
      process.env.LLM_MODEL = originalModel
    }
  }
})

test("background troubleshooting logs are persisted when debug switch is enabled", async () => {
  const originalChrome = (globalThis as { chrome?: unknown }).chrome
  const store: Record<string, unknown> = {
    [TRANSLATION_STORAGE_KEYS.debugEnabled]: true,
    [TRANSLATION_STORAGE_KEYS.debugLogs]: []
  }

  ;(globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: async (keys: string[]) => {
          const out: Record<string, unknown> = {}
          for (const key of keys) {
            out[key] = store[key]
          }
          return out
        },
        set: async (nextValues: Record<string, unknown>) => {
          Object.assign(store, nextValues)
        }
      }
    }
  }

  try {
    const result = await handleTranslationMessage(
      {
        type: "translation:translate",
        payload: { text: "Obsidian", targetLang: "zh-CN" }
      },
      {
        env: {
          LLM_PROVIDER_FLAVOR: "openai-compatible",
          LLM_API_KEY: "openai-key",
          LLM_BASE_URL: "https://api.openai.com",
          LLM_MODEL: "gpt-4o-mini"
        },
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "黑曜石（OpenAI）" } }]
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          )
      }
    )

    assert.equal(result.ok, true)
    for (let i = 0; i < 120; i += 1) {
      const logs = store[TRANSLATION_STORAGE_KEYS.debugLogs] as Array<{ event: string }>
      if (Array.isArray(logs) && logs.length > 0) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }

    const logs = store[TRANSLATION_STORAGE_KEYS.debugLogs] as Array<{
      event: string
      payload: Record<string, unknown>
    }>
    assert.ok(Array.isArray(logs))
    assert.ok(logs.length > 0)
    assert.ok(logs.length > 0)

    const timingEvent = logs.find(
      (entry) => typeof entry.payload?.durationMs === "number"
    )
    assert.ok(timingEvent || logs.find((entry) => entry.event === "request_received"))
  } finally {
    if (originalChrome === undefined) {
      delete (globalThis as { chrome?: unknown }).chrome
    } else {
      ;(globalThis as { chrome?: unknown }).chrome = originalChrome
    }
  }
})

test("background troubleshooting logs are skipped when debug switch is disabled", async () => {
  const originalChrome = (globalThis as { chrome?: unknown }).chrome
  let setCalled = false
  const store: Record<string, unknown> = {
    [TRANSLATION_STORAGE_KEYS.debugEnabled]: false,
    [TRANSLATION_STORAGE_KEYS.debugLogs]: []
  }

  ;(globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: async (keys: string[]) => {
          const out: Record<string, unknown> = {}
          for (const key of keys) {
            out[key] = store[key]
          }
          return out
        },
        set: async (_nextValues: Record<string, unknown>) => {
          setCalled = true
        }
      }
    }
  }

  try {
    const result = await handleTranslationMessage(
      {
        type: "translation:translate",
        payload: { text: "Obsidian", targetLang: "zh-CN" }
      },
      {
        env: {
          LLM_PROVIDER_FLAVOR: "openai-compatible",
          LLM_API_KEY: "openai-key",
          LLM_BASE_URL: "https://api.openai.com",
          LLM_MODEL: "gpt-4o-mini"
        },
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              choices: [{ message: { content: "黑曜石（OpenAI）" } }]
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" }
            }
          )
      }
    )

    assert.equal(result.ok, true)
    assert.equal(setCalled, false)
  } finally {
    if (originalChrome === undefined) {
      delete (globalThis as { chrome?: unknown }).chrome
    } else {
      ;(globalThis as { chrome?: unknown }).chrome = originalChrome
    }
  }
})
