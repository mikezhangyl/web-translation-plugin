import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const repoRoot = process.cwd()
const envLocalPath = path.join(repoRoot, ".env.local")

const parseDotEnv = (source) => {
  const result = {}
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

const fileEnv = existsSync(envLocalPath) ? parseDotEnv(readFileSync(envLocalPath, "utf8")) : {}
const pick = (...keys) => {
  for (const key of keys) {
    const value = (process.env[key] ?? fileEnv[key] ?? "").trim()
    if (value) return value
  }
  return ""
}

const liveReady =
  Boolean(pick("LLM_API_KEY", "QWEN_API_KEY", "PLASMO_PUBLIC_LLM_API_KEY")) &&
  Boolean(pick("LLM_BASE_URL", "QWEN_BASE_URL", "PLASMO_PUBLIC_LLM_BASE_URL")) &&
  Boolean(pick("LLM_MODEL", "QWEN_MODEL", "PLASMO_PUBLIC_LLM_MODEL"))

if (!liveReady) {
  console.log("[live-gate] SKIP: live provider config unavailable; skipping live E2E gate.")
  process.exit(0)
}

console.log("[live-gate] RUN: live provider config detected; enforcing live E2E gate.")
const result = spawnSync("npm", ["run", "test:e2e"], {
  stdio: "inherit",
  env: process.env
})
if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
console.log("[live-gate] PASS: live E2E gate passed.")
