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

export const DOT_SIZE = 16
export const DOT_OFFSET = 8
export const MAX_SUPPORTED_SELECTION_LENGTH = 360
export const MAX_FLASH_CARD_WORDS = 4
export const MAX_FLASH_CARD_LENGTH = 48

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const getWordCount = (text: string) =>
  text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length

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
  const normalized = text.trim()
  if (!normalized) {
    return false
  }
  return normalized.length <= MAX_SUPPORTED_SELECTION_LENGTH
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
