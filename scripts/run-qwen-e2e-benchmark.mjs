import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { chromium } from "@playwright/test"

const repoRoot = process.cwd()
const envLocalPath = path.join(repoRoot, ".env.local")
const extensionPath = path.join(repoRoot, "build/chrome-mv3-prod")
const reportsDir = path.join(repoRoot, "harness/reports")
const artifactsRoot = path.join(reportsDir, "qwen-benchmark-artifacts")
const now = new Date()
const stamp = now.toISOString().replace(/[:.]/g, "-")
const outputDir = path.join(artifactsRoot, stamp)

const STORAGE_KEYS = {
  providerFlavor: "translation.provider.flavor",
  apiKey: "translation.provider.apiKey",
  baseUrl: "translation.provider.baseUrl",
  model: "translation.provider.model",
  debugEnabled: "translation.debug.enabled",
  debugLogs: "translation.debug.logs"
}

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

const csvModels = pick("QWEN_MODELS")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean)

const keyedModels = Object.entries({
  ...fileEnv,
  ...process.env
})
  .filter(([key, value]) => key.startsWith("QWEN_MODEL") && key !== "QWEN_MODELS" && String(value).trim())
  .map(([, value]) => String(value).trim())

const models = Array.from(new Set([...csvModels, ...keyedModels]))
const providerFlavor = pick("QWEN_PROVIDER_FLAVOR", "LLM_PROVIDER_FLAVOR") || "openai-compatible"
const apiKey = pick("QWEN_API_KEY", "LLM_API_KEY")
const baseUrl = pick("QWEN_BASE_URL", "LLM_BASE_URL")

if (!apiKey) {
  console.error("BLOCKED: missing QWEN_API_KEY (or fallback LLM_API_KEY) in .env.local / env.")
  process.exit(1)
}
if (!baseUrl) {
  console.error("BLOCKED: missing QWEN_BASE_URL (or fallback LLM_BASE_URL) in .env.local / env.")
  process.exit(1)
}
if (models.length === 0) {
  console.error("BLOCKED: no benchmark models found. Define QWEN_MODELS or QWEN_MODEL* in .env.local.")
  process.exit(1)
}

mkdirSync(outputDir, { recursive: true })

const getExtensionId = async (context) => {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
  const match = worker.url().match(/^chrome-extension:\/\/([a-z]{32})\//)
  if (!match) {
    throw new Error(`Unable to parse extension id from service worker URL: ${worker.url()}`)
  }
  return match[1]
}

const openCard = async (page) => {
  const sampleText = page.locator("h1")
  await sampleText.dblclick({ position: { x: 36, y: 18 } })
  const dot = page.getByTestId("translation-dot")
  await dot.waitFor({ state: "visible", timeout: 10_000 })
  await dot.hover()
  const card = page.getByTestId("translation-card")
  await card.waitFor({ state: "visible", timeout: 5_000 })
  return card
}

const selectLatestTrace = (logs) => {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const traceId = logs[index]?.payload?.traceId
    if (typeof traceId === "string" && traceId) {
      return traceId
    }
  }
  return ""
}

const findLatestMatchingLog = (logs, event, traceId, model) => {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    const entry = logs[index]
    if (entry?.event !== event) continue
    if (traceId && entry?.payload?.traceId !== traceId) continue
    const entryModel = String(entry?.payload?.model ?? "")
    if (model && entryModel && entryModel !== model) continue
    return entry
  }
  return undefined
}

