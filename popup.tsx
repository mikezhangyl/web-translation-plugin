import { useEffect, useState } from "react"
import type {
  TranslationEnvDefaultsResponse,
  TranslationProviderFlavor
} from "./lib/translation-contract"
import {
  DEFAULT_DEBUG_ENABLED,
  EMPTY_TRANSLATION_SETTINGS,
  DEFAULT_QWEN_FLASH_MODEL,
  TRANSLATION_STORAGE_KEYS,
  withFlavorDefaults,
  type TranslationDebugLogEntry,
  type TranslationProfileId,
  type TranslationSettings
} from "./lib/translation-settings"
import {
  readVocabularyEntries,
  removeVocabularyEntry,
  sortVocabularyEntries,
  type VocabularyEntry,
  type VocabularySortOrder
} from "./lib/vocabulary-history"

const PROVIDER_LABELS: Record<TranslationProviderFlavor, string> = {
  "openai-compatible": "OpenAI-compatible",
  "anthropic-compatible": "Anthropic-compatible"
}

const PROFILE_LABELS: Record<TranslationProfileId, string> = {
  custom: "Custom",
  "qwen-flash-card": "Qwen Flash Card"
}

const POPUP_FONT_STACK = "'Avenir Next', 'Segoe UI', 'Helvetica Neue', sans-serif"
const POPUP_ACCENT_GRADIENT = "linear-gradient(135deg, #ffb164 0%, #ff8d47 56%, #df6f2f 100%)"
const POPUP_ACCENT_SHADOW = "rgba(223, 111, 47, 0.24)"
const popSurface = {
  background: "linear-gradient(180deg, #f8f4f7 0%, #f3f0f6 100%)",
  border: "1px solid rgba(111, 95, 121, 0.12)",
  borderRadius: 18,
  boxShadow: "0 16px 44px rgba(42, 30, 52, 0.08)"
} as const
const fieldLabelStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  marginBottom: 12,
  textTransform: "uppercase" as const,
  color: "#65596b"
}
const inputStyle = {
  boxSizing: "border-box" as const,
  marginTop: 6,
  padding: "10px 12px",
  width: "100%",
  borderRadius: 12,
  border: "1px solid rgba(111, 95, 121, 0.14)",
  background: "rgba(255,255,255,0.76)",
  color: "#2f2732",
  fontSize: 13,
  outline: "none"
}
const buttonStyle = {
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid rgba(111,95,121,0.12)",
  background: "rgba(255,255,255,0.82)",
  color: "#3f3345",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer"
} as const

const iconButtonStyle = {
  alignItems: "center",
  background: "rgba(255,255,255,0.82)",
  border: "1px solid rgba(111,95,121,0.12)",
  borderRadius: 12,
  color: "#5d5362",
  cursor: "pointer",
  display: "inline-flex",
  height: 32,
  justifyContent: "center",
  width: 32
} as const

const copyTextToClipboard = async (value: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is unavailable.")
  }

  const textarea = document.createElement("textarea")
  textarea.value = value
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand("copy")
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error("Copy command failed.")
  }
}

type TracePhase = {
  ts: string
  event: string
  elapsedMs: number
  model: string
}

type CopyState = "idle" | "copying" | "copied" | "error"
type ClearState = "idle" | "clearing" | "cleared" | "error"
type VocabularyDeleteState = "idle" | "deleting"

