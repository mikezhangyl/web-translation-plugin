import { existsSync, mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { chromium, expect, test } from "@playwright/test"

const repoRoot = process.cwd()
const extensionPath = path.join(repoRoot, "build/chrome-mv3-prod")

test("selection dot and hover card flow", async () => {
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

    const sampleText = page.locator("h1")
    await sampleText.dblclick({ position: { x: 36, y: 18 } })

    const dot = page.getByTestId("translation-dot")
    await dot.waitFor({ state: "visible", timeout: 10_000 })
    await dot.hover()

    const card = page.getByTestId("translation-card")
    await card.waitFor({ state: "visible", timeout: 5_000 })
    await expect(card.getByText("Free Translation Service")).toBeVisible()

    await page.keyboard.press("Escape")
    await card.waitFor({ state: "hidden", timeout: 5_000 })
  } finally {
    await context.close()
    rmSync(userDataDir, { recursive: true, force: true })
  }
})
