export type MarkerPosition = {
  left: number
  top: number
}

export type ViewportSize = {
  width: number
  height: number
}

export type SelectionRect = {
  width: number
  height: number
  right: number
  bottom: number
}

export type UnsupportedSelectionReason = "empty" | "multiple_paragraphs" | "too_long"

export type SelectionSupport = {
  supported: boolean
  reason: UnsupportedSelectionReason | null
  textLength: number
  wordCount: number
  paragraphCount: number
}

export const DOT_SIZE = 16
export const DOT_OFFSET = 8
export const MAX_SUPPORTED_SELECTION_LENGTH = 1_500
export const MAX_SUPPORTED_SELECTION_WORDS = 250
export const MAX_FLASH_CARD_WORDS = 4
export const MAX_FLASH_CARD_LENGTH = 48

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const getWordCount = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

const getParagraphCount = (text: string) =>
  text
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean).length

export const getSelectionSupport = (text: string): SelectionSupport => {
  const normalized = text.trim()
  const wordCount = getWordCount(normalized)
  const paragraphCount = getParagraphCount(normalized)

  if (!normalized) {
    return {
      supported: false,
      reason: "empty",
      textLength: 0,
      wordCount: 0,
      paragraphCount: 0
    }
  }

  if (paragraphCount > 1) {
    return {
      supported: false,
      reason: "multiple_paragraphs",
      textLength: normalized.length,
      wordCount,
      paragraphCount
    }
  }

  if (
    normalized.length > MAX_SUPPORTED_SELECTION_LENGTH ||
    wordCount > MAX_SUPPORTED_SELECTION_WORDS
  ) {
    return {
      supported: false,
      reason: "too_long",
      textLength: normalized.length,
      wordCount,
      paragraphCount
    }
  }

  return {
    supported: true,
    reason: null,
    textLength: normalized.length,
    wordCount,
    paragraphCount
  }
}

export const isFlashCardSelection = (text: string) => {
  const normalized = text.trim()
  if (!normalized) {
    return false
  }
  if (normalized.length > MAX_FLASH_CARD_LENGTH) {
    return false
  }
  return getWordCount(normalized) <= MAX_FLASH_CARD_WORDS
}

export const isSupportedSelection = (text: string) => {
  return getSelectionSupport(text).supported
}

export const computeMarkerPositionFromRect = (
  rect: SelectionRect,
  viewport: ViewportSize,
  dotSize = DOT_SIZE,
  offset = DOT_OFFSET
): MarkerPosition | null => {
  if (rect.width === 0 && rect.height === 0) {
    return null
  }

  const left = clamp(rect.right + offset, offset, viewport.width - dotSize - offset)
  const top = clamp(rect.bottom + offset, offset, viewport.height - dotSize - offset)

  return { left, top }
}

export const buildDryRunTranslation = (source: string) => {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const highlightedExample = `I use ${source} to organize my notes.`
  const highlightedMeaning = `${source} 是一个示例翻译结果（dry-run）。`
  const sentenceMeaning = `${source} 的整句翻译将在接入真实翻译服务后返回。`
  const flashCardMode = isFlashCardSelection(source)

  return {
    source,
    phonetic: "/demo/",
    partOfSpeech: "n.",
    shortMeaning: flashCardMode ? highlightedMeaning : sentenceMeaning,
    example: highlightedExample.replace(new RegExp(escaped, "g"), source),
    detailTitle: source,
    detailBody: `${source} 的详细释义将在接入真实翻译服务后返回。`
  }
}
