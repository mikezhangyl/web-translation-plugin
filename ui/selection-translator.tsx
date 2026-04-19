import { useEffect, useRef, useState } from "react"
import {
  buildDryRunTranslation,
  clamp,
  computeMarkerPositionFromRect,
  DOT_SIZE,
  isLikelyWord,
  type MarkerPosition
} from "../lib/selection-ui"

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

const MainWorldSelectionTranslator = () => {
  const [selectedText, setSelectedText] = useState("")
  const [position, setPosition] = useState<MarkerPosition | null>(null)
  const [showCard, setShowCard] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const updateFromSelection = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim() ?? ""
      if (!isLikelyWord(text)) {
        setSelectedText("")
        setPosition(null)
        setShowCard(false)
        return
      }

      const nextPos = getMarkerPosition()
      if (!nextPos) {
        setSelectedText("")
        setPosition(null)
        setShowCard(false)
        return
      }

      setSelectedText(text)
      setPosition(nextPos)
      setShowCard(false)
    }

    const hideAll = () => {
      setSelectedText("")
      setPosition(null)
      setShowCard(false)
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
            <p style={{ color: "#44474d", fontSize: 22, margin: "0 0 14px" }}>
              <span style={{ color: "#757983", marginRight: 10 }}>{data.partOfSpeech}</span>
              {data.shortMeaning}
            </p>
            <p style={{ color: "#3f4248", fontSize: 22, lineHeight: 1.5, margin: 0 }}>
              I use{" "}
              <span style={{ color: "#ef4f96", fontWeight: 600 }}>{data.source}</span> to organize my notes.
            </p>
          </div>

          <div
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
            <p style={{ color: "#353940", fontSize: 22, lineHeight: 1.5, margin: 0 }}>{data.detailBody}</p>
          </div>
        </section>
      ) : null}
    </>
  )
}

export default MainWorldSelectionTranslator
