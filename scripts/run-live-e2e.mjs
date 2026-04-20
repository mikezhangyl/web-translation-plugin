import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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
    if (value) {
      return value
    }
  }
  return ""
}

const runtimeEnv = { ...process.env, RUN_LIVE_E2E: "1" }

const mappings = [
  ["LLM_PROVIDER_FLAVOR", "PLASMO_PUBLIC_LLM_PROVIDER_FLAVOR"],
  ["LLM_API_KEY", "PLASMO_PUBLIC_LLM_API_KEY"],
  ["LLM_BASE_URL", "PLASMO_PUBLIC_LLM_BASE_URL"],
  ["LLM_MODEL", "PLASMO_PUBLIC_LLM_MODEL"]
]

for (const [privateKey, publicKey] of mappings) {
  runtimeEnv[publicKey] = pick(publicKey, privateKey)
}

const requiredPublicKeys = [
  "PLASMO_PUBLIC_LLM_API_KEY",
  "PLASMO_PUBLIC_LLM_BASE_URL",
  "PLASMO_PUBLIC_LLM_MODEL"
]
for (const key of requiredPublicKeys) {
  if (!runtimeEnv[key]) {
    console.error(
      `BLOCKED: missing ${key} (or mapped source) in process env or .env.local for live E2E run.`
    )
    process.exit(1)
  }
}

const run = (cmd, args) => {
  const result = spawnSync(cmd, args, {
    stdio: "inherit",
    env: runtimeEnv
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const originalEnvLocal = existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : null
const ensurePublicEnvInDotEnvLocal = () => {
  const lines = originalEnvLocal ? originalEnvLocal.split(/\r?\n/) : []
  const existingKeys = new Set(
    lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.slice(0, line.indexOf("=")).trim())
  )

  for (const key of requiredPublicKeys) {
    if (!existingKeys.has(key)) {
      lines.push(`${key}=${runtimeEnv[key]}`)
    }
  }

  const nextContent = `${lines.join("\n").replace(/\n*$/, "\n")}`
  writeFileSync(envLocalPath, nextContent, "utf8")
}

try {
  ensurePublicEnvInDotEnvLocal()
  run("npm", ["run", "build"])
  run("npx", ["playwright", "test", "tests/e2e/live-selection-flow.spec.ts"])
} finally {
  if (originalEnvLocal === null) {
    rmSync(envLocalPath, { force: true })
  } else {
    writeFileSync(envLocalPath, originalEnvLocal, "utf8")
  }
}
