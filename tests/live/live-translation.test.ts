import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { translateText } from "../../lib/translation-service"

const repoRoot = process.cwd()
const envLocalPath = path.join(repoRoot, ".env.local")

const parseDotEnv = (source: string): Record<string, string> => {
  const result: Record<string, string> = {}
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1")
    result[key] = value
  }
  return result
}

const maskSecret = (value: string) => {
  if (!value) return "<empty>"
  if (value.length <= 6) return `${value[0]}***${value.at(-1)}`
  return `${value.slice(0, 3)}***${value.slice(-3)}`
}

const loadEnvLocal = () => {
  const fromFile = fs.existsSync(envLocalPath)
    ? parseDotEnv(fs.readFileSync(envLocalPath, "utf8"))
    : {}
  return {
    LLM_PROVIDER_FLAVOR:
      process.env.LLM_PROVIDER_FLAVOR || fromFile.LLM_PROVIDER_FLAVOR || "openai-compatible",
    LLM_API_KEY: process.env.LLM_API_KEY || fromFile.LLM_API_KEY || "",
    LLM_BASE_URL: process.env.LLM_BASE_URL || fromFile.LLM_BASE_URL || "",
    LLM_MODEL: process.env.LLM_MODEL || fromFile.LLM_MODEL || ""
  }
}

const run = async () => {
  const env = loadEnvLocal()
  console.log("[live-test] provider:", env.LLM_PROVIDER_FLAVOR)
  console.log("[live-test] baseUrl:", env.LLM_BASE_URL)
  console.log("[live-test] model:", env.LLM_MODEL)
  console.log("[live-test] apiKey:", maskSecret(env.LLM_API_KEY))

  assert.notEqual(env.LLM_API_KEY, "", "LLM_API_KEY is empty")
  assert.notEqual(env.LLM_BASE_URL, "", "LLM_BASE_URL is empty")
  assert.notEqual(env.LLM_MODEL, "", "LLM_MODEL is empty")

  const startedAt = Date.now()
  const result = await translateText(
    {
      text: "Obsidian",
      targetLang: "zh-CN"
    },
    {
      env,
      providerTimeoutMs: 20_000
    }
  )
  const durationMs = Date.now() - startedAt

  if (!result.ok) {
    throw new Error(
      `[live-test] translate failed: ${result.error.provider}:${result.error.code} ${result.error.message}`
    )
  }

  console.log("[live-test] provider:", result.data.provider)
  console.log("[live-test] durationMs:", durationMs)
  console.log("[live-test] translated:", result.data.translatedText)
  assert.ok(result.data.translatedText.trim().length > 0, "translated text is empty")
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
