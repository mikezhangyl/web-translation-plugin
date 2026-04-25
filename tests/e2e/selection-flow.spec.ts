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
import { VOCABULARY_STORAGE_KEY, type VocabularyEntry } from "../../lib/vocabulary-history"

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
    await expect(card.getByTestId("translation-line-phonetic")).toHaveText("/əbˈsɪdiən/")
    await expect(card.getByTestId("translation-line-meaning")).toHaveText("黑曜石（OpenAI）")
    await expect(card.getByTestId("translation-line-example")).toContainText("Obsidian helps me organize my notes.")
    await expect(card.getByTestId("translation-provider")).toContainText("Provider: openai_compatible")
    await expect(card.getByTestId("translation-provider")).toContainText("Model: qwen-mt-flash")
    await attachScreenshot(page, testInfo, "e2e-openai-success")
  })
})

test("flash-card vocabulary can be saved, sorted, and deleted from the popup", async ({}) => {
  await runWithExtension(async ({ context, page }) => {
    await setE2EMode(page, "openai_success")
    const card = await openCard(page)
    await expect(card.getByTestId("translation-line-meaning")).toHaveText("黑曜石（OpenAI）")

    await card.getByTestId("save-vocabulary-entry").click()
    await expect(card.getByTestId("save-vocabulary-entry")).toContainText("Saved to notebook")

    const extensionId = await getExtensionId(context)
    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: "domcontentloaded"
    })

    const seededEntry: VocabularyEntry = {
      id: "seed-apple",
      sourceText: "Apple",
      normalizedText: "apple",
      translation: "苹果",
      phonetic: "/ˈæpəl/",
      explanation: "a common fruit",
      example: "She packed an apple for class.",
      selectionType: "word",
      createdAt: "2026-04-24T07:00:00.000Z",
      updatedAt: "2026-04-24T07:00:00.000Z"
    }
    await popupPage.evaluate(
      async ({ storageKey, entry }) => {
        const values = await chrome.storage.local.get([storageKey])
        const entries = Array.isArray(values[storageKey]) ? values[storageKey] : []
        await chrome.storage.local.set({
          [storageKey]: [...entries, entry]
        })
      },
      { storageKey: VOCABULARY_STORAGE_KEY, entry: seededEntry }
    )
    await popupPage.getByRole("button", { name: "Refresh", exact: true }).click()

    await expect(popupPage.getByRole("heading", { name: "My Vocabulary" })).toBeVisible()
    const vocabularyList = popupPage.getByTestId("vocabulary-list")
    await expect(vocabularyList.getByTestId("vocabulary-entry-text").filter({ hasText: "Example" })).toBeVisible()
    await expect(vocabularyList.getByText("/əbˈsɪdiən/")).toBeVisible()
    await expect(vocabularyList.getByText("黑曜石（OpenAI）")).toBeVisible()

    await popupPage.getByTestId("vocabulary-sort-order").selectOption("az")
    await expect(popupPage.getByTestId("vocabulary-entry-text").first()).toHaveText("Apple")

    await popupPage.getByRole("button", { name: "Delete Example" }).click()
    await expect(vocabularyList.getByTestId("vocabulary-entry-text").filter({ hasText: "Example" })).toHaveCount(0)

    await popupPage.getByRole("button", { name: "Delete Apple" }).click()
    await expect(popupPage.getByTestId("vocabulary-empty-state")).toBeVisible()
    await popupPage.close()
  })
})

test("selection flow still shows marker when host page hides native buttons", async ({}) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "openai_success")
    await page.addStyleTag({
      content: "button { display: none !important; visibility: hidden !important; }"
    })

    const card = await openCard(page)
    const dot = page.getByTestId("translation-dot")
    await expect(dot).toBeVisible()
    await expect(card).toBeVisible()
  })
})

test("selection flow shows anthropic-compatible success", async ({}, testInfo) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "anthropic_success")
    const card = await openCard(page)
    await expect(card.getByTestId("translation-line-phonetic")).toHaveText("/əbˈsɪdiən/")
    await expect(card.getByTestId("translation-line-meaning")).toHaveText("黑曜石（Anthropic）")
    await expect(card.getByTestId("translation-line-example")).toContainText("Obsidian helps me organize my notes.")
    await expect(card.getByTestId("translation-provider")).toContainText("Provider: anthropic_compatible")
    await attachScreenshot(page, testInfo, "e2e-anthropic-success")
  })
})

test("selection flow shows sentence translation without phonetic or example", async ({}, testInfo) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "openai_success")
    const card = await openSentenceCard(page)
    await expect(card.getByTestId("translation-line-meaning")).toHaveText("这是一句用于 OpenAI 模拟测试的中文译文。")
    await expect(card.getByTestId("translation-line-phonetic")).toHaveCount(0)
    await expect(card.getByTestId("translation-line-example")).toHaveCount(0)
    await expect(card.getByTestId("translation-risk-notice")).toBeVisible()
    await expect(card.getByTestId("translation-risk-notice")).toContainText("可能存在特殊表达")
    await attachScreenshot(page, testInfo, "e2e-openai-sentence-success")
  })
})

