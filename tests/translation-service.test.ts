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

test("translateText returns openai-compatible result when provider flavor is openai-compatible", async () => {
  const fetchMock: typeof fetch = async (input, init) => {
    assert.equal(String(input), "https://api.openai.com/v1/chat/completions")
    const headers = init?.headers as Record<string, string>
    assert.equal(headers.Authorization, "Bearer openai-key")
    return jsonResponse(200, {
      choices: [{ message: { content: "黑曜石（OpenAI）" } }]
    })
  }

  const result = await translateText(
    {
      text: "Obsidian",
      targetLang: "zh-CN"
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "openai-key",
        LLM_BASE_URL: "https://api.openai.com",
        LLM_MODEL: "gpt-4o-mini"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.data.provider, "openai_compatible")
  assert.equal(result.data.translatedText, "黑曜石（OpenAI）")
  assert.equal(result.data.fallbackUsed, false)
})

test("translateText returns anthropic-compatible result when provider flavor is anthropic-compatible", async () => {
  const fetchMock: typeof fetch = async (input, init) => {
    assert.equal(String(input), "https://api.anthropic.com/v1/messages")
    const headers = init?.headers as Record<string, string>
    assert.equal(headers["x-api-key"], "anthropic-key")
    return jsonResponse(200, {
      content: [{ type: "text", text: "黑曜石（Anthropic）" }]
    })
  }

  const result = await translateText(
    {
      text: "Obsidian",
      targetLang: "zh-CN"
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "anthropic-compatible",
        LLM_API_KEY: "anthropic-key",
        LLM_BASE_URL: "https://api.anthropic.com",
        LLM_MODEL: "claude-3-5-haiku-latest"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.data.provider, "anthropic_compatible")
  assert.equal(result.data.translatedText, "黑曜石（Anthropic）")
})

test("translateText returns provider-specific error without fallback", async () => {
  const fetchMock: typeof fetch = async () => textResponse(429, "rate limited")

  const result = await translateText(
    {
      text: "Obsidian",
      targetLang: "zh-CN"
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "openai-key",
        LLM_BASE_URL: "https://api.openai.com",
        LLM_MODEL: "gpt-4o-mini"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.error.provider, "openai_compatible")
  assert.equal(result.error.code, "RATE_LIMITED")
})

test("translateText validates required api key", async () => {
  const result = await translateText(
    {
      text: "Obsidian",
      targetLang: "zh-CN"
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "anthropic-compatible",
        LLM_API_KEY: "",
        LLM_BASE_URL: "https://api.anthropic.com",
        LLM_MODEL: "claude-3-5-haiku-latest"
      }
    }
  )

  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.error.provider, "anthropic_compatible")
  assert.equal(result.error.code, "MISSING_API_KEY")
})

test("translateText emits debug hook events and uses translation-expert prompt", async () => {
  const debugEvents: Array<Record<string, unknown>> = []
  let capturedBody: Record<string, unknown> | null = null

  const fetchMock: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
    return jsonResponse(200, {
      choices: [{ message: { content: "黑曜石（OpenAI）" } }]
    })
  }

  const result = await translateText(
    { text: "Obsidian", targetLang: "zh-CN" },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "openai-key",
        LLM_BASE_URL: "https://api.openai.com",
        LLM_MODEL: "gpt-4o-mini"
      },
      fetchImpl: fetchMock,
      debugHook: (event) => {
        debugEvents.push(event as unknown as Record<string, unknown>)
      }
    }
  )

  assert.equal(result.ok, true)
  assert.ok(capturedBody)

  const messages = capturedBody?.messages as Array<Record<string, unknown>>
  assert.equal(Array.isArray(messages), true)
  assert.equal(String(messages?.[0]?.role), "system")
  assert.match(
    String(messages?.[0]?.content),
    /expert bilingual translation specialist/i
  )

  const stages = debugEvents.map((evt) => String(evt.stage))
  assert.ok(stages.includes("provider_resolved"))
  assert.ok(stages.includes("request_start"))
  assert.ok(stages.includes("response_success"))

  const successEvent = debugEvents.find((evt) => String(evt.stage) === "response_success")
  assert.ok(successEvent)
  assert.equal(typeof successEvent?.durationMs, "number")
})
