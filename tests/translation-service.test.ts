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

test("translateText returns structured flash card fields for qwen-mt-flash", async () => {
  let capturedBody: Record<string, unknown> | null = null

  const fetchMock: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
    return jsonResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              phonetic: "/pərˈfɔːrməns/",
              meaning: "表现；绩效",
              literal: "执行、完成某事的表现",
              note: "",
              example: "The team's performance improved this quarter. — 这个季度团队的表现提升了。"
            })
          }
        }
      ]
    })
  }

  const result = await translateText(
    {
      text: "performance",
      targetLang: "zh-CN"
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "qwen-key",
        LLM_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode",
        LLM_MODEL: "qwen-mt-flash"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) return

  const messages = capturedBody?.messages as Array<Record<string, unknown>>
  assert.equal(messages.length, 1)
  assert.equal(String(messages[0]?.role), "user")
  assert.match(String(messages[0]?.content), /Return strict JSON only/i)
  assert.match(String(messages[0]?.content), /natural/i)
  assert.match(String(messages[0]?.content), /literal/i)
  assert.match(String(messages[0]?.content), /note/i)
  assert.equal(result.data.card?.phonetic, "/pərˈfɔːrməns/")
  assert.equal(result.data.card?.meaning, "表现；绩效")
  assert.equal(result.data.card?.literal, "执行、完成某事的表现")
  assert.equal(result.data.card?.note, "")
  assert.match(String(result.data.card?.example), /performance improved this quarter/i)
  assert.match(result.data.translatedText, /表现；绩效/)
})

test("translateText preserves literal translation and usage note for non-literal flash-card phrases", async () => {
  const fetchMock: typeof fetch = async () =>
    jsonResponse(200, {
      choices: [
        {
          message: {
            content: JSON.stringify({
              phonetic: "/ˈkɔːfi bædʒɪŋ/",
              meaning: "到办公室短暂停留刷存在感",
              literal: "咖啡打卡",
              note: "This workplace slang describes going to the office briefly, often to be seen, before leaving to work elsewhere.",
              example: "Coffee badging is common in hybrid offices. — 在混合办公环境里，到办公室短暂停留刷存在感很常见。"
            })
          }
        }
      ]
    })

  const result = await translateText(
    {
      text: "coffee badging",
      targetLang: "zh-CN"
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "qwen-key",
        LLM_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode",
        LLM_MODEL: "qwen-mt-flash"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(result.data.card?.meaning, "到办公室短暂停留刷存在感")
  assert.equal(result.data.card?.literal, "咖啡打卡")
  assert.match(String(result.data.card?.note), /workplace slang/i)
  assert.match(result.data.translatedText, /到办公室短暂停留刷存在感/)
  assert.match(result.data.translatedText, /咖啡打卡/)
  assert.match(result.data.translatedText, /workplace slang/i)
})

test("translateText returns plain sentence translation for qwen-mt-flash sentence input", async () => {
  const capturedBodies: Array<Record<string, unknown>> = []

  const fetchMock: typeof fetch = async (_input, init) => {
    capturedBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>)
    return jsonResponse(200, {
      choices: [{ message: { content: "这是一句完整的中文译文。" } }]
    })
  }

  const result = await translateText(
    {
      text: "Obsidian Web Clipper is a fast and clean way to save notes.",
      targetLang: "zh-CN"
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "qwen-key",
        LLM_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode",
        LLM_MODEL: "qwen-mt-flash"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) return

  const body = capturedBodies[0] as {
    messages?: Array<{ role?: string; content?: string }>
    translation_options?: { source_lang?: string; target_lang?: string }
  }
  assert.equal(capturedBodies.length, 2)
  assert.ok(body.translation_options)
  assert.equal(body.translation_options?.source_lang, "auto")
  assert.equal(body.translation_options?.target_lang, "Chinese")
  assert.equal(Array.isArray(body.messages), true)
  assert.equal(String(body.messages?.[0]?.content), "Obsidian Web Clipper is a fast and clean way to save notes.")
  assert.equal(result.data.card, undefined)
  assert.equal(result.data.translatedText, "这是一句完整的中文译文。")
})

test("translateText attaches suspicious expression notices for qwen sentence translations", async () => {
  const capturedBodies: Array<Record<string, unknown>> = []

  const fetchMock: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>
    capturedBodies.push(body)
    const messages = body.messages as Array<{ content?: string }>
    const content = String(messages?.[0]?.content ?? "")
    if (content.includes("MACHINE_TRANSLATION:")) {
      return jsonResponse(200, {
        choices: [
          {
            message: {
              content: JSON.stringify({
                suspicious_terms: [
                  {
                    source: "coffee badging",
                    translation: "咖啡打卡",
                    reason: "This may be workplace slang and a literal translation can mislead readers.",
                    suggested_meaning: "briefly showing up at the office to appear present",
                    risk: "high"
                  }
                ],
                overall_assessment: "The translation is mostly readable, but one expression may be misleading."
              })
            }
          }
        ]
      })
    }
    return jsonResponse(200, {
      choices: [{ message: { content: "咖啡打卡可能会被人力资源部门发现。" } }]
    })
  }

  const result = await translateText(
    {
      text: "Coffee badging may be detected by HR.",
      targetLang: "zh-CN"
    },
    {
      env: {
        LLM_PROVIDER_FLAVOR: "openai-compatible",
        LLM_API_KEY: "qwen-key",
        LLM_BASE_URL: "https://dashscope.aliyuncs.com/compatible-mode",
        LLM_MODEL: "qwen-mt-flash"
      },
      fetchImpl: fetchMock
    }
  )

  assert.equal(result.ok, true)
  if (!result.ok) return

  assert.equal(capturedBodies.length, 2)
  assert.match(
    String((capturedBodies[1]?.messages as Array<{ content?: string }>)[0]?.content),
    /Flag only expressions that may be slang/i
  )
  assert.equal(result.data.translatedText, "咖啡打卡可能会被人力资源部门发现。")
  assert.equal(result.data.riskNotices?.length, 1)
  assert.equal(result.data.riskNotices?.[0]?.source, "coffee badging")
  assert.equal(result.data.riskNotices?.[0]?.translation, "咖啡打卡")
  assert.equal(result.data.riskNotices?.[0]?.risk, "high")
})
