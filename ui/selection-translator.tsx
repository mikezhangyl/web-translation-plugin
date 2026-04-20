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
        height: 16,
        borderRadius: 8,
        background:
          "linear-gradient(90deg, rgba(220,220,225,0.95) 0%, rgba(245,245,248,0.95) 50%, rgba(220,220,225,0.95) 100%)",
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
        style={markerStyle(position)}
      />

      {showCard ? (
        <section data-testid="translation-card" ref={cardRef} style={cardContainerStyle(position)}>
          <style>
            {`@keyframes translationShimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}`}
          </style>
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
              <button
                aria-label="Close translation card"
                onClick={() => closeCard("close_button")}
                style={{ ...iconButtonStyle, cursor: "pointer" }}>
                ✕
              </button>
            </div>
          </header>

          <div style={{ marginBottom: 20 }}>
            <div style={{ alignItems: "baseline", display: "flex", gap: 14, marginBottom: 10 }}>
              <strong style={{ fontSize: 50, fontWeight: 700, lineHeight: 1.12 }}>{data.source}</strong>
            </div>
            {translationState?.status === "loading" ? (
              <div data-testid="translation-loading" style={{ display: "grid", gap: 10, marginTop: 4 }}>
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    style={{
                      height: 16,
                      borderRadius: 8,
                      background:
                        "linear-gradient(90deg, rgba(220,220,225,0.95) 0%, rgba(245,245,248,0.95) 50%, rgba(220,220,225,0.95) 100%)",
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
                    background: "#ececee",
                    borderRadius: 18,
                    padding: "18px 22px"
                  }}>
                  {translatedCard?.phonetic ? (
                    <p
                      data-testid="translation-line-phonetic"
                      style={{ color: "#5f6470", fontSize: 20, margin: "0 0 10px" }}>
                      {displayedPhonetic}
                    </p>
                  ) : (
                    renderLinePlaceholder("translation-line-phonetic-loading")
                  )}
                  {translatedCard?.meaning ? (
                    <p
                      data-testid="translation-line-meaning"
                      style={{ color: "#2f3338", fontSize: 22, margin: "10px 0" }}>
                      {displayedMeaning}
                    </p>
                  ) : (
                    <div style={{ marginTop: 10 }}>{renderLinePlaceholder("translation-line-meaning-loading")}</div>
                  )}
                  {translatedCard?.example ? (
                    <p
                      data-testid="translation-line-example"
                      style={{ color: "#4c5058", fontSize: 18, lineHeight: 1.5, margin: "10px 0 0" }}>
                      {displayedExample}
                    </p>
                  ) : (
                    <div style={{ marginTop: 10 }}>{renderLinePlaceholder("translation-line-example-loading")}</div>
                  )}
                </div>
                <p data-testid="translation-provider" style={{ color: "#6b6f78", fontSize: 16, margin: "10px 0 0" }}>
                  Provider: {translationState.provider} · Model: {FLASH_MODEL}
                </p>
              </>
            ) : null}
            {translationState?.status === "error" ? (
              <>
                <p data-testid="translation-error" style={{ color: "#b53a3a", fontSize: 20, margin: "0 0 10px" }}>
                  Translation unavailable ({translationState.provider}:{translationState.errorCode})
                </p>
                <p style={{ color: "#6b6f78", fontSize: 16, margin: 0 }}>{translationState.message}</p>
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
