export type VocabularySelectionType = "word" | "phrase" | "sentence" | "paragraph"

export type VocabularySortOrder = "newest" | "oldest" | "az" | "za"

export type VocabularyEntry = {
  id: string
  sourceText: string
  normalizedText: string
  translation: string
  phonetic?: string
  explanation?: string
  literal?: string
  note?: string
  example?: string
  sourceUrl?: string
  sourceTitle?: string
  contextText?: string
  selectionType: VocabularySelectionType
  createdAt: string
  updatedAt: string
}

export type VocabularyEntryInput = {
  sourceText: string
  translation: string
  phonetic?: string
  explanation?: string
  literal?: string
  note?: string
  example?: string
  sourceUrl?: string
  sourceTitle?: string
  contextText?: string
  selectionType: VocabularySelectionType
}

export type VocabularyUpsertResult = {
  entries: VocabularyEntry[]
  entry: VocabularyEntry
  created: boolean
}

export const VOCABULARY_STORAGE_KEY = "translation.vocabulary.entries"

export const normalizeVocabularyText = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase()

const generateVocabularyId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `vocab-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const optionalString = (value: unknown) => (typeof value === "string" && value ? value : undefined)

const isSelectionType = (value: unknown): value is VocabularySelectionType =>
  value === "word" || value === "phrase" || value === "sentence" || value === "paragraph"

export const isVocabularyEntry = (value: unknown): value is VocabularyEntry => {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.id === "string" &&
    typeof value.sourceText === "string" &&
    typeof value.normalizedText === "string" &&
    typeof value.translation === "string" &&
    isSelectionType(value.selectionType) &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  )
}

export const coerceVocabularyEntries = (value: unknown): VocabularyEntry[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(isVocabularyEntry)
}

export const sortVocabularyEntries = (
  entries: readonly VocabularyEntry[],
  order: VocabularySortOrder
): VocabularyEntry[] => {
  const sorted = [...entries]

  sorted.sort((left, right) => {
    if (order === "newest" || order === "oldest") {
      const diff = Date.parse(left.createdAt) - Date.parse(right.createdAt)
      return order === "newest" ? -diff : diff
    }

    const diff = left.normalizedText.localeCompare(right.normalizedText, undefined, {
      sensitivity: "base"
    })
    return order === "az" ? diff : -diff
  })

  return sorted
}

export const upsertVocabularyEntry = (
  entries: readonly VocabularyEntry[],
  input: VocabularyEntryInput,
  nowIso = new Date().toISOString(),
  idFactory = generateVocabularyId
): VocabularyUpsertResult => {
  const normalizedText = normalizeVocabularyText(input.sourceText)
  const existing = entries.find((entry) => entry.normalizedText === normalizedText)

  if (existing) {
    const updated: VocabularyEntry = {
      ...existing,
      sourceText: input.sourceText.trim(),
      normalizedText,
      translation: input.translation,
      phonetic: optionalString(input.phonetic),
      explanation: optionalString(input.explanation),
      literal: optionalString(input.literal),
      note: optionalString(input.note),
      example: optionalString(input.example),
      sourceUrl: optionalString(input.sourceUrl),
      sourceTitle: optionalString(input.sourceTitle),
      contextText: optionalString(input.contextText),
      selectionType: input.selectionType,
      updatedAt: nowIso
    }

    return {
      entries: entries.map((entry) => (entry.id === existing.id ? updated : entry)),
      entry: updated,
      created: false
    }
  }

  const entry: VocabularyEntry = {
    id: idFactory(),
    sourceText: input.sourceText.trim(),
    normalizedText,
    translation: input.translation,
    phonetic: optionalString(input.phonetic),
    explanation: optionalString(input.explanation),
    literal: optionalString(input.literal),
    note: optionalString(input.note),
    example: optionalString(input.example),
    sourceUrl: optionalString(input.sourceUrl),
    sourceTitle: optionalString(input.sourceTitle),
    contextText: optionalString(input.contextText),
    selectionType: input.selectionType,
    createdAt: nowIso,
    updatedAt: nowIso
  }

  return {
    entries: [...entries, entry],
    entry,
    created: true
  }
}

export const deleteVocabularyEntry = (
  entries: readonly VocabularyEntry[],
  entryId: string
): VocabularyEntry[] => entries.filter((entry) => entry.id !== entryId)

export const readVocabularyEntries = async (): Promise<VocabularyEntry[]> => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("chrome.storage.local is unavailable")
  }

  const values = await chrome.storage.local.get([VOCABULARY_STORAGE_KEY])
  return coerceVocabularyEntries(values[VOCABULARY_STORAGE_KEY])
}

export const writeVocabularyEntries = async (entries: readonly VocabularyEntry[]) => {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    throw new Error("chrome.storage.local is unavailable")
  }

  await chrome.storage.local.set({
    [VOCABULARY_STORAGE_KEY]: [...entries]
  })
}

export const saveVocabularyEntry = async (
  input: VocabularyEntryInput
): Promise<VocabularyUpsertResult> => {
  const entries = await readVocabularyEntries()
  const result = upsertVocabularyEntry(entries, input)
  await writeVocabularyEntries(result.entries)
  return result
}

export const removeVocabularyEntry = async (entryId: string): Promise<VocabularyEntry[]> => {
  const entries = await readVocabularyEntries()
  const nextEntries = deleteVocabularyEntry(entries, entryId)
  await writeVocabularyEntries(nextEntries)
  return nextEntries
}