const runForModel = async (model) => {
  const userDataDir = path.join(os.tmpdir(), `qwen-bench-${model}-${Date.now()}`)
  let context
  let page
  let popupPage
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
      channel: "chromium",
      headless: false
    })

    const extensionId = await getExtensionId(context)
    popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: "domcontentloaded"
    })
    await popupPage.evaluate(
      async ({ keys, flavor, key, url, activeModel }) => {
        await chrome.storage.local.set({
          [keys.providerFlavor]: flavor === "anthropic-compatible" ? "anthropic-compatible" : "openai-compatible",
          [keys.apiKey]: key,
          [keys.baseUrl]: url,
          [keys.model]: activeModel,
          [keys.debugEnabled]: true,
          [keys.debugLogs]: []
        })
      },
      { keys: STORAGE_KEYS, flavor: providerFlavor, key: apiKey, url: baseUrl, activeModel: model }
    )

    page = await context.newPage()
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" })

    const startedAt = Date.now()
    const card = await openCard(page)
    const successTextLocator = card.getByTestId("translation-success-text")
    const errorTextLocator = card.getByTestId("translation-error")
    const providerLocator = card.getByTestId("translation-provider")
    const terminalState = await Promise.race([
      providerLocator
        .waitFor({ state: "visible", timeout: 10_000 })
        .then(async () => {
          const text = (await providerLocator.textContent())?.trim() ?? ""
          if (text.startsWith("Provider:")) {
            return "success"
          }
          throw new Error("Provider label did not reach single-result success state.")
        }),
      errorTextLocator.waitFor({ state: "visible", timeout: 10_000 }).then(() => "error")
    ]).catch(() => "timeout")
    const finishedAt = Date.now()

    const logs = await popupPage.evaluate(async (keys) => {
      const values = await chrome.storage.local.get([keys.debugLogs])
      return Array.isArray(values[keys.debugLogs]) ? values[keys.debugLogs] : []
    }, STORAGE_KEYS)

    const traceId = selectLatestTrace(logs)
    const providerSuccessLog = findLatestMatchingLog(logs, "provider_response_success", traceId, model)
    const providerErrorLog = findLatestMatchingLog(logs, "provider_response_error", traceId, model)
    const requestSucceededLog = findLatestMatchingLog(logs, "request_succeeded", traceId, model)
    const requestFailedLog = findLatestMatchingLog(logs, "request_failed", traceId, model)

    const screenshotPath = path.join(outputDir, `${model.replace(/[^a-zA-Z0-9-_]/g, "_")}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })

    const translatedText =
      terminalState === "success" ? (await successTextLocator.textContent())?.trim() ?? "" : ""
    const providerLabel =
      terminalState === "success"
        ? (await card.getByTestId("translation-provider").textContent())?.trim() ?? ""
        : ""
    const errorText =
      terminalState === "error" ? (await errorTextLocator.textContent())?.trim() ?? "" : ""
    const requestUrl = String(
      providerSuccessLog?.payload?.requestUrl ??
        providerErrorLog?.payload?.requestUrl ??
        ""
    )
    const httpStatus = Number(
      providerSuccessLog?.payload?.status ?? providerErrorLog?.payload?.status ?? NaN
    )
    const requestDurationMs = Number(
      requestSucceededLog?.payload?.durationMs ??
        providerSuccessLog?.payload?.durationMs ??
        providerErrorLog?.payload?.durationMs ??
        NaN
    )
    const firstTokenMs = Number(
      providerSuccessLog?.payload?.ttfbMs ??
        providerErrorLog?.payload?.ttfbMs ??
        NaN
    )

    if (terminalState !== "success" || !translatedText) {
      const reason =
        terminalState === "error"
          ? errorText || "translation error UI shown"
          : "Timeout 10000ms exceeded waiting for success/error terminal state"
      return {
        model,
        ok: false,
        providerFlavor,
        terminalState,
        traceId,
        error: reason,
        e2eMs: finishedAt - startedAt,
        firstTokenMs,
        requestDurationMs,
        httpStatus,
        requestUrl,
        providerErrorCode: String(requestFailedLog?.payload?.code ?? ""),
        providerErrorMessage: String(requestFailedLog?.payload?.message ?? ""),
        screenshotPath
      }
    }

    return {
      model,
      ok: true,
      providerFlavor,
      traceId,
      providerLabel,
      translatedText,
      translatedLength: translatedText.length,
      e2eMs: finishedAt - startedAt,
      requestDurationMs,
      firstTokenMs,
      httpStatus,
      requestUrl,
      screenshotPath
    }
  } catch (error) {
    let screenshotPath = ""
    if (page) {
      screenshotPath = path.join(outputDir, `${model.replace(/[^a-zA-Z0-9-_]/g, "_")}-exception.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})
    }
    return {
      model,
      ok: false,
      providerFlavor,
      error: error instanceof Error ? error.message : String(error),
      screenshotPath
    }
  } finally {
    if (context) await context.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
}

