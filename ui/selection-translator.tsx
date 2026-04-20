import { useEffect, useRef, useState } from "react"
import type {
  TranslateRequest,
  TranslationCard,
  TranslationMessageResponse,
  TranslationStreamServerMessage
} from "../lib/translation-contract"
import { TranslationRequestQueue } from "../lib/translation-request-queue"
import {
  buildDryRunTranslation,
  clamp,
  computeMarkerPositionFromRect,
  DOT_SIZE,
  isLikelyWord,
  type MarkerPosition
} from "../lib/selection-ui"

const Z_INDEX = 2147483646
const UI_LOG_PREFIX = "[translation:ui]"
const BENCHMARK_REQUEST_CONCURRENCY = 4
const FLASH_MODEL = "qwen-mt-flash"
const CARD_FONT_STACK = "'Avenir Next', 'Segoe UI', 'Helvetica Neue', sans-serif"
const DISPLAY_FONT_STACK = "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif"
const ACCENT_GRADIENT = "linear-gradient(145deg, #ffb164 0%, #ff8d47 52%, #df6f2f 100%)"
const ACCENT_SHADOW = "rgba(223,111,47,0.28)"

const createTraceId = () =>
  `ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const appendUiTroubleshootingLog = async (
  level: "info" | "error",
  event: string,
  payload: Record<string, unknown>
) => {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return
  }

  await chrome.runtime.sendMessage({
    type: "translation:debug-log",
    payload: {
      level,
      event,
      payload
    }
  }).catch((error: unknown) => {
    console.error(`${UI_LOG_PREFIX} ui_log_write_failed`, {
      message: error instanceof Error ? error.message : String(error)
    })
  })
}

type TranslationState =
  | {
      status: "loading"
    }
  | {
      status: "streaming"
      card: Partial<TranslationCard>
      provider: "openai_compatible" | "anthropic_compatible"
    }
  | {
      status: "success"
      translatedText: string
      card?: TranslationCard
      detectedSourceLang?: string
      provider: "openai_compatible" | "anthropic_compatible"
      fallbackUsed: boolean
    }
  | {
      status: "error"
      errorCode: string
      provider: "openai_compatible" | "anthropic_compatible"
      message: string
    }

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
    alignItems: "center",
    borderRadius: "36% 64% 58% 42% / 42% 42% 58% 58%",
    border: "1px solid rgba(255,255,255,0.78)",
    background:
      `radial-gradient(circle at 24% 24%, rgba(255,255,255,0.96), rgba(255,255,255,0.26) 18%, transparent 19%), ${ACCENT_GRADIENT}`,
    boxShadow: `0 12px 28px ${ACCENT_SHADOW}, 0 3px 8px rgba(34,24,41,0.14)`,
    cursor: "pointer",
    display: "inline-flex",
    justifyContent: "center",
    overflow: "hidden",
    padding: 0,
    zIndex: Z_INDEX
  }) as const

const markerGlyphStyle = {
  alignItems: "center",
  display: "inline-flex",
  gap: 2,
  transform: "translate(0.5px, -0.5px)"
} as const

const markerGlyphStemStyle = {
  background: "rgba(255,255,255,0.95)",
  borderRadius: 999,
  boxShadow: "0 1px 2px rgba(85,38,58,0.18)"
} as const

const cardContainerStyle = (position: MarkerPosition) =>
  ({
    position: "fixed",
    width: 520,
    maxWidth: "calc(100vw - 24px)",
    left: clamp(position.left - 212, 12, window.innerWidth - 532),
    top: clamp(position.top + 24, 12, window.innerHeight - 460),
    borderRadius: 24,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,240,245,0.98) 100%)",
    border: "1px solid rgba(110,96,122,0.12)",
    boxShadow: "0 28px 80px rgba(34,24,41,0.16), 0 6px 22px rgba(34,24,41,0.08)",
    padding: "18px 18px 16px",
    color: "#2d2530",
    fontFamily: CARD_FONT_STACK,
    backdropFilter: "blur(18px)",
    animation: "translationCardEnter 180ms cubic-bezier(0.2, 0.9, 0.25, 1)",
    zIndex: Z_INDEX
  }) as const

const providerPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  background: "rgba(247,242,246,0.96)",
  border: "1px solid rgba(108,90,114,0.12)",
  borderRadius: 999,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.01em",
  color: "#4b3d50"
} as const

const closeButtonStyle = {
  alignItems: "center",
  background: "rgba(255,255,255,0.7)",
  border: "1px solid rgba(90,76,99,0.12)",
  borderRadius: 999,
  color: "#6b5a71",
  cursor: "pointer",
  display: "inline-flex",
  height: 30,
  justifyContent: "center",
  lineHeight: 1,
  transition: "all 120ms ease",
  width: 30
} as const

const requestRuntime = async (
  type: "translation:translate" | "translation:compare",
  request: TranslateRequest
): Promise<TranslationMessageResponse> => {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN",
        provider: "openai_compatible",
        message: "Runtime messaging is unavailable"
      }
    }
  }

  return chrome.runtime.sendMessage({
    type,
    payload: request
  })
}

const requestTranslation = async (request: TranslateRequest): Promise<TranslationMessageResponse> =>
  requestRuntime("translation:translate", request)

const requestTranslationStream = async (
  request: TranslateRequest,
  onUpdate: (payload: {
    provider: "openai_compatible" | "anthropic_compatible"
    card: Partial<TranslationCard>
    translatedText: string
  }) => void
): Promise<TranslationMessageResponse> => {
  if (typeof chrome === "undefined" || !chrome.runtime?.connect) {
    return requestTranslation(request)
  }

  return new Promise<TranslationMessageResponse>((resolve, reject) => {
    const port = chrome.runtime.connect({ name: "translation-stream" })
    let settled = false

    port.onMessage.addListener((message: TranslationStreamServerMessage) => {
      if (message.type === "translation:stream-update") {
        onUpdate({
          provider: message.payload.provider,
          card: message.payload.card,
          translatedText: message.payload.translatedText
        })
        return
      }
      if (message.type === "translation:stream-complete") {
        settled = true
        resolve(message.payload.result)
        port.disconnect()
        return
      }
      if (message.type === "translation:stream-error") {
        settled = true
        reject(new Error(message.payload.message))
        port.disconnect()
      }
    })

    port.onDisconnect.addListener(() => {
      if (settled) {
        return
      }
      const reason = chrome.runtime.lastError?.message ?? "Streaming port disconnected unexpectedly"
      settled = true
      reject(new Error(reason))
    })

    port.postMessage({
      type: "translation:stream-start",
      payload: request
    })
  })
}

const normalizeTextKey = (text: string) => text.trim().toLowerCase()

type QueueEventContext = {
  traceId: string
  startedAt: number
  requestType: "single" | "comparison"
  model?: string
}

const getE2EMode = (): TranslateRequest["e2eMode"] => {
  if (window.location.hostname !== "example.com") {
    return undefined
  }
  const value = document.documentElement.getAttribute("data-translation-e2e-mode") ?? ""
  if (value === "openai_success" || value === "anthropic_success" || value === "provider_fail") {
    return value
  }
  return undefined
}

const MainWorldSelectionTranslator = () => {
  const [selectedText, setSelectedText] = useState("")
  const [position, setPosition] = useState<MarkerPosition | null>(null)
  const [showCard, setShowCard] = useState(false)
  const [translationState, setTranslationState] = useState<TranslationState | null>(null)
  const dotRef = useRef<HTMLButtonElement | null>(null)
  const cardRef = useRef<HTMLElement | null>(null)
  const requestIdRef = useRef(0)
  const activeTraceIdRef = useRef<string | null>(null)
  const flowStartAtRef = useRef<number | null>(null)
  const firstResultLoggedRef = useRef(false)
  const queueEventContextRef = useRef(new Map<string, QueueEventContext>())
  const queueRef = useRef(
    new TranslationRequestQueue<TranslationMessageResponse>({
      ttlMs: 5 * 60_000,
      maxEntries: 200,
      maxQueue: 50,
      concurrency: BENCHMARK_REQUEST_CONCURRENCY,
      shouldCacheValue: (value) => value.ok,
      onEvent: (event) => {
        const context = queueEventContextRef.current.get(event.key)
        if (event.type === "queue_drop_oldest") {
          console.warn(`${UI_LOG_PREFIX} queue_drop_oldest`, event)
          if (context) {
            void appendUiTroubleshootingLog("error", "ui_queue_drop_oldest", {
              traceId: context.traceId,
              model: context.model ?? null,
              requestType: context.requestType,
              droppedKey: event.droppedKey,
              key: event.key,
              maxQueue: event.maxQueue
            })
          }
          queueEventContextRef.current.delete(event.droppedKey)
          return
        }
        console.info(`${UI_LOG_PREFIX} ${event.type}`, event)
        if (context) {
          const eventName = event.type === "cache_hit" ? "ui_cache_hit" : "ui_inflight_reused"
          const elapsedMs = Date.now() - context.startedAt
          void appendUiTroubleshootingLog("info", eventName, {
            traceId: context.traceId,
            elapsedMs,
            requestType: context.requestType,
            model: context.model ?? null,
            key: event.key
          })
        }
      }
    })
  )

  const emitUiPhase = (
    event: string,
    traceId: string,
    startedAt: number,
    payload: Record<string, unknown> = {}
  ) => {
    const elapsedMs = Date.now() - startedAt
    const nextPayload = {
      traceId,
      elapsedMs,
      ...payload
    }
    console.info(`${UI_LOG_PREFIX} ${event}`, nextPayload)
    void appendUiTroubleshootingLog("info", event, nextPayload)
  }

  const openCard = (reason: "dot_click" | "dot_hover") => {
    if (!showCard) {
      const startedAt = Date.now()
      const traceId = createTraceId()
      flowStartAtRef.current = startedAt
      activeTraceIdRef.current = traceId
      emitUiPhase("ui_card_open", traceId, startedAt, {
        reason,
        selectedTextLength: selectedText.length
      })
    }
    setShowCard(true)
  }

  const closeCard = (reason: "outside_click" | "escape" | "close_button") => {
    if (!showCard) {
      return
    }
    const traceId = activeTraceIdRef.current
    const startedAt = flowStartAtRef.current
    if (traceId && startedAt) {
      emitUiPhase("ui_card_close", traceId, startedAt, { reason })
    }
    setShowCard(false)
    activeTraceIdRef.current = null
    flowStartAtRef.current = null
    firstResultLoggedRef.current = false
  }

  useEffect(() => {
    const updateFromSelection = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim() ?? ""
      if (!isLikelyWord(text)) {
        if (!showCard) {
          setSelectedText("")
          setPosition(null)
          setTranslationState(null)
        }
        return
      }

      const nextPos = getMarkerPosition()
      if (!nextPos) {
        if (!showCard) {
          setSelectedText("")
          setPosition(null)
          setTranslationState(null)
        }
        return
      }

      setSelectedText(text)
      setPosition(nextPos)
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
        closeCard("escape")
        return
      }
      updateFromSelection()
    }
    const onScroll = () => {
      if (showCard) return
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
    }
  }, [showCard])

  useEffect(() => {
    if (!showCard) return

    const onPointerDownCapture = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (cardRef.current?.contains(target) || dotRef.current?.contains(target)) return
      closeCard("outside_click")
    }

    document.addEventListener("pointerdown", onPointerDownCapture, true)
    return () => {
      document.removeEventListener("pointerdown", onPointerDownCapture, true)
    }
  }, [showCard])

  useEffect(() => {
    if (!showCard || !selectedText || translationState) {
      return
    }

    requestIdRef.current += 1
    const requestId = requestIdRef.current
    const startedAt = flowStartAtRef.current ?? Date.now()
    flowStartAtRef.current = startedAt
    const traceId = activeTraceIdRef.current ?? createTraceId()
    activeTraceIdRef.current = traceId
    firstResultLoggedRef.current = false
    const e2eMode = getE2EMode()
    const baseRequest: TranslateRequest = {
      text: selectedText,
      targetLang: "zh-CN",
      traceId,
      e2eMode,
      modelOverride: FLASH_MODEL
    }
    const normalizedText = normalizeTextKey(selectedText)
    emitUiPhase("ui_pipeline_start", traceId, startedAt, {
      requestId,
      textLength: selectedText.length,
      e2eMode: e2eMode ?? null
    })
    setTranslationState({ status: "loading" })
    const key = ["translate", normalizedText, "zh-CN", e2eMode ?? "live", FLASH_MODEL].join("|")
    emitUiPhase("ui_queue_enqueued", traceId, startedAt, {
      key,
      requestType: "single",
      model: FLASH_MODEL
    })
    queueEventContextRef.current.set(key, {
      traceId,
      startedAt,
      requestType: "single",
      model: FLASH_MODEL
    })
    queueRef.current
      .run(key, () => {
        emitUiPhase("ui_runtime_send_start", traceId, startedAt, {
          requestType: "single",
          model: FLASH_MODEL
        })
        return requestTranslationStream(baseRequest, (update) => {
          if (requestId !== requestIdRef.current) {
            return
          }
          setTranslationState({
            status: "streaming",
            card: update.card,
            provider: update.provider
          })
          if (!firstResultLoggedRef.current && Object.keys(update.card).length > 0) {
            firstResultLoggedRef.current = true
            emitUiPhase("ui_first_translation_rendered", traceId, startedAt, {
              requestType: "single",
              model: FLASH_MODEL,
              provider: update.provider,
              phase: "streaming"
            })
          }
        })
      })
      .then((result) => {
        if (requestId !== requestIdRef.current) return
        if (result.ok) {
          setTranslationState({
            status: "success",
            translatedText: result.data.translatedText,
            card: result.data.card,
            detectedSourceLang: result.data.detectedSourceLang,
            provider: result.data.provider,
            fallbackUsed: result.data.fallbackUsed
          })
          if (!firstResultLoggedRef.current) {
            firstResultLoggedRef.current = true
            emitUiPhase("ui_first_translation_rendered", traceId, startedAt, {
              requestType: "single",
              model: FLASH_MODEL,
              provider: result.data.provider,
              phase: "final"
            })
          }
          return
        }
        setTranslationState({
          status: "error",
          errorCode: result.error.code,
          provider: result.error.provider,
          message: result.error.message
        })
        emitUiPhase("ui_result_rendered", traceId, startedAt, {
          requestType: "single",
          model: FLASH_MODEL,
          status: "error",
          provider: result.error.provider,
          errorCode: result.error.code
        })
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return
        setTranslationState({
          status: "error",
          errorCode: "UNKNOWN",
          provider: "openai_compatible",
          message: error instanceof Error ? error.message : "Unexpected translation failure"
        })
        emitUiPhase("ui_result_rendered", traceId, startedAt, {
          requestType: "single",
          model: FLASH_MODEL,
          status: "error",
          provider: "openai_compatible",
          errorCode: "UNKNOWN"
        })
      })
  }, [showCard, selectedText, translationState])

  if (!position || !selectedText) {
    return null
  }

  const data = buildDryRunTranslation(selectedText)
  const shouldShowPlaceholderDetails = translationState?.status === "error"
  const translatedCard =
    translationState?.status === "success"
      ? translationState.card
      : translationState?.status === "streaming"
        ? translationState.card
        : null
  const displayedPhonetic = translatedCard?.phonetic || data.phonetic
  const displayedMeaning =
    translatedCard?.meaning || (translationState?.status === "success" ? translationState.translatedText : data.shortMeaning)
  const displayedExample = translatedCard?.example || data.example
  const shouldShowCardDetails =
    translationState?.status === "success" || translationState?.status === "streaming"
  const renderLinePlaceholder = (testId: string) => (
    <div
      data-testid={testId}
      style={{
        height: 12,
        borderRadius: 999,
        background:
          "linear-gradient(90deg, rgba(224,219,226,0.88) 0%, rgba(248,245,249,0.98) 50%, rgba(224,219,226,0.88) 100%)",
        backgroundSize: "200% 100%",
        animation: "translationShimmer 1.2s ease-in-out infinite"
      }}
    />
  )

  return (
    <>
      <button
        aria-label="Open translation card"
        data-testid="translation-dot"
        onClick={() => openCard("dot_click")}
        onMouseEnter={() => openCard("dot_hover")}
        ref={dotRef}
        style={markerStyle(position)}>
        <span aria-hidden="true" style={markerGlyphStyle}>
          <span style={{ ...markerGlyphStemStyle, height: 9, transform: "rotate(18deg)", width: 3 }} />
          <span style={{ ...markerGlyphStemStyle, height: 5, transform: "translateY(2px)", width: 5 }} />
        </span>
      </button>

      {showCard ? (
        <section data-testid="translation-card" ref={cardRef} style={cardContainerStyle(position)}>
          <style>
            {`@keyframes translationShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
            @keyframes translationCardEnter{0%{opacity:0;transform:translateY(8px) scale(0.985)}100%{opacity:1;transform:translateY(0) scale(1)}}`}
          </style>
          <header
            style={{
              alignItems: "center",
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 18
            }}>
            <div style={providerPillStyle}>
              <span
                style={{
                  alignItems: "center",
                  background: ACCENT_GRADIENT,
                  borderRadius: 999,
                  color: "#fff",
                  display: "inline-flex",
                  fontSize: 11,
                  fontWeight: 700,
                  height: 24,
                  justifyContent: "center",
                  width: 24,
                  boxShadow: `0 6px 14px ${ACCENT_SHADOW}`
                }}>
                翻
              </span>
              <div style={{ display: "grid", gap: 2 }}>
                <span style={{ color: "#6a5a70", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Quick Translate
                </span>
                <span style={{ color: "#342938", fontSize: 13 }}>Live Flash Card</span>
              </div>
            </div>
            <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
              <span
                data-testid="translation-provider"
                style={{
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(106,90,112,0.1)",
                  borderRadius: 999,
                  color: "#76667b",
                  fontSize: 11,
                  padding: "7px 10px"
                }}>
                Provider: {translationState?.status ? translationState.provider : "pending"} · Model: {FLASH_MODEL}
              </span>
              <button
                aria-label="Close translation card"
                onClick={() => closeCard("close_button")}
                style={closeButtonStyle}>
                <span style={{ display: "inline-block", fontSize: 15, transform: "translateY(-1px)" }}>×</span>
              </button>
            </div>
          </header>

          <div style={{ marginBottom: 18 }}>
            <div style={{ marginBottom: 14 }}>
              <p
                style={{
                  color: "#7d7082",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  margin: "0 0 6px",
                  textTransform: "uppercase"
                }}>
                Selected text
              </p>
              <strong
                style={{
                  display: "block",
                  fontFamily: DISPLAY_FONT_STACK,
                  fontSize: 34,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1
                }}>
                {data.source}
              </strong>
            </div>
            {translationState?.status === "loading" ? (
              <div
                data-testid="translation-loading"
                style={{
                  display: "grid",
                  gap: 10,
                  marginTop: 4,
                  padding: "16px 16px 14px",
                  background: "rgba(247,243,247,0.92)",
                  border: "1px solid rgba(111,96,121,0.08)",
                  borderRadius: 20
                }}>
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    style={{
                      height: item === 1 ? 14 : 12,
                      width: item === 2 ? "88%" : item === 1 ? "68%" : "34%",
                      borderRadius: 999,
                      background:
                        "linear-gradient(90deg, rgba(224,219,226,0.88) 0%, rgba(248,245,249,0.98) 50%, rgba(224,219,226,0.88) 100%)",
                      backgroundSize: "200% 100%",
                      animation: "translationShimmer 1.2s ease-in-out infinite"
                    }}
                  />
                ))}
              </div>
            ) : null}
            {shouldShowCardDetails ? (
              <>
                <div
                  data-testid="translation-card-details"
                  style={{
                    background: "rgba(247,243,247,0.92)",
                    border: "1px solid rgba(111,96,121,0.08)",
                    borderRadius: 20,
                    padding: "16px 16px 14px"
                  }}>
                  <div
                    style={{
                      color: "#8a7d8f",
                      fontSize: 10,
                      letterSpacing: "0.08em",
                      marginBottom: 10,
                      textTransform: "uppercase"
                    }}>
                    Translation card
                  </div>
                  {translatedCard?.phonetic ? (
                    <p
                      data-testid="translation-line-phonetic"
                      style={{
                        color: "#736779",
                        fontFamily: DISPLAY_FONT_STACK,
                        fontSize: 18,
                        margin: "0 0 10px"
                      }}>
                      {displayedPhonetic}
                    </p>
                  ) : (
                    renderLinePlaceholder("translation-line-phonetic-loading")
                  )}
                  {translatedCard?.meaning ? (
                    <p
                      data-testid="translation-line-meaning"
                      style={{
                        color: "#2f2732",
                        fontSize: 18,
                        fontWeight: 600,
                        lineHeight: 1.45,
                        margin: "10px 0"
                      }}>
                      {displayedMeaning}
                    </p>
                  ) : (
                    <div style={{ marginTop: 10 }}>{renderLinePlaceholder("translation-line-meaning-loading")}</div>
                  )}
                  {translatedCard?.example ? (
                    <p
                      data-testid="translation-line-example"
                      style={{
                        color: "#5c515f",
                        fontSize: 15,
                        lineHeight: 1.58,
                        margin: "10px 0 0"
                      }}>
                      {displayedExample}
                    </p>
                  ) : (
                    <div style={{ marginTop: 10 }}>{renderLinePlaceholder("translation-line-example-loading")}</div>
                  )}
                </div>
                <p style={{ color: "#7b707f", fontSize: 11, margin: "10px 0 0" }}>
                  Provider: {translationState.provider.replace("_", " ")} · Model: {FLASH_MODEL}
                </p>
              </>
            ) : null}
            {translationState?.status === "error" ? (
              <>
                <p
                  data-testid="translation-error"
                  style={{
                    color: "#a13c58",
                    fontSize: 16,
                    fontWeight: 600,
                    margin: "0 0 8px"
                  }}>
                  Translation unavailable ({translationState.provider}:{translationState.errorCode})
                </p>
                <p style={{ color: "#6f6475", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                  {translationState.message}
                </p>
              </>
            ) : null}
          </div>

          {shouldShowPlaceholderDetails ? (
            <div
              data-testid="translation-placeholder"
              style={{
                background: "rgba(247,243,247,0.92)",
                border: "1px solid rgba(111,96,121,0.08)",
                borderRadius: 20,
                padding: "16px 16px 14px"
              }}>
              <div style={{ color: "#8a7d8f", fontSize: 10, letterSpacing: "0.08em", marginBottom: 10, textTransform: "uppercase" }}>
                Detail preview
              </div>
              <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 8 }}>
                <strong
                  style={{
                    color: "#2f2732",
                    fontFamily: DISPLAY_FONT_STACK,
                    fontSize: 28,
                    fontWeight: 600,
                    lineHeight: 1.2
                  }}>
                  {data.detailTitle}
                </strong>
              </div>
              <p style={{ color: "#3c3240", fontSize: 16, lineHeight: 1.5, margin: "0 0 8px" }}>
                Placeholder detail (dry-run)
              </p>
              <p style={{ color: "#5c515f", fontSize: 15, lineHeight: 1.58, margin: 0 }}>{data.detailBody}</p>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  )
}

export default MainWorldSelectionTranslator