function IndexPopup() {
  const [settings, setSettings] = useState<TranslationSettings>(EMPTY_TRANSLATION_SETTINGS)
  const [logs, setLogs] = useState<TranslationDebugLogEntry[]>([])
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [copyState, setCopyState] = useState<CopyState>("idle")
  const [clearState, setClearState] = useState<ClearState>("idle")
  const [vocabularyEntries, setVocabularyEntries] = useState<VocabularyEntry[]>([])
  const [vocabularySortOrder, setVocabularySortOrder] = useState<VocabularySortOrder>("newest")
  const [vocabularyDeleteState, setVocabularyDeleteState] = useState<VocabularyDeleteState>("idle")

  const readEnvDefaults = async (
    profileId: TranslationProfileId,
    providerFlavor?: TranslationProviderFlavor,
    model?: string
  ): Promise<TranslationEnvDefaultsResponse["data"]> => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      return {
        profileId,
        providerFlavor: providerFlavor ?? "openai-compatible",
        apiKey: "",
        baseUrl: "",
        model: model ?? (profileId === "qwen-flash-card" ? DEFAULT_QWEN_FLASH_MODEL : "")
      }
    }
    const response = (await chrome.runtime.sendMessage({
      type: "translation:env-defaults",
      payload: { profileId, providerFlavor, model }
    })) as TranslationEnvDefaultsResponse
    return response.data
  }

  const mergeSettings = (
    profileId: TranslationProfileId,
    stored: {
      providerFlavor: TranslationProviderFlavor
      apiKey: string
      baseUrl: string
      model: string
      benchmarkModels: string[]
      debugEnabled: boolean
    },
    envDefaults: TranslationEnvDefaultsResponse["data"]
  ) =>
    withFlavorDefaults({
      profileId,
      providerFlavor: stored.providerFlavor || envDefaults.providerFlavor,
      apiKey: stored.apiKey || envDefaults.apiKey || "",
      baseUrl: stored.baseUrl || envDefaults.baseUrl || "",
      model: stored.model || envDefaults.model || "",
      benchmarkModels: stored.benchmarkModels,
      debugEnabled: stored.debugEnabled
    })

  const loadTroubleshootingLogs = async () => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return
    }
    const values = await chrome.storage.local.get([TRANSLATION_STORAGE_KEYS.debugLogs])
    const rawLogs = values[TRANSLATION_STORAGE_KEYS.debugLogs]
    const parsedLogs = Array.isArray(rawLogs) ? (rawLogs as TranslationDebugLogEntry[]) : []
    setLogs(parsedLogs.slice(-60).reverse())
  }

  const loadVocabularyEntries = async () => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return
    }

    setVocabularyEntries(await readVocabularyEntries())
  }

  useEffect(() => {
    const load = async () => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        setStatus("chrome.storage.local is unavailable in this context.")
        setLoading(false)
        return
      }

      const values = await chrome.storage.local.get([
        TRANSLATION_STORAGE_KEYS.profileId,
        TRANSLATION_STORAGE_KEYS.providerFlavor,
        TRANSLATION_STORAGE_KEYS.apiKey,
        TRANSLATION_STORAGE_KEYS.baseUrl,
        TRANSLATION_STORAGE_KEYS.model,
        TRANSLATION_STORAGE_KEYS.benchmarkModels,
        TRANSLATION_STORAGE_KEYS.debugEnabled
      ])

      const profileId =
        values[TRANSLATION_STORAGE_KEYS.profileId] === "qwen-flash-card"
          ? "qwen-flash-card"
          : "custom"
      const storedFlavorRaw = String(values[TRANSLATION_STORAGE_KEYS.providerFlavor] ?? "").trim()
      const providerFlavor =
        storedFlavorRaw === "anthropic-compatible"
          ? "anthropic-compatible"
          : storedFlavorRaw === "openai-compatible"
            ? "openai-compatible"
            : "openai-compatible"
      const storedModel = String(values[TRANSLATION_STORAGE_KEYS.model] ?? "").trim()
      const envDefaults = await readEnvDefaults(profileId, providerFlavor, storedModel)
      const resolvedProviderFlavor =
        storedFlavorRaw === "anthropic-compatible"
          ? "anthropic-compatible"
          : storedFlavorRaw === "openai-compatible"
            ? "openai-compatible"
            : envDefaults.providerFlavor
      setSettings(
        mergeSettings(
          profileId,
          {
            providerFlavor: resolvedProviderFlavor,
            apiKey: String(values[TRANSLATION_STORAGE_KEYS.apiKey] ?? "").trim(),
            baseUrl: String(values[TRANSLATION_STORAGE_KEYS.baseUrl] ?? "").trim(),
            model: storedModel,
            benchmarkModels: String(values[TRANSLATION_STORAGE_KEYS.benchmarkModels] ?? "")
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
            debugEnabled:
              values[TRANSLATION_STORAGE_KEYS.debugEnabled] === undefined
                ? DEFAULT_DEBUG_ENABLED
                : values[TRANSLATION_STORAGE_KEYS.debugEnabled] !== false
          },
          envDefaults
        )
      )
      await loadTroubleshootingLogs()
      await loadVocabularyEntries()
      setLoading(false)
    }

    load().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Failed to load settings.")
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return
    }
    const timer = setInterval(() => {
      loadTroubleshootingLogs().catch(() => {})
    }, 1500)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (copyState !== "copied" && copyState !== "error") {
      return
    }

    const timeout = window.setTimeout(() => {
      setCopyState("idle")
    }, 1800)

    return () => window.clearTimeout(timeout)
  }, [copyState])

  useEffect(() => {
    if (clearState !== "cleared" && clearState !== "error") {
      return
    }

    const timeout = window.setTimeout(() => {
      setClearState("idle")
    }, 1800)

    return () => window.clearTimeout(timeout)
  }, [clearState])

  const updateField = <K extends keyof TranslationSettings>(key: K, value: TranslationSettings[K]) => {
    setSettings((prev) => withFlavorDefaults({ ...prev, [key]: value }))
  }

  const updateProfile = async (profileId: TranslationProfileId) => {
    const envDefaults = await readEnvDefaults(profileId)
    setSettings((prev) =>
      mergeSettings(
        profileId,
        {
          providerFlavor:
            prev.profileId === profileId ? prev.providerFlavor : envDefaults.providerFlavor,
          apiKey: prev.profileId === profileId ? prev.apiKey : envDefaults.apiKey,
          baseUrl: prev.profileId === profileId ? prev.baseUrl : envDefaults.baseUrl,
          model: prev.profileId === profileId ? prev.model : envDefaults.model,
          benchmarkModels: prev.benchmarkModels,
          debugEnabled: prev.debugEnabled
        },
        envDefaults
      )
    )
  }

  const updateFieldWithEnvFallback = async <K extends keyof TranslationSettings>(
    key: K,
    value: TranslationSettings[K]
  ) => {
    const next = withFlavorDefaults({ ...settings, [key]: value })
    const envDefaults = await readEnvDefaults(next.profileId, next.providerFlavor, next.model)
    setSettings(
      mergeSettings(
        next.profileId,
        {
          providerFlavor: next.providerFlavor,
          apiKey: next.apiKey,
          baseUrl: next.baseUrl,
          model: next.model,
          benchmarkModels: next.benchmarkModels,
          debugEnabled: next.debugEnabled
        },
        envDefaults
      )
    )
  }

  const saveSettings = async () => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      setStatus("chrome.storage.local is unavailable in this context.")
      return
    }

    const normalized = withFlavorDefaults({
      ...settings,
      apiKey: settings.apiKey.trim(),
      baseUrl: settings.baseUrl.trim(),
      model: settings.model.trim()
    })

    await chrome.storage.local.set({
      [TRANSLATION_STORAGE_KEYS.profileId]: normalized.profileId,
      [TRANSLATION_STORAGE_KEYS.providerFlavor]: normalized.providerFlavor,
      [TRANSLATION_STORAGE_KEYS.apiKey]: normalized.apiKey,
      [TRANSLATION_STORAGE_KEYS.baseUrl]: normalized.baseUrl,
      [TRANSLATION_STORAGE_KEYS.model]: normalized.model,
      [TRANSLATION_STORAGE_KEYS.benchmarkModels]: normalized.benchmarkModels.join(","),
      [TRANSLATION_STORAGE_KEYS.debugEnabled]: normalized.debugEnabled
    })
    setSettings(normalized)
    setStatus("Saved.")
  }

  const resetSettings = async () => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      setStatus("chrome.storage.local is unavailable in this context.")
      return
    }

    await chrome.storage.local.remove([
      TRANSLATION_STORAGE_KEYS.profileId,
      TRANSLATION_STORAGE_KEYS.providerFlavor,
      TRANSLATION_STORAGE_KEYS.apiKey,
      TRANSLATION_STORAGE_KEYS.baseUrl,
      TRANSLATION_STORAGE_KEYS.model,
      TRANSLATION_STORAGE_KEYS.benchmarkModels,
      TRANSLATION_STORAGE_KEYS.debugEnabled
    ])
    const envDefaults = await readEnvDefaults("custom")
    setSettings(
      mergeSettings(
        "custom",
        {
          providerFlavor: EMPTY_TRANSLATION_SETTINGS.providerFlavor,
          apiKey: "",
          baseUrl: "",
          model: "",
          benchmarkModels: [...EMPTY_TRANSLATION_SETTINGS.benchmarkModels],
          debugEnabled: EMPTY_TRANSLATION_SETTINGS.debugEnabled
        },
        envDefaults
      )
    )
    setStatus("Cleared.")
  }

  const clearLogs = async () => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      setStatus("chrome.storage.local is unavailable in this context.")
      return
    }
    await chrome.storage.local.set({
      [TRANSLATION_STORAGE_KEYS.debugLogs]: []
    })
    setLogs([])
    setStatus("Troubleshooting logs cleared.")
  }

  const llmLogs = logs.filter(
    (log) =>
      log.event.startsWith("ui_") ||
      log.event.startsWith("provider_") ||
      log.event === "request_succeeded" ||
      log.event === "request_failed"
  )

  const logsWithTrace = llmLogs.filter((log) => typeof log.payload?.traceId === "string" && log.payload.traceId)
  const latestTraceId = logsWithTrace[0]?.payload.traceId as string | undefined
  const latestTraceLogs = latestTraceId
    ? logsWithTrace
        .filter((log) => log.payload.traceId === latestTraceId)
        .sort((a, b) => {
          const tsDiff = Date.parse(a.ts) - Date.parse(b.ts)
          if (tsDiff !== 0) return tsDiff
          const seqDiff = Number(a.seq ?? 0) - Number(b.seq ?? 0)
          if (seqDiff !== 0) return seqDiff
          return String(a.id).localeCompare(String(b.id))
        })
    : []
  const latestTraceStartMs = latestTraceLogs.length > 0 ? Date.parse(latestTraceLogs[0].ts) : 0
  const latestTracePhases: TracePhase[] = latestTraceLogs.map((log) => {
    const payload = log.payload ?? {}
    const model = String(payload.model ?? "-")
    const elapsedMs =
      typeof payload.elapsedMs === "number" ? payload.elapsedMs : Math.max(0, Date.parse(log.ts) - latestTraceStartMs)
    return {
      ts: log.ts,
      event: log.event,
      elapsedMs,
      model
    }
  })
  const llmLogText =
    llmLogs.length === 0
      ? "No troubleshooting logs recorded yet."
      : llmLogs
          .map((log) => {
            const payload = log.payload ?? {}
            const provider = String(payload.provider ?? "-")
            const status = String(payload.status ?? "-")
            const durationMs = String(payload.durationMs ?? "-")
            const ttfbMs = String(payload.ttfbMs ?? "-")
            const requestUrl = String(payload.requestUrl ?? "-")
            const model = String(payload.model ?? "-")
            const translatedPreview = String(payload.translatedPreview ?? payload.responseTextPreview ?? "-")
            const message = String(payload.message ?? payload.bodyPreview ?? "-")
            return [
              `[${log.ts}] ${log.level.toUpperCase()} ${log.event}`,
              `provider=${provider} status=${status} durationMs=${durationMs} ttfbMs=${ttfbMs}`,
              `model=${model}`,
              `requestUrl=${requestUrl}`,
              `translatedPreview=${translatedPreview}`,
              `message=${message}`
            ].join("\n")
          })
          .join("\n\n")
  const copyButtonLabel =
    copyState === "copying"
      ? "Copying logs"
      : copyState === "copied"
        ? "Logs copied"
        : copyState === "error"
          ? "Copy failed"
          : "Copy logs"
  const copyButtonStyle = {
    ...iconButtonStyle,
    background:
      copyState === "copied"
        ? "rgba(255, 177, 100, 0.18)"
        : copyState === "error"
          ? "rgba(184, 88, 88, 0.12)"
          : "rgba(255,255,255,0.82)",
    borderColor:
      copyState === "copied"
        ? "rgba(223, 111, 47, 0.34)"
        : copyState === "error"
          ? "rgba(184, 88, 88, 0.22)"
          : "rgba(111,95,121,0.12)",
    boxShadow:
      copyState === "copied"
        ? `0 8px 20px ${POPUP_ACCENT_SHADOW}`
        : "none",
    color:
      copyState === "copied"
        ? "#8a4b22"
        : copyState === "error"
          ? "#9d4a4a"
          : "#5d5362",
    transition: "all 140ms ease"
  } as const
  const clearButtonLabel =
    clearState === "clearing"
      ? "Clearing logs"
      : clearState === "cleared"
        ? "Logs cleared"
        : clearState === "error"
          ? "Clear failed"
          : "Clear logs"
  const clearButtonStyle = {
    ...iconButtonStyle,
    background:
      clearState === "cleared"
        ? "rgba(255, 177, 100, 0.18)"
        : clearState === "error"
          ? "rgba(184, 88, 88, 0.12)"
          : "rgba(255,255,255,0.82)",
    borderColor:
      clearState === "cleared"
        ? "rgba(223, 111, 47, 0.34)"
        : clearState === "error"
          ? "rgba(184, 88, 88, 0.22)"
          : "rgba(111,95,121,0.12)",
    boxShadow:
      clearState === "cleared"
        ? `0 8px 20px ${POPUP_ACCENT_SHADOW}`
        : "none",
    color:
      clearState === "cleared"
        ? "#8a4b22"
        : clearState === "error"
          ? "#9d4a4a"
          : "#5d5362",
    transition: "all 140ms ease"
  } as const
  const sortedVocabularyEntries = sortVocabularyEntries(vocabularyEntries, vocabularySortOrder)
  const deleteVocabularyEntry = async (entryId: string) => {
    if (vocabularyDeleteState === "deleting") {
      return
    }

    setVocabularyDeleteState("deleting")
    try {
      setVocabularyEntries(await removeVocabularyEntry(entryId))
      setStatus("Vocabulary entry removed.")
    } finally {
      setVocabularyDeleteState("idle")
    }
  }

  return (
    <div
      style={{
        minWidth: 392,
        padding: 14,
        fontFamily: POPUP_FONT_STACK,
        background: "linear-gradient(180deg, #fdfbfd 0%, #f7f3f8 100%)"
      }}>
      <section style={{ ...popSurface, padding: 18, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div>
            <p style={{ color: "#8a7d8f", fontSize: 10, letterSpacing: "0.08em", margin: "0 0 6px", textTransform: "uppercase" }}>
              Translation Plugin
            </p>
            <h2 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 6px", color: "#2f2732" }}>
              Settings
            </h2>
            <p style={{ color: "#665b6c", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              Live flash-card translation with saved runtime config and readable diagnostics.
            </p>
          </div>
          <div
            style={{
              alignSelf: "flex-start",
              background: "rgba(255,255,255,0.72)",
              border: "1px solid rgba(111,95,121,0.12)",
              borderRadius: 999,
              color: "#6f6375",
              fontSize: 11,
              padding: "8px 10px",
              whiteSpace: "nowrap"
            }}>
            zh-CN target
          </div>
        </div>

        <div
          style={{
            background: "rgba(255,255,255,0.62)",
            border: "1px solid rgba(111,95,121,0.08)",
            borderRadius: 14,
            padding: 14,
            marginBottom: 14
          }}>
          <div style={{ display: "grid", gap: 10 }}>
            <label style={fieldLabelStyle}>
              Provider Profile
              <select
                value={settings.profileId}
                onChange={(e) => {
                  updateProfile(e.target.value as TranslationProfileId).catch((error) => {
                    setStatus(error instanceof Error ? error.message : "Failed to switch profile.")
                  })
                }}
                style={inputStyle}
                disabled={loading}>
                <option value="custom">{PROFILE_LABELS.custom}</option>
                <option value="qwen-flash-card">{PROFILE_LABELS["qwen-flash-card"]}</option>
              </select>
            </label>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <label style={fieldLabelStyle}>
                Provider Flavor
                <select
                  value={settings.providerFlavor}
                  onChange={(e) => {
                    updateFieldWithEnvFallback(
                      "providerFlavor",
                      e.target.value as TranslationProviderFlavor
                    ).catch((error) => {
                      setStatus(error instanceof Error ? error.message : "Failed to update provider flavor.")
                    })
                  }}
                  style={inputStyle}
                  disabled={loading || settings.profileId === "qwen-flash-card"}>
                  <option value="openai-compatible">{PROVIDER_LABELS["openai-compatible"]}</option>
                  <option value="anthropic-compatible">{PROVIDER_LABELS["anthropic-compatible"]}</option>
                </select>
              </label>

              <label style={fieldLabelStyle}>
                Model
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => {
                    updateFieldWithEnvFallback("model", e.target.value).catch((error) => {
                      setStatus(error instanceof Error ? error.message : "Failed to update model.")
                    })
                  }}
                  placeholder="gpt-4o-mini"
                  style={inputStyle}
                  disabled={loading || settings.profileId === "qwen-flash-card"}
                />
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={fieldLabelStyle}>
            API Key
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) => updateField("apiKey", e.target.value)}
              placeholder="LLM_API_KEY"
              style={inputStyle}
              disabled={loading}
            />
          </label>

          <label style={fieldLabelStyle}>
            Base URL
            <input
              type="text"
              value={settings.baseUrl}
              onChange={(e) => updateField("baseUrl", e.target.value)}
              placeholder="https://api.openai.com"
              style={inputStyle}
              disabled={loading}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gap: 8,
            marginTop: 14,
            padding: 12,
            borderRadius: 14,
            background: "rgba(255,255,255,0.58)",
            border: "1px solid rgba(111,95,121,0.08)"
          }}>
          <p style={{ color: "#5d5362", fontSize: 12, lineHeight: 1.5, margin: 0 }}>
            {settings.profileId === "qwen-flash-card"
              ? "Display values read storage first, then Qwen env defaults. Runtime requests still use only saved storage values, with qwen-mt-flash fixed."
              : "Display values read storage first, then env.local defaults. Runtime requests use only saved storage values."}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span style={{ background: "rgba(247,243,247,0.94)", border: "1px solid rgba(111,95,121,0.1)", borderRadius: 999, color: "#6d6072", fontSize: 11, padding: "6px 10px" }}>
              Storage drives runtime
            </span>
            <span style={{ background: "rgba(247,243,247,0.94)", border: "1px solid rgba(111,95,121,0.1)", borderRadius: 999, color: "#6d6072", fontSize: 11, padding: "6px 10px" }}>
              Env only fills display
            </span>
          </div>
        </div>
      </section>

      <section style={{ ...popSurface, padding: 16, marginBottom: 12 }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
          <div>
            <p style={{ color: "#a16d42", fontSize: 10, letterSpacing: "0.08em", margin: "0 0 5px", textTransform: "uppercase" }}>
              Pocket Notebook
            </p>
            <h3 style={{ fontSize: 16, margin: "0 0 4px", color: "#2f2732" }}>My Vocabulary</h3>
            <p style={{ color: "#665b6c", fontSize: 12, lineHeight: 1.45, margin: 0 }}>
              Saved flash cards for quick review after browsing.
            </p>
          </div>
          <span
            style={{
              background: "rgba(255, 177, 100, 0.16)",
              border: "1px solid rgba(223, 111, 47, 0.16)",
              borderRadius: 999,
              color: "#8a4b22",
              fontSize: 11,
              fontWeight: 700,
              padding: "7px 10px",
              whiteSpace: "nowrap"
            }}>
            {vocabularyEntries.length} saved
          </span>
        </div>

        <div style={{ alignItems: "center", display: "flex", gap: 8, marginBottom: 12 }}>
          <label style={{ ...fieldLabelStyle, flex: 1, marginBottom: 0 }}>
            Sort
            <select
              data-testid="vocabulary-sort-order"
              value={vocabularySortOrder}
              onChange={(event) => setVocabularySortOrder(event.target.value as VocabularySortOrder)}
              style={inputStyle}>
              <option value="newest">Newest added</option>
              <option value="oldest">Oldest added</option>
              <option value="az">A-Z</option>
              <option value="za">Z-A</option>
            </select>
          </label>
          <button
            onClick={() => {
              loadVocabularyEntries().catch((error) => {
                setStatus(error instanceof Error ? error.message : "Failed to refresh vocabulary.")
              })
            }}
            style={{ ...buttonStyle, alignSelf: "flex-end" }}
            type="button">
            Refresh
          </button>
        </div>

        {sortedVocabularyEntries.length === 0 ? (
          <div
            data-testid="vocabulary-empty-state"
            style={{
              background:
                "radial-gradient(circle at 20% 20%, rgba(255, 177, 100, 0.16), transparent 34%), rgba(255,255,255,0.62)",
              border: "1px dashed rgba(111,95,121,0.18)",
              borderRadius: 16,
              color: "#665b6c",
              fontSize: 12,
              lineHeight: 1.5,
              padding: 14
            }}>
            No saved words yet. Translate a word or short phrase, then tap "Save to notebook" on the card.
          </div>
        ) : (
          <div data-testid="vocabulary-list" style={{ display: "grid", gap: 10, maxHeight: 260, overflow: "auto" }}>
            {sortedVocabularyEntries.map((entry) => (
              <article
                key={entry.id}
                style={{
                  background: "rgba(255,255,255,0.72)",
                  border: "1px solid rgba(111,95,121,0.1)",
                  borderRadius: 16,
                  padding: 12
                }}>
                <div style={{ alignItems: "flex-start", display: "flex", gap: 10, justifyContent: "space-between" }}>
                  <div>
                    <strong
                      data-testid="vocabulary-entry-text"
                      style={{
                        color: "#2f2732",
                        display: "block",
                        fontFamily: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
                        fontSize: 20,
                        lineHeight: 1.15
                      }}>
                      {entry.sourceText}
                    </strong>
                    {entry.phonetic ? (
                      <span style={{ color: "#7a6f80", display: "block", fontSize: 13, marginTop: 4 }}>
                        {entry.phonetic}
                      </span>
                    ) : null}
                  </div>
                  <button
                    aria-label={`Delete ${entry.sourceText}`}
                    data-testid="delete-vocabulary-entry"
                    disabled={vocabularyDeleteState === "deleting"}
                    onClick={() => {
                      deleteVocabularyEntry(entry.id).catch((error) => {
                        setStatus(error instanceof Error ? error.message : "Failed to delete vocabulary entry.")
                        setVocabularyDeleteState("idle")
                      })
                    }}
                    style={iconButtonStyle}
                    title="Delete"
                    type="button">
                    <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
                      <path d="M3.5 4.5h7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
                      <path d="M5 4.5V3.6c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
                      <path d="M4.5 4.5l.5 6.2c.04.42.39.73.81.73h2.4c.42 0 .77-.31.81-.73l.5-6.2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
                    </svg>
                  </button>
                </div>
                {entry.explanation ? (
                  <p style={{ color: "#332b36", fontSize: 13, fontWeight: 600, lineHeight: 1.45, margin: "10px 0 0" }}>
                    {entry.explanation}
                  </p>
                ) : null}
                {entry.literal ? (
                  <p style={{ color: "#7a6f80", fontSize: 11, lineHeight: 1.45, margin: "6px 0 0" }}>
                    Literal: {entry.literal}
                  </p>
                ) : null}
                {entry.example ? (
                  <p style={{ color: "#5f5464", fontSize: 12, lineHeight: 1.5, margin: "8px 0 0" }}>
                    {entry.example}
                  </p>
                ) : null}
                {entry.note ? (
                  <p
                    style={{
                      background: "rgba(255, 177, 100, 0.12)",
                      border: "1px solid rgba(223,111,47,0.12)",
                      borderRadius: 12,
                      color: "#6d4b34",
                      fontSize: 11,
                      lineHeight: 1.45,
                      margin: "8px 0 0",
                      padding: "8px 10px"
                    }}>
                    {entry.note}
                  </p>
                ) : null}
                <p style={{ color: "#8a7d8f", fontSize: 10, margin: "10px 0 0" }}>
                  Added {new Date(entry.createdAt).toLocaleDateString()} · {entry.selectionType}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={{ ...popSurface, padding: 16, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 4px", color: "#2f2732" }}>Diagnostics</h3>
        <p style={{ color: "#665b6c", fontSize: 12, lineHeight: 1.45, margin: "0 0 12px" }}>
          Benchmarks, saved logs, and trace visibility for the latest translation flow.
        </p>

        <label style={{ ...fieldLabelStyle, marginBottom: 10 }}>
          Benchmark Models
          <input
            type="text"
            value={settings.benchmarkModels.join(",")}
            onChange={(e) =>
              updateField(
                "benchmarkModels",
                e.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              )
            }
            placeholder="qwen-mt-plus,qwen-mt-flash,qwen-mt-lite,qwen-mt-turbo"
            style={inputStyle}
            disabled={loading}
          />
        </label>

        <label
          style={{
            alignItems: "center",
            display: "flex",
            fontSize: 12,
            gap: 8,
            marginBottom: 14,
            color: "#4a414f"
          }}>
          <input
            type="checkbox"
            checked={settings.debugEnabled}
            onChange={(e) => updateField("debugEnabled", e.target.checked)}
            disabled={loading}
          />
          Enable troubleshooting logs
        </label>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            onClick={() => {
              saveSettings().catch((error) => {
                setStatus(error instanceof Error ? error.message : "Failed to save.")
              })
            }}
            disabled={loading}
            style={{
              ...buttonStyle,
              background: POPUP_ACCENT_GRADIENT,
              border: "none",
              color: "#fff",
              boxShadow: `0 10px 22px ${POPUP_ACCENT_SHADOW}`
            }}>
            Save
          </button>
          <button
            onClick={() => {
              resetSettings().catch((error) => {
                setStatus(error instanceof Error ? error.message : "Failed to clear.")
              })
            }}
            disabled={loading}
            style={buttonStyle}>
            Clear
          </button>
          <button
            onClick={() => {
              loadTroubleshootingLogs().catch((error) => {
                setStatus(error instanceof Error ? error.message : "Failed to refresh logs.")
              })
            }}
            disabled={loading}
            style={buttonStyle}>
            Refresh Logs
          </button>
          <button
            onClick={() => {
              clearLogs().catch((error) => {
                setStatus(error instanceof Error ? error.message : "Failed to clear logs.")
              })
            }}
            disabled={loading}
            style={buttonStyle}>
            Clear Logs
          </button>
        </div>
      </section>

      <section style={{ ...popSurface, padding: 16 }}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
          <h3 style={{ fontSize: 14, margin: 0, color: "#2f2732" }}>Pipeline & LLM Logs</h3>
          <div style={{ display: "inline-flex", gap: 8 }}>
            <button
              aria-label={clearButtonLabel}
              data-testid="clear-troubleshooting-logs"
              onClick={() => {
                if (clearState === "clearing") {
                  return
                }
                setClearState("clearing")
                clearLogs()
                  .then(() => {
                    setClearState("cleared")
                  })
                  .catch((error) => {
                    setClearState("error")
                    setStatus(error instanceof Error ? error.message : "Failed to clear logs.")
                  })
              }}
              style={clearButtonStyle}
              title={clearButtonLabel}
              type="button">
              {clearState === "cleared" ? (
                <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
                  <path
                    d="M2.5 7.3 5.4 10l6.1-6.4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
              ) : clearState === "error" ? (
                <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
                  <path
                    d="M4 4l6 6M10 4 4 10"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
              ) : (
                <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
                  <path
                    d="M3.5 4.5h7"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M5 4.5V3.6c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v.9"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M4.5 4.5l.5 6.2c.04.42.39.73.81.73h2.4c.42 0 .77-.31.81-.73l.5-6.2"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.2"
                  />
                </svg>
              )}
            </button>
            <button
              aria-label={copyButtonLabel}
              data-testid="copy-troubleshooting-logs"
              onClick={() => {
                if (copyState === "copying") {
                  return
                }
                setCopyState("copying")
                copyTextToClipboard(llmLogText)
                  .then(() => {
                    setCopyState("copied")
                    setStatus("Logs copied.")
                  })
                  .catch((error) => {
                    setCopyState("error")
                    setStatus(error instanceof Error ? error.message : "Failed to copy logs.")
                  })
              }}
              style={copyButtonStyle}
              title={copyButtonLabel}
              type="button">
              {copyState === "copied" ? (
                <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
                  <path
                    d="M2.5 7.3 5.4 10l6.1-6.4"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.6"
                  />
                </svg>
              ) : copyState === "error" ? (
                <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
                  <path
                    d="M4 4l6 6M10 4 4 10"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                </svg>
              ) : (
                <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
                  <rect fill="none" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" width="8" x="4" y="2.5" />
                  <rect fill="none" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" width="8" x="2" y="4.5" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <p style={{ color: "#665b6c", fontSize: 11, lineHeight: 1.45, margin: "0 0 10px" }}>
          Latest trace phases plus raw provider/UI events with timing and previews.
        </p>
        <div
          data-testid="troubleshooting-phase-breakdown"
          style={{
            background: "#f8f5f8",
            border: "1px solid rgba(111,95,121,0.1)",
            borderRadius: 14,
            color: "#322a35",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            lineHeight: 1.42,
            marginBottom: 10,
            maxHeight: 150,
            overflow: "auto",
            padding: 10
          }}>
          {latestTracePhases.length === 0
            ? "No trace timeline yet."
            : [`traceId=${latestTraceId}`]
                .concat(
                  latestTracePhases.map(
                    (phase) =>
                      `[${phase.ts}] +${phase.elapsedMs}ms ${phase.event} model=${phase.model}`
                  )
                )
                .join("\n")}
        </div>
        <div
          data-testid="troubleshooting-log-output"
          style={{
            background: "#221d24",
            borderRadius: 14,
            color: "#f4eef6",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            lineHeight: 1.48,
            maxHeight: 280,
            overflow: "auto",
            padding: 12,
            whiteSpace: "pre-wrap"
          }}>
          {llmLogText}
        </div>
      </section>

      {status ? (
        <p style={{ color: "#5d5362", fontSize: 11, margin: "10px 4px 0" }}>{status}</p>
      ) : null}
    </div>
  )
}

export default IndexPopup
