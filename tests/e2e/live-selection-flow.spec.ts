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
import { TRANSLATION_STORAGE_KEYS } from "../../lib/translation-settings"

const repoRoot = process.cwd()
const extensionPath = path.join(repoRoot, "build/chrome-mv3-prod")
const envLocalPath = path.join(repoRoot, ".env.local")
const isLiveEnabled = process.env.RUN_LIVE_E2E === "1"

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
  const pick = (key: string) => (process.env[key] ?? fromFile[key] ?? "").trim()
  return {
    LLM_PROVIDER_FLAVOR: pick("QWEN_PROVIDER_FLAVOR") || "openai-compatible",
    LLM_API_KEY: pick("QWEN_API_KEY"),
    LLM_BASE_URL: pick("QWEN_BASE_URL"),
    LLM_MODEL: "qwen-mt-flash"
  }
}

const openCard = async (page: Page) => {
  const sampleText = page.locator("h1")
  await sampleText.dblclick({ position: { x: 36, y: 18 } })

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
      [keys.model]: liveConfig.LLM_MODEL
    })
  }, { keys: TRANSLATION_STORAGE_KEYS, liveConfig: config })
  await popupPage.close()
}

test("selection flow live provider returns flash card content", async ({}, testInfo) => {
  test.skip(!isLiveEnabled, "Live E2E is disabled. Set RUN_LIVE_E2E=1 to run this spec.")

  const liveConfig = readLiveConfig()
  expect(
    liveConfig.LLM_API_KEY,
    "BLOCKED: missing LLM_API_KEY in process env or .env.local"
  ).not.toEqual("")
  expect(
    liveConfig.LLM_BASE_URL,
    "BLOCKED: missing LLM_BASE_URL in process env or .env.local"
  ).not.toEqual("")
  expect(
    liveConfig.LLM_MODEL,
    "BLOCKED: missing LLM_MODEL in process env or .env.local"
  ).not.toEqual("")

  if (!existsSync(extensionPath)) {
    throw new Error("Missing extension build at build/chrome-mv3-prod. Run `npm run build` first.")
  }

  const userDataDir = mkdtempSync(path.join(os.tmpdir(), "translation-plugin-e2e-live-"))
  const context = await chromium.launchPersistentContext(userDataDir, {
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    channel: "chromium",
    headless: false
  })

  try {
    await seedLiveProviderStorage(context, liveConfig)
    const page = await context.newPage()
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" })
    await page.evaluate(() => {
      document.body.innerHTML = "<main><h1>performance</h1></main>"
    })

    const card = await openCard(page)
    const phoneticText = card.getByTestId("translation-line-phonetic")
    const meaningText = card.getByTestId("translation-line-meaning")
    const exampleText = card.getByTestId("translation-line-example")
    const providerText = card.getByTestId("translation-provider")
    await expect(phoneticText).toBeVisible({ timeout: 10_000 })
    await expect(phoneticText).toHaveText(/\S+/, { timeout: 10_000 })
    await expect(meaningText).toBeVisible({ timeout: 10_000 })
    await expect(meaningText).toHaveText(/\S+/, { timeout: 10_000 })
    await expect(exampleText).toBeVisible({ timeout: 10_000 })
    await expect(exampleText).toHaveText(/\S+/, { timeout: 10_000 })
    await expect(providerText).toContainText("Model: qwen-mt-flash")

    await attachScreenshot(page, testInfo, "e2e-live-success")
  } finally {
    await context.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
})
