import { useEffect, useRef, useState } from "react"
import {
  buildDryRunTranslation,
  clamp,
  computeMarkerPositionFromRect,
  DOT_SIZE,
  isLikelyWord,
  type MarkerPosition
} from "../lib/selection-ui"
import type { TranslateRequest, TranslationMessageResponse } from "../lib/translation-contract"

const Z_INDEX = 2147483646
const HIDE_DELAY_MS = 120

const getMarkerPosition = (): MarkerPosition | null => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect()
  return computeMarkerPositionFromRect(rect, { width: window.innerWidth, height: window.innerHeight })
}

const markerStyle = (position: MarkerPosition) =>
  ({
    position: "fixed",
    left: position.left,
    top: position.top,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: "50%",
    border: "none",
    background: "#ef4f96",
    boxShadow: "0 2px 10px rgba(239,79,150,0.35)",
    cursor: "pointer",
    zIndex: Z_INDEX
  }) as const

const cardContainerStyle = (position: MarkerPosition) =>
  ({
    position: "fixed",
    width: 640,
    maxWidth: "calc(100vw - 24px)",
    left: clamp(position.left - 260, 12, window.innerWidth - 652),
    top: clamp(position.top + 24, 12, window.innerHeight - 540),
    borderRadius: 22,
    background: "rgba(247,247,248,0.98)",
    border: "1px solid rgba(0,0,0,0.06)",
    boxShadow: "0 20px 48px rgba(0,0,0,0.14)",
    padding: "16px 18px 12px",
    color: "#2c2d30",
    zIndex: Z_INDEX
  }) as const

const headerTagStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  background: "#ececef",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 22,
  fontWeight: 500
} as const

const iconButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#95979c",
  fontSize: 24,
  cursor: "default",
  lineHeight: 1
} as const

type TranslationState =
  | {
      status: "loading"
    }
  | {
      status: "success"
      translatedText: string
      detectedSourceLang?: string
      provider: "azure" | "deepl"
      fallbackUsed: boolean
    }
  | {
      status: "error"
      errorCode: string
      provider: "azure" | "deepl"
      message: string
    }

const requestTranslation = async (request: TranslateRequest): Promise<TranslationMessageResponse> => {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN",
        provider: "azure",
        message: "Runtime messaging is unavailable"
      }
    }
  }

  return chrome.runtime.sendMessage({
    type: "translation:translate",
    payload: request
  })
}

const getE2EMode = (): TranslateRequest["e2eMode"] => {
  if (window.location.hostname !== "example.com") {
    return undefined
  }
  const value = document.documentElement.getAttribute("data-translation-e2e-mode") ?? ""
  if (
    value === "azure_success" ||
    value === "azure_rate_limit_then_deepl_success" ||
    value === "dual_fail"
  ) {
    return value
  }
  return undefined
}

