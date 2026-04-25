import assert from "node:assert/strict"
import test from "node:test"
import {
  getEnvDefaultsForSelection,
  handleComparisonMessage,
  handleTranslationMessage
} from "../background"
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

test("handleTranslationMessage uses qwen flash card profile from storage values only", async () => {
  const originalChrome = (globalThis as { chrome?: unknown }).chrome
  const originalFetch = globalThis.fetch

  ;(globalThis as { chrome?: unknown }).chrome = {
    storage: {
      local: {
        get: async () => ({
          [TRANSLATION_STORAGE_KEYS.profileId]: "qwen-flash-card",
          [TRANSLATION_STORAGE_KEYS.providerFlavor]: "anthropic-compatible",
          [TRANSLATION_STORAGE_KEYS.apiKey]: "stored-qwen-key",
          [TRANSLATION_STORAGE_KEYS.baseUrl]: "https://dashscope.aliyuncs.com/compatible-mode",
          [TRANSLATION_STORAGE_KEYS.model]: "MiniMax-M2.7"
        })
      }
    }
  }

  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions")
    const headers = init?.headers as Record<string, string>
    assert.equal(headers.Authorization, "Bearer stored-qwen-key")
    const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string }
    assert.equal(body.model, "qwen-mt-flash")
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ phonetic: "/pəˈfɔːməns/", meaning: "表现", example: "Good performance — 表现很好" }) } }]
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const result = await handleTranslationMessage({
      type: "translation:translate",
      payload: { text: "performance", targetLang: "zh-CN" }
    })

    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.data.provider, "openai_compatible")
    assert.equal(result.data.card?.meaning, "表现")
  } finally {
    globalThis.fetch = originalFetch
    if (originalChrome === undefined) {
      delete (globalThis as { chrome?: unknown }).chrome
    } else {
      ;(globalThis as { chrome?: unknown }).chrome = originalChrome
    }
  }
})

