import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
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
  computeMarkerPositionFromPointer,
  computeMarkerPositionFromRect,
  DOT_SIZE,
  getWordCount,
  getSelectionSupport,
  isFlashCardSelection,
  MAX_SUPPORTED_SELECTION_LENGTH,
  MAX_SUPPORTED_SELECTION_WORDS,
  type MarkerPosition,
  type PointerPosition
} from "../lib/selection-ui"
import { saveVocabularyEntry } from "../lib/vocabulary-history"

const Z_INDEX = 2147483646
const UI_LOG_PREFIX = "[translation:ui]"
const BENCHMARK_REQUEST_CONCURRENCY = 4
const FLASH_MODEL = "qwen-mt-flash"
const CARD_FONT_STACK = "'Avenir Next', 'Segoe UI', 'Helvetica Neue', sans-serif"
const DISPLAY_FONT_STACK = "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif"
const ACCENT_GRADIENT = "linear-gradient(145deg, #ffb164 0%, #ff8d47 52%, #df6f2f 100%)"
const ACCENT_SHADOW = "rgba(223,111,47,0.28)"
const OVERLAY_ROOT_ID = "translation-overlay-root"

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

type SelectionNotice = {
  title: string
  message: string
  reason: "multiple_paragraphs" | "too_long"
}

type SaveState = "idle" | "saving" | "saved" | "updated" | "error"

const markerStyle = (position: MarkerPosition) =>
  ({
    all: "initial",
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
    all: "initial",
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

const overlayRootStyle = {
  all: "initial",
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: Z_INDEX,
  contain: "layout style paint"
} as const

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

const getSelectionNotice = (
  reason: SelectionNotice["reason"]
): SelectionNotice => {
  if (reason === "multiple_paragraphs") {
    return {
      reason,
      title: "Select a single paragraph",
      message: "Paragraph translation currently supports one paragraph at a time. Please trim the selection to a single block."
    }
  }

  return {
    reason,
    title: "Selection needs trimming",
    message: `Paragraph translation currently supports a single paragraph up to ${MAX_SUPPORTED_SELECTION_WORDS} words or ${MAX_SUPPORTED_SELECTION_LENGTH} characters. Please shorten the selection and try again.`
  }
}

const getSelectionContextText = () => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) {
    return ""
  }

  const containerText = selection.getRangeAt(0).commonAncestorContainer.textContent ?? ""
  return containerText.trim().replace(/\s+/g, " ").slice(0, 280)
}