const runCurlConnectivity = (model) => {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`
  const payload = {
    model,
    messages: [{ role: "user", content: "hello" }],
    translation_options: {
      source_lang: "auto",
      target_lang: "Chinese"
    }
  }

  const curlArgs = [
    "-sS",
    "--max-time",
    "10",
    "-X",
    "POST",
    endpoint,
    "-H",
    `Authorization: Bearer ${apiKey}`,
    "-H",
    "Content-Type: application/json",
    "-d",
    JSON.stringify(payload),
    "-w",
    "\n__CURL_META__ %{http_code} %{time_connect} %{time_starttransfer} %{time_total}",
  ]

  const started = Date.now()
  const result = spawnSync("curl", curlArgs, {
    encoding: "utf8",
    env: process.env
  })
  const finished = Date.now()
  const stdout = result.stdout ?? ""
  const stderr = result.stderr ?? ""
  const metaLine = stdout
    .split(/\r?\n/)
    .find((line) => line.startsWith("__CURL_META__ "))
  const body = stdout.replace(/\n__CURL_META__.*$/s, "").trim()
  const [, httpCodeRaw = "", connectRaw = "", ttfbRaw = "", totalRaw = ""] =
    metaLine?.match(/^__CURL_META__\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/) ?? []
  const httpCode = Number(httpCodeRaw)
  const connectMs = Number(connectRaw) * 1000
  const firstTokenMs = Number(ttfbRaw) * 1000
  const totalMs = Number(totalRaw) * 1000

  let parsed
  try {
    parsed = body ? JSON.parse(body) : null
  } catch {
    parsed = null
  }

  const providerErrorMessage =
    parsed?.error?.message ??
    parsed?.error ??
    stderr.trim() ??
    ""
  const ok = result.status === 0 && httpCode === 200
  return {
    model,
    ok,
    endpoint,
    httpCode: Number.isFinite(httpCode) ? httpCode : null,
    connectMs: Number.isFinite(connectMs) ? Math.round(connectMs) : null,
    firstTokenMs: Number.isFinite(firstTokenMs) ? Math.round(firstTokenMs) : null,
    totalMs: Number.isFinite(totalMs) ? Math.round(totalMs) : null,
    elapsedMs: finished - started,
    providerErrorMessage: String(providerErrorMessage).slice(0, 400),
    responsePreview: body.slice(0, 500)
  }
}

const run = async () => {
  const buildResult = spawnSync("npm", ["run", "build"], {
    stdio: "inherit",
    env: process.env
  })
  if (buildResult.status !== 0) {
    console.error("BLOCKED: npm run build failed. Skipping benchmark.")
    process.exit(buildResult.status ?? 1)
  }

  if (!existsSync(extensionPath)) {
    console.error("BLOCKED: missing extension build at build/chrome-mv3-prod. Run `npm run build` first.")
    process.exit(1)
  }

  const startedAt = new Date().toISOString()

  const curlConnectivityResults = models.map((model) => runCurlConnectivity(model))
  const curlReport = {
    generatedAt: new Date().toISOString(),
    startedAt,
    providerFlavor,
    baseUrl,
    models,
    summary: {
      total: curlConnectivityResults.length,
      passed: curlConnectivityResults.filter((item) => item.ok).length,
      failed: curlConnectivityResults.filter((item) => !item.ok).length
    },
    results: curlConnectivityResults
  }
  const curlJsonPath = path.join(reportsDir, `qwen-curl-connectivity-${stamp}.json`)
  const curlLatestJsonPath = path.join(reportsDir, "qwen-curl-connectivity-latest.json")
  writeFileSync(curlJsonPath, `${JSON.stringify(curlReport, null, 2)}\n`, "utf8")
  writeFileSync(curlLatestJsonPath, `${JSON.stringify(curlReport, null, 2)}\n`, "utf8")

  const curlMd = [
    "# Qwen Curl Connectivity",
    "",
    `- Generated: ${curlReport.generatedAt}`,
    `- Provider flavor: ${providerFlavor}`,
    `- Base URL: ${baseUrl}`,
    "",
    `- Total models: ${curlReport.summary.total}`,
    `- Passed: ${curlReport.summary.passed}`,
    `- Failed: ${curlReport.summary.failed}`,
    "",
    "| Model | Status | HTTP | Connect(ms) | FirstToken(ms) | Total(ms) | Error |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...curlConnectivityResults.map((item) =>
      `| ${item.model} | ${item.ok ? "PASS" : "FAIL"} | ${item.httpCode ?? "-"} | ${item.connectMs ?? "-"} | ${item.firstTokenMs ?? "-"} | ${item.totalMs ?? "-"} | ${item.ok ? "-" : (item.providerErrorMessage || "-").replace(/\|/g, "/")} |`
    ),
    ""
  ].join("\n")
  const curlMdPath = path.join(reportsDir, `qwen-curl-connectivity-${stamp}.md`)
  const curlLatestMdPath = path.join(reportsDir, "qwen-curl-connectivity-latest.md")
  writeFileSync(curlMdPath, curlMd, "utf8")
  writeFileSync(curlLatestMdPath, curlMd, "utf8")

  if (curlReport.summary.failed > 0) {
    console.error("CURL connectivity gate failed. Skipping E2E benchmark.")
    console.error(`Connectivity report written: ${curlJsonPath}`)
    process.exit(1)
  }

  const results = []
  for (const model of models) {
    // Run models sequentially to avoid rate-limit interference.
    // eslint-disable-next-line no-await-in-loop
    const result = await runForModel(model)
    results.push(result)
    const mark = result.ok ? "PASS" : "FAIL"
    console.log(`[${mark}] ${model}`, result.ok ? `${result.e2eMs}ms` : result.error)
  }

  const successful = results.filter((item) => item.ok)
  const average = (list, key) => {
    const values = list.map((item) => Number(item[key])).filter((v) => Number.isFinite(v))
    if (!values.length) return null
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  }
  const sortedBy = (list, key) =>
    list
      .map((item) => Number(item[key]))
      .filter((v) => Number.isFinite(v))
      .sort((a, b) => a - b)
  const p95 = (list, key) => {
    const values = sortedBy(list, key)
    if (!values.length) return null
    const idx = Math.min(values.length - 1, Math.ceil(values.length * 0.95) - 1)
    return Math.round(values[idx])
  }

  const report = {
    generatedAt: new Date().toISOString(),
    startedAt,
    providerFlavor,
    baseUrl,
    models,
    summary: {
      total: results.length,
      passed: successful.length,
      failed: results.length - successful.length,
      avgE2eMs: average(successful, "e2eMs"),
      avgFirstTokenMs: average(successful, "firstTokenMs"),
      p95E2eMs: p95(successful, "e2eMs"),
      p95FirstTokenMs: p95(successful, "firstTokenMs")
    },
    results
  }

  const jsonPath = path.join(reportsDir, `qwen-e2e-benchmark-${stamp}.json`)
  const latestJsonPath = path.join(reportsDir, "qwen-e2e-benchmark-latest.json")
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")
  writeFileSync(latestJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  const mdRows = results.map((item) => {
    if (!item.ok) {
      return `| ${item.model} | FAIL | - | ${item.e2eMs ?? "-"} | ${Number.isFinite(item.firstTokenMs) ? item.firstTokenMs : "-"} | ${Number.isFinite(item.requestDurationMs) ? item.requestDurationMs : "-"} | ${item.screenshotPath || "-"} | ${item.error.replace(/\|/g, "/")} |`
    }
    return `| ${item.model} | PASS | ${item.translatedText} | ${item.e2eMs} | ${Number.isFinite(item.firstTokenMs) ? item.firstTokenMs : "-"} | ${Number.isFinite(item.requestDurationMs) ? item.requestDurationMs : "-"} | ${item.screenshotPath} | - |`
  })
  const md = [
    "# Qwen E2E Benchmark",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Provider flavor: ${providerFlavor}`,
    `- Base URL: ${baseUrl}`,
    "",
    "## Summary",
    "",
    `- Total models: ${report.summary.total}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Avg E2E ms: ${report.summary.avgE2eMs ?? "-"}`,
    `- Avg first token ms: ${report.summary.avgFirstTokenMs ?? "-"}`,
    `- P95 E2E ms: ${report.summary.p95E2eMs ?? "-"}`,
    `- P95 first token ms: ${report.summary.p95FirstTokenMs ?? "-"}`,
    "",
    "## Per Model",
    "",
    "| Model | Status | Translation | E2E(ms) | FirstToken(ms) | Request(ms) | Screenshot | Failure Reason |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...mdRows,
    ""
  ].join("\n")
  const mdPath = path.join(reportsDir, `qwen-e2e-benchmark-${stamp}.md`)
  const latestMdPath = path.join(reportsDir, "qwen-e2e-benchmark-latest.md")
  writeFileSync(mdPath, md, "utf8")
  writeFileSync(latestMdPath, md, "utf8")

  console.log(`Benchmark report written: ${jsonPath}`)
  console.log(`Benchmark summary written: ${mdPath}`)
  console.log(`Connectivity report written: ${curlJsonPath}`)

  if (report.summary.failed > 0) {
    process.exitCode = 1
  }
}

void run()
