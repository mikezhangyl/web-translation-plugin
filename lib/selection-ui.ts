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

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

export const isLikelyWord = (text: string) => {
  if (!text) {
    return false
  }
  if (text.length > 48) {
    return false
  }
  return text.split(/\s+/).length <= 4
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

  return {
    source,
    phonetic: "/demo/",
    partOfSpeech: "n.",
    shortMeaning: highlightedMeaning,
    example: highlightedExample.replace(new RegExp(escaped, "g"), source),
    detailTitle: source,
    detailBody: `${source} 的详细释义将在接入真实翻译服务后返回。`
  }
}