test("selection flow shows a guidance card for oversized paragraph selections without sending a request", async ({}) => {
  await runWithExtension(async ({ context, page }) => {
    const extensionId = await getExtensionId(context)
    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: "domcontentloaded"
    })
    await popupPage.evaluate(async (keys) => {
      await chrome.storage.local.set({
        [keys.debugEnabled]: true,
        [keys.debugLogs]: []
      })
    }, TRANSLATION_STORAGE_KEYS)
    await popupPage.close()

    const longParagraph = Array.from({ length: 251 }, (_, index) => `word${index}`).join(" ")
    await page.evaluate((paragraphText) => {
      document.body.innerHTML = `
        <main style="padding: 48px; font-family: Arial, sans-serif;">
          <h1 style="font-size: 32px; line-height: 1.2; margin: 0 0 18px;">Obsidian</h1>
          <p style="font-size: 18px; line-height: 1.6; max-width: 680px; margin: 0;">${paragraphText}</p>
        </main>
      `
    }, longParagraph)

    const card = await openSentenceCard(page)
    await expect(card.getByTestId("translation-selection-notice-title")).toHaveText("Selection needs trimming")
    await expect(card.getByTestId("translation-selection-notice-message")).toContainText(
      "single paragraph up to 250 words or 1500 characters"
    )
    await expect(card.getByTestId("translation-loading")).toHaveCount(0)
    await expect(card.getByTestId("translation-error")).toHaveCount(0)

    const inspectPopup = await context.newPage()
    await inspectPopup.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: "domcontentloaded"
    })
    const logSummary = await inspectPopup.evaluate(async (keys) => {
      const values = await chrome.storage.local.get([keys.debugLogs])
      const logs = Array.isArray(values[keys.debugLogs]) ? values[keys.debugLogs] : []
      return {
        rejectedReasons: logs
          .filter((entry) => entry?.event === "ui_selection_rejected")
          .map((entry) => String(entry?.payload?.reason ?? "")),
        requestReceivedCount: logs.filter((entry) => entry?.event === "request_received").length
      }
    }, TRANSLATION_STORAGE_KEYS)
    await inspectPopup.close()

    await expect(logSummary.rejectedReasons).toContain("too_long")
    await expect(logSummary.requestReceivedCount).toBe(0)
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

test("translation card remains open after mouse leaves dot/card area", async ({}) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "openai_success")
    const card = await openCard(page)
    await page.mouse.move(2, 2)
    await expect(card).toBeVisible()
  })
})

test("translation card closes when clicking outside", async ({}) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "openai_success")
    const card = await openCard(page)
    await expect(card).toBeVisible()
    await page.mouse.click(5, 5)
    await expect(card).toBeHidden()
  })
})

test("translation card closes with X button", async ({}) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "openai_success")
    const card = await openCard(page)
    await expect(card).toBeVisible()
    await card.getByRole("button", { name: "Close translation card" }).click()
    await expect(card).toBeHidden()
  })
})

test("translation card closes with Escape", async ({}) => {
  await runWithExtension(async ({ page }) => {
    await setE2EMode(page, "openai_success")
    const card = await openCard(page)
    await expect(card).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(card).toBeHidden()
  })
})

test("re-selecting same word uses cache and avoids duplicate runtime request", async ({}) => {
  await runWithExtension(async ({ context, page }) => {
    await setE2EMode(page, "openai_success")

    const extensionId = await getExtensionId(context)
    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: "domcontentloaded"
    })
    await popupPage.evaluate(async (keys) => {
      await chrome.storage.local.set({
        [keys.debugEnabled]: true,
        [keys.debugLogs]: []
      })
    }, TRANSLATION_STORAGE_KEYS)
    await popupPage.close()

    const firstCard = await openCard(page)
    await expect(firstCard.getByTestId("translation-line-meaning")).toHaveText("黑曜石（OpenAI）")
    await firstCard.getByRole("button", { name: "Close translation card" }).click()

    const secondCard = await openCard(page)
    await expect(secondCard.getByTestId("translation-line-meaning")).toHaveText("黑曜石（OpenAI）")

    const inspectPopup = await context.newPage()
    await inspectPopup.goto(`chrome-extension://${extensionId}/popup.html`, {
      waitUntil: "domcontentloaded"
    })
    const requestCount = await inspectPopup.evaluate(async (keys) => {
      const values = await chrome.storage.local.get([keys.debugLogs])
      const logs = Array.isArray(values[keys.debugLogs]) ? values[keys.debugLogs] : []
      const successEvents = logs.filter((entry) => entry?.event === "request_succeeded")
      const cacheHitEvents = logs.filter((entry) => entry?.event === "ui_cache_hit")
      return {
        requestCount: logs.filter((entry) => entry?.event === "request_received").length,
        cacheHitCount: cacheHitEvents.length,
        successModels: successEvents.map((entry) => String(entry?.payload?.model ?? "")),
        cacheHitModels: cacheHitEvents.map((entry) => String(entry?.payload?.model ?? ""))
      }
    }, TRANSLATION_STORAGE_KEYS)
    await inspectPopup.close()

    await expect(requestCount.requestCount).toBe(1)
    await expect(requestCount.cacheHitCount).toBeGreaterThan(0)
    await expect(requestCount.successModels.every((model) => model.length > 0)).toBeTruthy()
    await expect(requestCount.cacheHitModels.every((model) => model === "" || model.length > 0)).toBeTruthy()
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
    await expect(secondCard.getByTestId("translation-line-meaning")).toHaveText("黑曜石（OpenAI）")

    await popupPage.bringToFront()
    await expect(
      popupPage.getByRole("heading", { name: "Pipeline & LLM Logs" })
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
