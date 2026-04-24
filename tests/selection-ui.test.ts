import test from "node:test"
import assert from "node:assert/strict"

import {
  buildDryRunTranslation,
  clamp,
  computeMarkerPositionFromRect,
  getSelectionSupport,
  isFlashCardSelection,
  MAX_SUPPORTED_SELECTION_LENGTH,
  MAX_SUPPORTED_SELECTION_WORDS,
  isSupportedSelection
} from "../lib/selection-ui"

test("clamp keeps value in range", () => {
  assert.equal(clamp(5, 0, 10), 5)
  assert.equal(clamp(-2, 0, 10), 0)
  assert.equal(clamp(99, 0, 10), 10)
})

test("selection classification distinguishes flash-card text from sentence text", () => {
  assert.equal(isFlashCardSelection("Obsidian"), true)
  assert.equal(isFlashCardSelection("one two three four"), true)
  assert.equal(isFlashCardSelection("one two three four five"), false)
  assert.equal(isFlashCardSelection("x".repeat(49)), false)
  assert.equal(isSupportedSelection("This is a full sentence that should still be translated."), true)
  assert.equal(isSupportedSelection(""), false)
  assert.equal(isSupportedSelection("x".repeat(MAX_SUPPORTED_SELECTION_LENGTH + 1)), false)
})

test("selection support allows a single paragraph within the accepted limits", () => {
  const text = "This is a single paragraph selection that should stay within the first paragraph-mode limits."
  const result = getSelectionSupport(text)

  assert.equal(result.supported, true)
  assert.equal(result.reason, null)
  assert.equal(result.textLength, text.length)
  assert.equal(result.wordCount, 14)
  assert.equal(result.paragraphCount, 1)
})

test("selection support rejects multiple paragraphs", () => {
  const result = getSelectionSupport("First paragraph.\n\nSecond paragraph.")

  assert.equal(result.supported, false)
  assert.equal(result.reason, "multiple_paragraphs")
  assert.equal(result.paragraphCount, 2)
})

test("selection support rejects paragraph selections that exceed the word limit", () => {
  const longParagraph = Array.from(
    { length: MAX_SUPPORTED_SELECTION_WORDS + 1 },
    (_, index) => `word${index}`
  ).join(" ")

  const result = getSelectionSupport(longParagraph)

  assert.equal(result.supported, false)
  assert.equal(result.reason, "too_long")
  assert.equal(result.wordCount, MAX_SUPPORTED_SELECTION_WORDS + 1)
})

test("computeMarkerPositionFromRect returns null for empty rect", () => {
  const pos = computeMarkerPositionFromRect(
    { width: 0, height: 0, right: 100, bottom: 100 },
    { width: 1200, height: 800 }
  )

  assert.equal(pos, null)
})

test("computeMarkerPositionFromRect clamps marker to viewport", () => {
  const pos = computeMarkerPositionFromRect(
    { width: 30, height: 20, right: 1190, bottom: 790 },
    { width: 1200, height: 800 }
  )

  assert.deepEqual(pos, { left: 1176, top: 776 })
})

test("buildDryRunTranslation returns expected shape and preserves source word", () => {
  const data = buildDryRunTranslation("a+b")

  assert.equal(data.source, "a+b")
  assert.equal(data.phonetic, "/demo/")
  assert.equal(data.partOfSpeech, "n.")
  assert.equal(data.example, "I use a+b to organize my notes.")
  assert.match(data.shortMeaning, /dry-run/)
  assert.match(data.detailBody, /详细释义/)
})
