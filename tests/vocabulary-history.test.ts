import assert from "node:assert/strict"
import test from "node:test"

import {
  deleteVocabularyEntry,
  normalizeVocabularyText,
  sortVocabularyEntries,
  upsertVocabularyEntry,
  VOCABULARY_STORAGE_KEY,
  type VocabularyEntry
} from "../lib/vocabulary-history"

const baseEntry = (overrides: Partial<VocabularyEntry> = {}): VocabularyEntry => ({
  id: "entry-1",
  sourceText: "Anchor",
  normalizedText: "anchor",
  translation: "锚点",
  phonetic: "/ˈæŋkər/",
  explanation: "a word used as a stable reference point",
  literal: "锚",
  note: "Can also mean a stabilizing reference point in abstract contexts.",
  example: "The anchor keeps the boat steady.",
  selectionType: "word",
  createdAt: "2026-04-24T08:00:00.000Z",
  updatedAt: "2026-04-24T08:00:00.000Z",
  ...overrides
})

test("vocabulary storage key is stable", () => {
  assert.equal(VOCABULARY_STORAGE_KEY, "translation.vocabulary.entries")
})

test("normalizeVocabularyText trims, collapses spaces, and lowercases text", () => {
  assert.equal(normalizeVocabularyText("  Hello   World  "), "hello world")
})

test("upsertVocabularyEntry creates a new entry with flash-card details", () => {
  const result = upsertVocabularyEntry(
    [],
    {
      sourceText: "Obsidian",
      translation: "黑曜石",
      phonetic: "/əbˈsɪdiən/",
      explanation: "a dark volcanic glass",
      literal: "黑曜石",
      note: "Often used literally for volcanic glass.",
      example: "The pendant was made of obsidian.",
      selectionType: "word",
      sourceUrl: "https://example.test/article",
      sourceTitle: "Learning Article",
      contextText: "The pendant was made of obsidian."
    },
    "2026-04-24T09:00:00.000Z",
    () => "entry-new"
  )

  assert.equal(result.created, true)
  assert.equal(result.entry.id, "entry-new")
  assert.equal(result.entry.normalizedText, "obsidian")
  assert.equal(result.entry.createdAt, "2026-04-24T09:00:00.000Z")
  assert.equal(result.entry.updatedAt, "2026-04-24T09:00:00.000Z")
  assert.equal(result.entry.phonetic, "/əbˈsɪdiən/")
  assert.equal(result.entry.explanation, "a dark volcanic glass")
  assert.equal(result.entry.literal, "黑曜石")
  assert.equal(result.entry.note, "Often used literally for volcanic glass.")
  assert.equal(result.entry.example, "The pendant was made of obsidian.")
  assert.equal(result.entries.length, 1)
})

test("upsertVocabularyEntry updates duplicate normalized text without changing createdAt", () => {
  const existing = baseEntry({
    sourceText: "  Anchor ",
    normalizedText: "anchor",
    translation: "旧翻译",
    createdAt: "2026-04-24T08:00:00.000Z",
    updatedAt: "2026-04-24T08:00:00.000Z"
  })

  const result = upsertVocabularyEntry(
    [existing],
    {
      sourceText: "anchor",
      translation: "锚；固定点",
      phonetic: "/ˈæŋkər/",
      explanation: "a stable point or object",
      literal: "锚",
      note: "Can be used figuratively for stability.",
      example: "The anchor held during the storm.",
      selectionType: "word"
    },
    "2026-04-24T10:00:00.000Z",
    () => "unused-id"
  )

  assert.equal(result.created, false)
  assert.equal(result.entry.id, "entry-1")
  assert.equal(result.entry.createdAt, "2026-04-24T08:00:00.000Z")
  assert.equal(result.entry.updatedAt, "2026-04-24T10:00:00.000Z")
  assert.equal(result.entry.translation, "锚；固定点")
  assert.equal(result.entry.note, "Can be used figuratively for stability.")
  assert.equal(result.entries.length, 1)
})

test("sortVocabularyEntries supports time and alphabetical ordering", () => {
  const entries = [
    baseEntry({
      id: "entry-b",
      sourceText: "banana",
      normalizedText: "banana",
      createdAt: "2026-04-24T09:00:00.000Z"
    }),
    baseEntry({
      id: "entry-a",
      sourceText: "apple",
      normalizedText: "apple",
      createdAt: "2026-04-24T10:00:00.000Z"
    }),
    baseEntry({
      id: "entry-c",
      sourceText: "cherry",
      normalizedText: "cherry",
      createdAt: "2026-04-24T08:00:00.000Z"
    })
  ]

  assert.deepEqual(
    sortVocabularyEntries(entries, "newest").map((entry) => entry.id),
    ["entry-a", "entry-b", "entry-c"]
  )
  assert.deepEqual(
    sortVocabularyEntries(entries, "oldest").map((entry) => entry.id),
    ["entry-c", "entry-b", "entry-a"]
  )
  assert.deepEqual(
    sortVocabularyEntries(entries, "az").map((entry) => entry.id),
    ["entry-a", "entry-b", "entry-c"]
  )
  assert.deepEqual(
    sortVocabularyEntries(entries, "za").map((entry) => entry.id),
    ["entry-c", "entry-b", "entry-a"]
  )
})

test("deleteVocabularyEntry removes an entry without mutating the input array", () => {
  const entries = [baseEntry({ id: "keep" }), baseEntry({ id: "remove" })]
  const result = deleteVocabularyEntry(entries, "remove")

  assert.deepEqual(
    result.map((entry) => entry.id),
    ["keep"]
  )
  assert.equal(entries.length, 2)
})
