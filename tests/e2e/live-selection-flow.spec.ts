import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type TestInfo
} from "@playwright/test"
import { TRANSLATION_STORAGE_KEYS, type TranslationDebugLogEntry } from "../../lib/translation-settings"

const repoRoot = process.cwd()
const extensionPath = path.join(repoRoot, "build/chrome-mv3-prod")
const envLocalPath = path.join(repoRoot, ".env.local")
const isLiveEnabled = process.env.RUN_LIVE_E2E === "1"

const FLASH_SAMPLE_WORD = "performance"
const SENTENCE_SAMPLE_TEXT = "I use performance testing to validate the real translation flow."

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

const readLiveConfig = () => {
  const fromFile = existsSync(envLocalPath) ? parseDotEnv(readFileSync(envLocalPath, "utf8")) : {}
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = (process.env[key] ?? fromFile[key] ?? "").trim()
      if (value) {
        return value
      }
    }
    return ""
  }

  return {
    LLM_PROVIDER_FLAVOR:
      pick("QWEN_PROVIDER_FLAVOR", "LLM_PROVIDER_FLAVOR", "PLASMO_PUBLIC_LLM_PROVIDER_FLAVOR") ||
      "openai-compatible",
    LLM_API_KEY: pick("QWEN_API_KEY", "LLM_API_KEY", "PLASMO_PUBLIC_LLM_API_KEY"),
    LLM_BASE_URL: pick("QWEN_BASE_URL", "LLM_BASE_URL", "PLASMO_PUBLIC_LLM_BASE_URL"),
    LLM_MODEL: "qwen-mt-flash"
  }
}

const openWordCard = async (page: Page) => {
  const sampleText = page.locator("h1")
  await sampleText.dblclick({ position: { x: 36, y: 18 } })

  const dot = page.getByTestId("translation-dot")
  await dot.waitFor({ state: "visible", timeout: 10_000 })
  await dot.hover()

  const card = page.getByTestId("translation-card")
  await card.waitFor({ state: "visible", timeout: 5_000 })
  return card
}

const openSentenceCard = async (page: Page) => {
  await page.locator("p").first().evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
  })

  const dot = page.getByTestId("translation-dot")
  await dot.waitFor({ state: "visible", timeout: 10_000 })
  await dot.hover()

  const card = page.getByTestId("translation-card")
  await card.waitFor({ state: "visible", timeout: 5_000 })
  return card
}

const attachScreenshot = async (page: Page, testInfo: TestInfo, name: string) => {
  const screenshotPath = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await testInfo.attach(name, {
    path: screenshotPath,
    contentType: "image/png"
  })
}

const getExtensionId = async (context: BrowserContext) => {
  const currentWorkers = context.serviceWorkers()
  const worker = currentWorkers[0] ?? (await context.waitForEvent("serviceworker"))
  const match = worker.url().match(/^chrome-extension:\/\/([a-z]{32})\//)
  if (!match) {
    throw new Error(`Unable to parse extension id from service worker URL: ${worker.url()}`)
  }
  return match[1]
}

const seedLiveProviderStorage = async (
  context: BrowserContext,
  config: {
    LLM_PROVIDER_FLAVOR: string
    LLM_API_KEY: string
    LLM_BASE_URL: string
    LLM_MODEL: string
  }
) => {
  const extensionId = await getExtensionId(context)
  const popupPage = await context.newPage()
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: "domcontentloaded"
  })
  await popupPage.evaluate(async ({ keys, liveConfig }) => {
    await chrome.storage.local.set({
      [keys.profileId]: "qwen-flash-card",
      [keys.providerFlavor]:
        liveConfig.LLM_PROVIDER_FLAVOR === "anthropic-compatible"
          ? "anthropic-compatible"
          : "openai-compatible",
      [keys.apiKey]: liveConfig.LLM_API_KEY,
      [keys.baseUrl]: liveConfig.LLM_BASE_URL,
      [keys.model]: liveConfig.LLM_MODEL,
      [keys.debugEnabled]: true,
      [keys.debugLogs]: []
    })
  }, { keys: TRANSLATION_STORAGE_KEYS, liveConfig: config })
  await popupPage.close()
  return extensionId
}