const MainWorldSelectionTranslator = () => {
  const [selectedText, setSelectedText] = useState("")
  const [position, setPosition] = useState<MarkerPosition | null>(null)
  const [showCard, setShowCard] = useState(false)
  const [translationState, setTranslationState] = useState<TranslationState | null>(null)
  const [selectionNotice, setSelectionNotice] = useState<SelectionNotice | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [overlayRoot, setOverlayRoot] = useState<HTMLElement | null>(null)
  const dotRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLElement | null>(null)
  const requestIdRef = useRef(0)
  const activeTraceIdRef = useRef<string | null>(null)
  const flowStartAtRef = useRef<number | null>(null)
  const firstResultLoggedRef = useRef(false)
  const lastMarkerSignatureRef = useRef<string | null>(null)
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
    setSaveState("idle")
  }

  useEffect(() => {
    const parent = document.documentElement
    if (!parent) {
      return
    }

    const existing = document.getElementById(OVERLAY_ROOT_ID)
    if (existing) {
      setOverlayRoot(existing)
      return
    }

    const root = document.createElement("div")
    root.id = OVERLAY_ROOT_ID
    Object.assign(root.style, overlayRootStyle)
    parent.appendChild(root)
    setOverlayRoot(root)

    return () => {
      setOverlayRoot(null)
      root.remove()
    }
  }, [])

  useEffect(() => {
    const updateFromSelection = (pointerPosition?: PointerPosition) => {
      const selection = window.getSelection()
      const startedAt = Date.now()
      const traceId = activeTraceIdRef.current ?? createTraceId()

      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        const text = selection?.toString().trim() ?? ""
        const wordCount = text
          .split(/\s+/)
          .map((item) => item.trim())
          .filter(Boolean).length
        emitUiPhase("ui_selection_rejected", traceId, startedAt, {
          reason: "missing_range",
          textLength: text.length,
          wordCount,
          rangeCount: selection?.rangeCount ?? 0,
          isCollapsed: selection?.isCollapsed ?? true
        })
        if (!showCard) {
          setSelectedText("")
          setPosition(null)
          setTranslationState(null)
          setSaveState("idle")
        }
        return
      }

      const range = selection.getRangeAt(0)
      const text = selection.toString().trim()
      const selectionSupport = getSelectionSupport(text)
      const wordCount = selectionSupport.wordCount

      const selectionRect = range.getBoundingClientRect()
      const rect = {
        width: selectionRect.width,
        height: selectionRect.height,
        right: selectionRect.right,
        bottom: selectionRect.bottom
      }

      if (rect.width === 0 && rect.height === 0) {
        emitUiPhase("ui_selection_rect_missing", traceId, startedAt, {
          textLength: text.length,
          wordCount,
          rectWidth: 0,
          rectHeight: 0,
          rectRight: 0,
          rectBottom: 0
        })
        if (!showCard) {
          setSelectedText("")
          setPosition(null)
          setTranslationState(null)
          setSaveState("idle")
        }
        return
      }

      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      }
      const nextPos = pointerPosition
        ? computeMarkerPositionFromPointer(pointerPosition, viewport)
        : computeMarkerPositionFromRect(rect, viewport)
      if (!nextPos) {
        emitUiPhase("ui_selection_rejected", traceId, startedAt, {
          reason: "marker_position_unavailable",
          textLength: text.length,
          wordCount,
          rectWidth: rect.width,
          rectHeight: rect.height,
          rectRight: rect.right,
          rectBottom: rect.bottom
        })
        if (!showCard) {
          setSelectedText("")
          setPosition(null)
          setTranslationState(null)
          setSaveState("idle")
        }
        return
      }

      if (!selectionSupport.supported) {
        if (text) {
          emitUiPhase("ui_selection_rejected", traceId, startedAt, {
            reason: selectionSupport.reason ?? "unsupported_selection",
            textLength: selectionSupport.textLength,
            wordCount,
            paragraphCount: selectionSupport.paragraphCount
          })
        }
        if (!showCard && selectionSupport.reason && selectionSupport.reason !== "empty") {
          setSelectedText(text)
          setPosition(nextPos)
          setSelectionNotice(getSelectionNotice(selectionSupport.reason))
          setTranslationState(null)
          setSaveState("idle")
          return
        }
        if (!showCard) {
          setSelectedText("")
          setPosition(null)
          setSelectionNotice(null)
          setTranslationState(null)
          setSaveState("idle")
        }
        return
      }

      emitUiPhase("ui_marker_position_computed", traceId, startedAt, {
        textLength: text.length,
        wordCount,
        rectWidth: rect.width,
        rectHeight: rect.height,
        rectRight: rect.right,
        rectBottom: rect.bottom,
        markerLeft: nextPos.left,
        markerTop: nextPos.top,
        pointerX: pointerPosition?.x ?? null,
        pointerY: pointerPosition?.y ?? null,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      })
      setSelectedText(text)
      setPosition(nextPos)
      setSelectionNotice(null)
      setTranslationState(null)
      setSaveState("idle")
    }

    const hideAll = () => {
      setSelectedText("")
      setPosition(null)
      setShowCard(false)
      setSelectionNotice(null)
      setTranslationState(null)
      setSaveState("idle")
    }

    const onMouseUp = (event: MouseEvent) => {
      const target = event.target
      if (
        target instanceof Node &&
        (cardRef.current?.contains(target) || dotRef.current?.contains(target))
      ) {
        return
      }
      updateFromSelection({ x: event.clientX, y: event.clientY })
    }
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
    if (!position || !selectedText || showCard) {
      return
    }

    const traceId = activeTraceIdRef.current ?? createTraceId()
    const startedAt = flowStartAtRef.current ?? Date.now()
    const signature = `${selectedText}::${position.left}::${position.top}`
    if (lastMarkerSignatureRef.current === signature) {
      return
    }

    lastMarkerSignatureRef.current = signature
    emitUiPhase("ui_marker_rendered", traceId, startedAt, {
      textLength: selectedText.length,
      markerLeft: position.left,
      markerTop: position.top
    })
  }, [position, selectedText, showCard])

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
    if (!showCard || !selectedText || translationState || selectionNotice) {
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
    const flashCardMode = isFlashCardSelection(selectedText)
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
        if (!flashCardMode) {
          return requestTranslation(baseRequest)
        }
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
  }, [selectionNotice, selectedText, showCard, translationState])

  if (!overlayRoot || !position || !selectedText) {
    return null
  }

  const data = buildDryRunTranslation(selectedText)
  const flashCardMode = isFlashCardSelection(selectedText)
  const shouldShowPlaceholderDetails = translationState?.status === "error"
  const shouldShowSelectionNotice = Boolean(selectionNotice)
  const providerLabel = shouldShowSelectionNotice
    ? "not requested"
    : translationState?.status
      ? translationState.provider
      : "pending"
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
  const canSaveVocabulary =
    flashCardMode &&
    translationState?.status === "success" &&
    Boolean(translationState.card) &&
    saveState !== "saving"
  const saveButtonLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "Saved to notebook"
        : saveState === "updated"
          ? "Updated in notebook"
          : saveState === "error"
            ? "Save failed"
            : "Save to notebook"
  const handleSaveVocabulary = async () => {
    if (!flashCardMode || translationState?.status !== "success" || !translationState.card) {
      return
    }

    setSaveState("saving")
    try {
      const wordCount = getWordCount(selectedText)
      const result = await saveVocabularyEntry({
        sourceText: selectedText,
        translation: translationState.translatedText,
        phonetic: translationState.card.phonetic,
        explanation: translationState.card.meaning,
        example: translationState.card.example,
        selectionType: wordCount <= 1 ? "word" : "phrase",
        sourceUrl: window.location.href,
        sourceTitle: document.title,
        contextText: getSelectionContextText()
      })
      setSaveState(result.created ? "saved" : "updated")
      const traceId = activeTraceIdRef.current
      const startedAt = flowStartAtRef.current
      if (traceId && startedAt) {
        emitUiPhase("ui_vocabulary_saved", traceId, startedAt, {
          created: result.created,
          normalizedText: result.entry.normalizedText
        })
      }
    } catch (error) {
      setSaveState("error")
      console.error(`${UI_LOG_PREFIX} vocabulary_save_failed`, {
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }
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

  return createPortal(
    <>
      <div
        aria-label="Open translation card"
        data-testid="translation-dot"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openCard("dot_click")
          }
        }}
        onClick={() => openCard("dot_click")}
        onMouseEnter={() => openCard("dot_hover")}
        ref={dotRef}
        role="button"
        tabIndex={0}
        style={markerStyle(position)}>
        <span aria-hidden="true" style={markerGlyphStyle}>
          <span style={{ ...markerGlyphStemStyle, height: 9, transform: "rotate(18deg)", width: 3 }} />
          <span style={{ ...markerGlyphStemStyle, height: 5, transform: "translateY(2px)", width: 5 }} />
        </span>
      </div>

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
                <span style={{ color: "#342938", fontSize: 13 }}>
                  {shouldShowSelectionNotice
                    ? "Selection Guidance"
                    : flashCardMode
                      ? "Live Flash Card"
                      : "Live Sentence Translation"}
                </span>
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
                Provider: {providerLabel} · Model: {FLASH_MODEL}
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
                  fontFamily: flashCardMode ? DISPLAY_FONT_STACK : CARD_FONT_STACK,
                  fontSize: flashCardMode ? 34 : 20,
                  fontWeight: flashCardMode ? 600 : 500,
                  letterSpacing: "-0.02em",
                  lineHeight: flashCardMode ? 1.1 : 1.35
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
                {(flashCardMode ? [0, 1, 2] : [0, 1]).map((item) => (
                  <div
                    key={item}
                    style={{
                      height: item === 1 ? 14 : 12,
                      width: flashCardMode
                        ? item === 2
                          ? "88%"
                          : item === 1
                            ? "68%"
                            : "34%"
                        : item === 1
                          ? "92%"
                          : "56%",
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
                    {flashCardMode ? "Translation card" : "Translation"}
                  </div>
                  {flashCardMode
                    ? translatedCard?.phonetic
                      ? (
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
                      )
                      : renderLinePlaceholder("translation-line-phonetic-loading")
                    : null}
                  {translatedCard?.meaning || (!flashCardMode && translationState?.status === "success") ? (
                    <p
                      data-testid="translation-line-meaning"
                      style={{
                        color: "#2f2732",
                        fontSize: flashCardMode ? 18 : 17,
                        fontWeight: flashCardMode ? 600 : 500,
                        lineHeight: 1.45,
                        margin: flashCardMode ? "10px 0" : 0
                      }}>
                      {displayedMeaning}
                    </p>
                  ) : (
                    <div style={{ marginTop: flashCardMode ? 10 : 0 }}>
                      {renderLinePlaceholder("translation-line-meaning-loading")}
                    </div>
                  )}
                  {flashCardMode
                    ? translatedCard?.example
                      ? (
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
                      )
                      : (
                        <div style={{ marginTop: 10 }}>
                          {renderLinePlaceholder("translation-line-example-loading")}
                        </div>
                      )
                    : null}
                </div>
                {flashCardMode && translationState.status === "success" ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                    <button
                      data-testid="save-vocabulary-entry"
                      disabled={!canSaveVocabulary}
                      onClick={() => {
                        handleSaveVocabulary().catch((error) => {
                          setSaveState("error")
                          console.error(`${UI_LOG_PREFIX} vocabulary_save_failed`, {
                            message: error instanceof Error ? error.message : String(error)
                          })
                        })
                      }}
                      style={{
                        alignItems: "center",
                        background:
                          saveState === "saved" || saveState === "updated"
                            ? "linear-gradient(135deg, #f6c47c 0%, #f3a45b 100%)"
                            : "rgba(255,255,255,0.84)",
                        border: "1px solid rgba(111,96,121,0.12)",
                        borderRadius: 999,
                        boxShadow:
                          saveState === "saved" || saveState === "updated"
                            ? `0 10px 24px ${ACCENT_SHADOW}`
                            : "none",
                        color: saveState === "saved" || saveState === "updated" ? "#fff" : "#5d5362",
                        cursor: canSaveVocabulary ? "pointer" : "default",
                        display: "inline-flex",
                        fontFamily: CARD_FONT_STACK,
                        fontSize: 12,
                        fontWeight: 700,
                        gap: 8,
                        opacity: canSaveVocabulary ? 1 : 0.72,
                        padding: "9px 12px",
                        transition: "all 140ms ease"
                      }}
                      type="button">
                      <span aria-hidden="true">★</span>
                      {saveButtonLabel}
                    </button>
                  </div>
                ) : null}
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
            {shouldShowSelectionNotice ? (
              <div
                data-testid="translation-selection-notice"
                style={{
                  background: "rgba(247,243,247,0.92)",
                  border: "1px solid rgba(111,96,121,0.08)",
                  borderRadius: 20,
                  padding: "16px 16px 14px"
                }}>
                <p
                  data-testid="translation-selection-notice-title"
                  style={{
                    color: "#9a5a2d",
                    fontSize: 16,
                    fontWeight: 600,
                    margin: "0 0 8px"
                  }}>
                  {selectionNotice?.title}
                </p>
                <p
                  data-testid="translation-selection-notice-message"
                  style={{ color: "#6f6475", fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                  {selectionNotice?.message}
                </p>
              </div>
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
    </>,
    overlayRoot
  )
}

export default MainWorldSelectionTranslator
