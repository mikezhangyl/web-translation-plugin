import { existsSync, mkdtempSync, rmSync } from "node:fs"
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

const attachScreenshot = async (
  page: Page,
  testInfo: TestInfo,
  name: string
) => {
  const screenshotPath = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await testInfo.attach(name, {
    path: screenshotPath,
    contentType: "image/png"
  })
}

const setE2EMode = async (
  page: Page,
  mode: "openai_success" | "anthropic_success" | "provider_fail"
) => {
  await page.evaluate((nextMode) => {
    document.documentElement.setAttribute("data-translation-e2e-mode", nextMode)
  }, mode)
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

const runWithExtension = async (
  run: (args: {
    context: BrowserContext
    page: Page
  }) => Promise<void>
) => {
  if (!existsSync(extensionPath)) {
    throw new Error("Missing extension build at build/chrome-mv3-prod. Run `npm run build` first.")
  }

  const userDataDir = mkdtempSync(path.join(os.tmpdir(), "translation-plugin-e2e-"))
  const context = await chromium.launchPersistentContext(userDataDir, {
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ],
    channel: "chromium",
    headless: false
  })

  try {
    const page = await context.newPage()
    await page.goto("https://example.com", { waitUntil: "domcontentloaded" })
    await run({ context, page })
  } finally {
    await context.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
}

test("selection flow shows openai-compatible success", async ({}, testInfo) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "openai_success")
    const card = await openCard(page)
    await expect(card.getByTestId("translation-success-text")).toHaveText("黑曜石（OpenAI）")
    await expect(card.getByTestId("translation-provider")).toHaveText("Provider: openai_compatible")
    await attachScreenshot(page, testInfo, "e2e-openai-success")
  })
})

test("selection flow shows anthropic-compatible success", async ({}, testInfo) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "anthropic_success")
    const card = await openCard(page)
    await expect(card.getByTestId("translation-success-text")).toHaveText("黑曜石（Anthropic）")
    await expect(card.getByTestId("translation-provider")).toHaveText("Provider: anthropic_compatible")
    await attachScreenshot(page, testInfo, "e2e-anthropic-success")
  })
})

test("selection flow shows error when configured provider fails", async ({}, testInfo) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "provider_fail")
    const card = await openCard(page)
    await expect(card.getByTestId("translation-error")).toContainText("Translation unavailable")
    await expect(card.getByTestId("translation-placeholder")).toBeVisible()
    await attachScreenshot(page, testInfo, "e2e-provider-fail")
  })
})

test("popup troubleshooting panel shows llm interaction logs with timing", async ({}, testInfo) => {
  await runWithExtension(async ({ context, page }) => {
    await setE2EMode(page, "openai_success")
    await openCard(page)

    const extensionId = await getExtensionId(context)
    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: "domcontentloaded"
    })

    await page.bringToFront()
    await page.keyboard.press("Escape")
    await setE2EMode(page, "openai_success")
    const secondCard = await openCard(page)
    await expect(secondCard.getByTestId("translation-success-text")).toHaveText("黑曜石（OpenAI）")

    await popupPage.bringToFront()
    await expect(
      popupPage.getByRole("heading", { name: "LLM Interaction Logs" })
    ).toBeVisible()
    await popupPage.getByRole("button", { name: "Refresh Logs" }).click()
    await popupPage.waitForFunction(
      async (logsKey) => {
        const values = await chrome.storage.local.get([logsKey])
        const logs = values[logsKey]
        return (
          Array.isArray(logs) &&
          logs.some(
            (entry) =>
              entry?.event === "request_succeeded" &&
              typeof entry?.payload?.durationMs === "number" &&
              typeof entry?.payload?.translatedPreview === "string"
          )
        )
      },
      TRANSLATION_STORAGE_KEYS.debugLogs,
      { timeout: 10_000 }
    )

    await popupPage.getByRole("button", { name: "Refresh Logs" }).click()
    const logOutput = popupPage.getByTestId("troubleshooting-log-output")
    await expect(logOutput).toContainText("request_succeeded")
    await expect(logOutput).toContainText("durationMs")
    await expect(logOutput).toContainText("translatedPreview")

    await attachScreenshot(popupPage, testInfo, "e2e-popup-troubleshooting-logs")
    await popupPage.close()
  })
})