const MainWorldSelectionTranslator = () => {
  const [selectedText, setSelectedText] = useState("")
  const [position, setPosition] = useState<MarkerPosition | null>(null)
  const [showCard, setShowCard] = useState(false)
  const [translationState, setTranslationState] = useState<TranslationState | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    const updateFromSelection = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim() ?? ""
      if (!isLikelyWord(text)) {
        setSelectedText("")
        setPosition(null)
        setShowCard(false)
        setTranslationState(null)
        return
      }

      const nextPos = getMarkerPosition()
      if (!nextPos) {
        setSelectedText("")
        setPosition(null)
        setShowCard(false)
        setTranslationState(null)
        return
      }

      setSelectedText(text)
      setPosition(nextPos)
      setShowCard(false)
      setTranslationState(null)
    }

    const hideAll = () => {
      setSelectedText("")
      setPosition(null)
      setShowCard(false)
      setTranslationState(null)
    }

    const onMouseUp = () => updateFromSelection()
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        hideAll()
        return
      }
      updateFromSelection()
    }
    const onScroll = () => {
      if (showCard) {
        return
      }
      updateFromSelection()
    }

    document.addEventListener("mouseup", onMouseUp)
    document.addEventListener("keyup", onKeyUp)
    window.addEventListener("resize", hideAll)
    window.addEventListener("scroll", onScroll, true)

    return () => {
      document.removeEventListener("mouseup", onMouseUp)
      document.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("resize", hideAll)
      window.removeEventListener("scroll", onScroll, true)
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
      }
    }
  }, [showCard])

  useEffect(() => {
    if (!showCard || !selectedText || translationState) {
      return
    }

    requestIdRef.current += 1
    const requestId = requestIdRef.current
    setTranslationState({ status: "loading" })

    requestTranslation({
      text: selectedText,
      targetLang: "zh-CN",
      e2eMode: getE2EMode()
    })
      .then((result) => {
        if (requestId !== requestIdRef.current) {
          return
        }
        if (result.ok) {
          setTranslationState({
            status: "success",
            translatedText: result.data.translatedText,
            detectedSourceLang: result.data.detectedSourceLang,
            provider: result.data.provider,
            fallbackUsed: result.data.fallbackUsed
          })
          return
        }
        setTranslationState({
          status: "error",
          errorCode: result.error.code,
          provider: result.error.provider,
          message: result.error.message
        })
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) {
          return
        }
        setTranslationState({
          status: "error",
          errorCode: "UNKNOWN",
          provider: "azure",
          message: error instanceof Error ? error.message : "Unexpected translation failure"
        })
      })
  }, [showCard, selectedText, translationState])

  const scheduleHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
    }
    hideTimer.current = setTimeout(() => {
      setShowCard(false)
    }, HIDE_DELAY_MS)
  }

  const cancelHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  if (!position || !selectedText) {
    return null
  }

  const data = buildDryRunTranslation(selectedText)
  const shouldShowPlaceholderDetails = translationState?.status === "error"

  return (
    <>
      <button
        aria-label="Open translation card"
        data-testid="translation-dot"
        onBlur={scheduleHide}
        onFocus={cancelHide}
        onMouseEnter={() => {
          cancelHide()
          setShowCard(true)
        }}
        onMouseLeave={scheduleHide}
        style={markerStyle(position)}
      />

      {showCard ? (
        <section
          data-testid="translation-card"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          style={cardContainerStyle(position)}>
          <header
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 18
            }}>
            <div style={headerTagStyle}>
              <span
                style={{
                  alignItems: "center",
                  background: "#ef4f96",
                  borderRadius: 8,
                  color: "#fff",
                  display: "inline-flex",
                  fontSize: 16,
                  fontWeight: 700,
                  height: 30,
                  justifyContent: "center",
                  width: 30
                }}>
                A
              </span>
              <span>Free Translation Service</span>
            </div>
            <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
              <button style={iconButtonStyle}>⎘</button>
              <button style={iconButtonStyle}>📌</button>
              <button style={iconButtonStyle}>⋯</button>
              <button style={iconButtonStyle}>✕</button>
            </div>
          </header>

          <div style={{ marginBottom: 20 }}>
            <div style={{ alignItems: "baseline", display: "flex", gap: 14, marginBottom: 10 }}>
              <strong style={{ fontSize: 50, fontWeight: 700, lineHeight: 1.12 }}>{data.source}</strong>
              <span style={{ color: "#8e9095", fontSize: 46, lineHeight: 1.12 }}>{data.phonetic}</span>
            </div>
            {translationState?.status === "loading" ? (
              <p data-testid="translation-loading" style={{ color: "#44474d", fontSize: 22, margin: "0 0 14px" }}>
                Translating...
              </p>
            ) : null}
            {translationState?.status === "success" ? (
              <>
                <p
                  data-testid="translation-success-text"
                  style={{ color: "#44474d", fontSize: 22, margin: "0 0 14px" }}>
                  {translationState.translatedText}
                </p>
                <p
                  data-testid="translation-provider"
                  style={{ color: "#6b6f78", fontSize: 16, margin: 0 }}>
                  Provider: {translationState.provider}
                  {translationState.fallbackUsed ? " (fallback)" : ""}
                </p>
              </>
            ) : null}
            {translationState?.status === "error" ? (
              <>
                <p data-testid="translation-error" style={{ color: "#b53a3a", fontSize: 20, margin: "0 0 10px" }}>
                  Translation unavailable ({translationState.provider}:{translationState.errorCode})
                </p>
                <p style={{ color: "#6b6f78", fontSize: 16, margin: 0 }}>
                  {translationState.message}
                </p>
              </>
            ) : null}
          </div>

          {shouldShowPlaceholderDetails ? (
            <div
              data-testid="translation-placeholder"
              style={{
                background: "#ececee",
                borderRadius: 18,
                padding: "18px 22px"
              }}>
              <div style={{ alignItems: "center", display: "flex", gap: 12, marginBottom: 8 }}>
                <strong style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.2 }}>{data.detailTitle}</strong>
                <button style={iconButtonStyle}>🔊</button>
                <button style={iconButtonStyle}>⧉</button>
              </div>
              <p style={{ color: "#353940", fontSize: 22, lineHeight: 1.5, margin: "0 0 8px" }}>
                Placeholder detail (dry-run)
              </p>
              <p style={{ color: "#353940", fontSize: 22, lineHeight: 1.5, margin: 0 }}>{data.detailBody}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}

export default MainWorldSelectionTranslator