const setLiveFixturePage = async (page: Page) => {
  await page.goto("https://example.com", { waitUntil: "domcontentloaded" })
  await page.evaluate(
    ({ flashWord, sentenceText }) => {
      document.body.innerHTML = `
        <main style="padding: 48px; font-family: Arial, sans-serif;">
          <h1 style="font-size: 32px; line-height: 1.2; margin: 0 0 18px;">${flashWord}</h1>
          <p style="font-size: 18px; line-height: 1.6; max-width: 680px; margin: 0;">${sentenceText}</p>
        </main>
      `
    },
    { flashWord: FLASH_SAMPLE_WORD, sentenceText: SENTENCE_SAMPLE_TEXT }
  )
}

const getPopupLogs = async (context: BrowserContext, extensionId: string) => {
  const popupPage = await context.newPage()
  await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
    waitUntil: "domcontentloaded"
  })
  const logs = await popupPage.evaluate(async (keys) => {
    const values = await chrome.storage.local.get([keys.debugLogs])
    const rawLogs = values[keys.debugLogs]
    return Array.isArray(rawLogs) ? rawLogs : []
  }, TRANSLATION_STORAGE_KEYS)
  await popupPage.close()
  return logs as TranslationDebugLogEntry[]
}

const waitForPopupLogs = async (
  context: BrowserContext,
  extensionId: string,
  predicate: (logs: TranslationDebugLogEntry[]) => boolean,
  timeoutMs = 15_000
) => {
  const startedAt = Date.now()
  let lastLogs: TranslationDebugLogEntry[] = []

  while (Date.now() - startedAt < timeoutMs) {
    lastLogs = await getPopupLogs(context, extensionId)
    if (predicate(lastLogs)) {
      return lastLogs
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  const eventSummary = lastLogs.map((entry) => entry.event).join(", ")
  throw new Error(`Timed out waiting for live popup logs. Recent events: ${eventSummary || "<none>"}`)
}

const assertLiveSuccessLogs = async (
  context: BrowserContext,
  extensionId: string,
  config: {
    baseUrl: string
    model: string
  }
) => {
  const logs = await waitForPopupLogs(
    context,
    extensionId,
    (entries) =>
      entries.some((entry) => entry.event === "provider_response_success") &&
      entries.some((entry) => entry.event === "request_succeeded")
  )

  const providerSuccess = logs.find((entry) => entry.event === "provider_response_success")
  const requestSuccess = logs.find((entry) => entry.event === "request_succeeded")
  const errorEvents = logs.filter(
    (entry) => entry.event === "provider_response_error" || entry.event === "request_failed"
  )
  const providerPreview = String(
    providerSuccess?.payload?.responseTextPreview ?? providerSuccess?.payload?.translatedPreview ?? ""
  )
  const requestPreview = String(requestSuccess?.payload?.translatedPreview ?? "")

  expect(errorEvents, "Live flow should not emit provider/runtime failure events.").toHaveLength(0)
  expect(providerSuccess?.payload?.status).toBe(200)
  expect(String(providerSuccess?.payload?.model ?? "")).toBe(config.model)
  expect(String(providerSuccess?.payload?.requestUrl ?? "")).toContain(config.baseUrl)
  expect(providerPreview.trim().length).toBeGreaterThan(0)
  expect(String(requestSuccess?.payload?.model ?? "")).toBe(config.model)
  expect(String(requestSuccess?.payload?.provider ?? "")).toBe("openai_compatible")
  expect(requestPreview.trim().length).toBeGreaterThan(0)

  return logs
}

test.describe("live translation provider flows", () => {
  test.skip(!isLiveEnabled, "Live E2E is disabled. Set RUN_LIVE_E2E=1 to run this spec.")

  test("word selection returns real flash-card content and success logs", async ({}, testInfo) => {
    const liveConfig = readLiveConfig()
    expect(
      liveConfig.LLM_API_KEY,
      "BLOCKED: missing live API key in process env or .env.local"
    ).not.toEqual("")
    expect(
      liveConfig.LLM_BASE_URL,
      "BLOCKED: missing live base URL in process env or .env.local"
    ).not.toEqual("")

    if (!existsSync(extensionPath)) {
      throw new Error("Missing extension build at build/chrome-mv3-prod. Run `npm run build` first.")
    }

    const userDataDir = mkdtempSync(path.join(os.tmpdir(), "translation-plugin-e2e-live-word-"))
    const context = await chromium.launchPersistentContext(userDataDir, {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ],
      channel: "chromium",
      headless: false
    })

    try {
      const extensionId = await seedLiveProviderStorage(context, liveConfig)
      const page = await context.newPage()
      await setLiveFixturePage(page)

      const card = await openWordCard(page)
      const phoneticText = card.getByTestId("translation-line-phonetic")
      const meaningText = card.getByTestId("translation-line-meaning")
      const exampleText = card.getByTestId("translation-line-example")
      const providerText = card.getByTestId("translation-provider")

      await expect(phoneticText).toBeVisible({ timeout: 10_000 })
      await expect(phoneticText).toHaveText(/\S+/, { timeout: 10_000 })
      await expect(meaningText).toBeVisible({ timeout: 10_000 })
      await expect(meaningText).toHaveText(/\S+/, { timeout: 10_000 })
      await expect(meaningText).not.toHaveText(FLASH_SAMPLE_WORD, { timeout: 10_000 })
      await expect(exampleText).toBeVisible({ timeout: 10_000 })
      await expect(exampleText).toHaveText(/\S+/, { timeout: 10_000 })
      await expect(exampleText).toContainText(FLASH_SAMPLE_WORD, { timeout: 10_000 })
      await expect(providerText).toContainText("Model: qwen-mt-flash")

      await assertLiveSuccessLogs(context, extensionId, {
        baseUrl: liveConfig.LLM_BASE_URL,
        model: "qwen-mt-flash"
      })

      await attachScreenshot(page, testInfo, "e2e-live-word-success")
    } finally {
      await context.close()
      rmSync(userDataDir, { recursive: true, force: true })
    }
  })

  test("sentence selection returns real plain translation and success logs", async ({}, testInfo) => {
    const liveConfig = readLiveConfig()
    expect(
      liveConfig.LLM_API_KEY,
      "BLOCKED: missing live API key in process env or .env.local"
    ).not.toEqual("")
    expect(
      liveConfig.LLM_BASE_URL,
      "BLOCKED: missing live base URL in process env or .env.local"
    ).not.toEqual("")

    if (!existsSync(extensionPath)) {
      throw new Error("Missing extension build at build/chrome-mv3-prod. Run `npm run build` first.")
    }

    const userDataDir = mkdtempSync(path.join(os.tmpdir(), "translation-plugin-e2e-live-sentence-"))
    const context = await chromium.launchPersistentContext(userDataDir, {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ],
      channel: "chromium",
      headless: false
    })

    try {
      const extensionId = await seedLiveProviderStorage(context, liveConfig)
      const page = await context.newPage()
      await setLiveFixturePage(page)

      const card = await openSentenceCard(page)
      const meaningText = card.getByTestId("translation-line-meaning")
      const providerText = card.getByTestId("translation-provider")

      await expect(meaningText).toBeVisible({ timeout: 10_000 })
      await expect(meaningText).toHaveText(/\S+/, { timeout: 10_000 })
      await expect(meaningText).not.toHaveText(SENTENCE_SAMPLE_TEXT, { timeout: 10_000 })
      await expect(card.getByTestId("translation-line-phonetic")).toHaveCount(0)
      await expect(card.getByTestId("translation-line-example")).toHaveCount(0)
      await expect(providerText).toContainText("Model: qwen-mt-flash")

      await assertLiveSuccessLogs(context, extensionId, {
        baseUrl: liveConfig.LLM_BASE_URL,
        model: "qwen-mt-flash"
      })

      await attachScreenshot(page, testInfo, "e2e-live-sentence-success")
    } finally {
      await context.close()
      rmSync(userDataDir, { recursive: true, force: true })
    }
  })
})
