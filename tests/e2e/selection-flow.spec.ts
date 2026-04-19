import { existsSync, mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { chromium, expect, test, type BrowserContext, type Page } from "@playwright/test"

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

const setE2EMode = async (
  page: Page,
  mode: "azure_success" | "azure_rate_limit_then_deepl_success" | "dual_fail"
) => {
  await page.evaluate((nextMode) => {
    document.documentElement.setAttribute("data-translation-e2e-mode", nextMode)
  }, mode)
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

test("selection flow shows loading and azure success", async () => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "azure_success")
    const card = await openCard(page)
    await expect(card.getByTestId("translation-loading")).toBeAttached()
    await expect(card.getByTestId("translation-success-text")).toHaveText("黑曜石（Azure）")
    await expect(card.getByTestId("translation-provider")).toHaveText("Provider: azure")
  })
})

test("selection flow falls back to deepl when azure is rate-limited", async () => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "azure_rate_limit_then_deepl_success")
    const card = await openCard(page)
    await expect(card.getByTestId("translation-success-text")).toHaveText("黑曜石（DeepL）")
    await expect(card.getByTestId("translation-provider")).toHaveText("Provider: deepl (fallback)")
  })
})

test("selection flow shows error when both providers fail", async () => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "dual_fail")
    const card = await openCard(page)
    await expect(card.getByTestId("translation-error")).toContainText("Translation unavailable")
    await expect(card.getByTestId("translation-placeholder")).toBeVisible()
  })
})