test("handleTranslationMessage does not fall back to runtime env when storage settings are empty", async () => {
  const originalChrome = (globalThis as { chrome?: unknown }).chrome
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

  try {
    const result = await handleTranslationMessage({
      type: "translation:translate",
      payload: { text: "Obsidian", targetLang: "zh-CN" }
    })

    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.error.code, "MISSING_API_KEY")
  } finally {
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

test("getEnvDefaultsForSelection uses Qwen env defaults for custom qwen models", () => {
  const originalQwenApiKey = process.env.QWEN_API_KEY
  const originalQwenBaseUrl = process.env.QWEN_BASE_URL
  const originalLlmApiKey = process.env.LLM_API_KEY
  const originalLlmBaseUrl = process.env.LLM_BASE_URL

  process.env.QWEN_API_KEY = "qwen-env-key"
  process.env.QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode"
  process.env.LLM_API_KEY = "generic-env-key"
  process.env.LLM_BASE_URL = "https://generic.example"

  try {
    const defaults = getEnvDefaultsForSelection({
      profileId: "custom",
      providerFlavor: "openai-compatible",
      model: "qwen-mt-plus"
    })

    assert.equal(defaults.profileId, "custom")
    assert.equal(defaults.providerFlavor, "openai-compatible")
    assert.equal(defaults.apiKey, "qwen-env-key")
    assert.equal(defaults.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode")
    assert.equal(defaults.model, "qwen-mt-plus")
  } finally {
    if (originalQwenApiKey === undefined) {
      delete process.env.QWEN_API_KEY
    } else {
      process.env.QWEN_API_KEY = originalQwenApiKey
    }
    if (originalQwenBaseUrl === undefined) {
      delete process.env.QWEN_BASE_URL
    } else {
      process.env.QWEN_BASE_URL = originalQwenBaseUrl
    }
    if (originalLlmApiKey === undefined) {
      delete process.env.LLM_API_KEY
    } else {
      process.env.LLM_API_KEY = originalLlmApiKey
    }
    if (originalLlmBaseUrl === undefined) {
      delete process.env.LLM_BASE_URL
    } else {
      process.env.LLM_BASE_URL = originalLlmBaseUrl
    }
  }
})

test("getEnvDefaultsForSelection uses built-in Qwen base url when env base url is missing", () => {
  const originalQwenApiKey = process.env.QWEN_API_KEY
  const originalQwenBaseUrl = process.env.QWEN_BASE_URL

  process.env.QWEN_API_KEY = "qwen-env-key"
  delete process.env.QWEN_BASE_URL

  try {
    const defaults = getEnvDefaultsForSelection({
      profileId: "qwen-flash-card"
    })

    assert.equal(defaults.profileId, "qwen-flash-card")
    assert.equal(defaults.providerFlavor, "openai-compatible")
    assert.equal(defaults.apiKey, "qwen-env-key")
    assert.equal(defaults.baseUrl, "https://dashscope.aliyuncs.com/compatible-mode")
    assert.equal(defaults.model, "qwen-mt-flash")
  } finally {
    if (originalQwenApiKey === undefined) {
      delete process.env.QWEN_API_KEY
    } else {
      process.env.QWEN_API_KEY = originalQwenApiKey
    }
    if (originalQwenBaseUrl === undefined) {
      delete process.env.QWEN_BASE_URL
    } else {
      process.env.QWEN_BASE_URL = originalQwenBaseUrl
    }
  }
})

test("getEnvDefaultsForSelection uses generic env defaults for non-qwen custom models", () => {
  const originalQwenApiKey = process.env.QWEN_API_KEY
  const originalQwenBaseUrl = process.env.QWEN_BASE_URL
  const originalLlmApiKey = process.env.LLM_API_KEY
  const originalLlmBaseUrl = process.env.LLM_BASE_URL
  const originalLlmModel = process.env.LLM_MODEL

  process.env.QWEN_API_KEY = "qwen-env-key"
  process.env.QWEN_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode"
  process.env.LLM_API_KEY = "generic-env-key"
  process.env.LLM_BASE_URL = "https://generic.example"
  process.env.LLM_MODEL = "gpt-4o-mini"

  try {
    const defaults = getEnvDefaultsForSelection({
      profileId: "custom",
      providerFlavor: "openai-compatible",
      model: "gpt-4.1-mini"
    })

    assert.equal(defaults.apiKey, "generic-env-key")
    assert.equal(defaults.baseUrl, "https://generic.example")
    assert.equal(defaults.model, "gpt-4.1-mini")
  } finally {
    if (originalQwenApiKey === undefined) {
      delete process.env.QWEN_API_KEY
    } else {
      process.env.QWEN_API_KEY = originalQwenApiKey
    }
    if (originalQwenBaseUrl === undefined) {
      delete process.env.QWEN_BASE_URL
    } else {
      process.env.QWEN_BASE_URL = originalQwenBaseUrl
    }
    if (originalLlmApiKey === undefined) {
      delete process.env.LLM_API_KEY
    } else {
      process.env.LLM_API_KEY = originalLlmApiKey
    }
    if (originalLlmBaseUrl === undefined) {
      delete process.env.LLM_BASE_URL
    } else {
      process.env.LLM_BASE_URL = originalLlmBaseUrl
    }
    if (originalLlmModel === undefined) {
      delete process.env.LLM_MODEL
    } else {
      process.env.LLM_MODEL = originalLlmModel
    }
  }
})

test("handleTranslationMessage applies modelOverride when provided", async () => {
  const result = await handleTranslationMessage(
    {
      type: "translation:translate",
      payload: {
        text: "Obsidian",
        targetLang: "zh-CN",
        modelOverride: "qwen-mt-flash"
      }
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "openai-key",
        LLM_BASE_URL: "https://api.openai.com",
        LLM_MODEL: "default-model"
      },
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { model?: string }
        assert.equal(body.model, "qwen-mt-flash")
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "黑曜石（Override）" } }]
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
  if (!result.ok) return
  assert.equal(result.data.translatedText, "黑曜石（Override）")
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
      if (Array.isArray(logs) && logs.some((entry) => entry.event === "request_succeeded")) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }

    const logs = store[TRANSLATION_STORAGE_KEYS.debugLogs] as Array<{
      event: string
      seq?: number
      payload: Record<string, unknown>
    }>
    assert.ok(Array.isArray(logs))
    assert.ok(logs.length > 0)
    assert.ok(logs.length > 0)

    const seqValues = logs.map((entry) => Number(entry.seq ?? 0))
    assert.ok(seqValues.every((value) => Number.isInteger(value) && value > 0))
    const sortedSeqValues = [...seqValues].sort((a, b) => a - b)
    assert.deepEqual(seqValues, sortedSeqValues)

    const successEvent = logs.find((entry) => entry.event === "request_succeeded")
    assert.ok(successEvent)
    assert.equal(successEvent?.payload?.model, "gpt-4o-mini")

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

test("background request_failed log persists model when translation fails", async () => {
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
        payload: {
          text: "Obsidian",
          targetLang: "zh-CN",
          modelOverride: "qwen-mt-lite"
        }
      },
      {
        env: {
          LLM_PROVIDER_FLAVOR: "openai-compatible",
          LLM_API_KEY: "openai-key",
          LLM_BASE_URL: "https://api.openai.com",
          LLM_MODEL: "default-model"
        },
        fetchImpl: async () => new Response("rate limited", { status: 429 })
      }
    )

    assert.equal(result.ok, false)
    for (let i = 0; i < 120; i += 1) {
      const logs = store[TRANSLATION_STORAGE_KEYS.debugLogs] as Array<{ event: string }>
      if (Array.isArray(logs) && logs.some((entry) => entry.event === "request_failed")) {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 25))
    }

    const logs = store[TRANSLATION_STORAGE_KEYS.debugLogs] as Array<{
      event: string
      payload: Record<string, unknown>
    }>
    const failedEvent = logs.find((entry) => entry.event === "request_failed")
    assert.ok(failedEvent)
    assert.equal(failedEvent?.payload?.model, "qwen-mt-lite")
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

test("handleComparisonMessage returns per-model results and overall duration", async () => {
  const result = await handleComparisonMessage(
    {
      type: "translation:compare",
      payload: {
        text: "Obsidian",
        targetLang: "zh-CN",
        models: ["qwen-mt-plus", "qwen-mt-flash"]
      }
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "openai-key",
        LLM_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode",
        LLM_MODEL: "qwen-mt-plus"
      },
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          model?: string
        }
        if (body.model === "qwen-mt-flash") {
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: "示例" } }]
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "例子" } }]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok || !("results" in result.data)) return
  assert.equal(result.data.results.length, 2)
  assert.equal(result.data.results[0]?.model, "qwen-mt-plus")
  assert.equal(result.data.results[1]?.model, "qwen-mt-flash")
  assert.equal(result.data.overallDurationMs >= 0, true)
})
