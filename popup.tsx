import { useEffect, useState } from "react"
import type { TranslationProviderFlavor } from "./lib/translation-contract"
import {
  DEFAULT_DEBUG_ENABLED,
  EMPTY_TRANSLATION_SETTINGS,
  TRANSLATION_STORAGE_KEYS,
  withFlavorDefaults,
  type TranslationDebugLogEntry,
  type TranslationSettings
} from "./lib/translation-settings"

const PROVIDER_LABELS: Record<TranslationProviderFlavor, string> = {
  "openai-compatible": "OpenAI-compatible",
  "anthropic-compatible": "Anthropic-compatible"
}

function IndexPopup() {
  const [settings, setSettings] = useState<TranslationSettings>(EMPTY_TRANSLATION_SETTINGS)
  const [logs, setLogs] = useState<TranslationDebugLogEntry[]>([])
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)

  const loadTroubleshootingLogs = async () => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) {
      return
    }
    const values = await chrome.storage.local.get([TRANSLATION_STORAGE_KEYS.debugLogs])
    const rawLogs = values[TRANSLATION_STORAGE_KEYS.debugLogs]
    const parsedLogs = Array.isArray(rawLogs) ? (rawLogs as TranslationDebugLogEntry[]) : []
    setLogs(parsedLogs.slice(-60).reverse())
  }

  useEffect(() => {
    const load = async () => {
      if (typeof chrome === "undefined" || !chrome.storage?.local) {
        setStatus("chrome.storage.local is unavailable in this context.")
        setLoading(false)
        return
      }

      const values = await chrome.storage.local.get([
        TRANSLATION_STORAGE_KEYS.providerFlavor,
        TRANSLATION_STORAGE_KEYS.apiKey,
        TRANSLATION_STORAGE_KEYS.baseUrl,
        TRANSLATION_STORAGE_KEYS.model,
        TRANSLATION_STORAGE_KEYS.debugEnabled
      ])

      const providerFlavor =
        values[TRANSLATION_STORAGE_KEYS.providerFlavor] === "anthropic-compatible"
          ? "anthropic-compatible"
          : "openai-compatible"

      setSettings(
        withFlavorDefaults({
          providerFlavor,
          apiKey: String(values[TRANSLATION_STORAGE_KEYS.apiKey] ?? ""),
          baseUrl: String(values[TRANSLATION_STORAGE_KEYS.baseUrl] ?? "").trim(),
          model: String(values[TRANSLATION_STORAGE_KEYS.model] ?? "").trim(),
          debugEnabled:
            values[TRANSLATION_STORAGE_KEYS.debugEnabled] === undefined
              ? DEFAULT_DEBUG_ENABLED
              : values[TRANSLATION_STORAGE_KEYS.debugEnabled] !== false
        })
      )
      await loadTroubleshootingLogs()
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

  const updateField = <K extends keyof TranslationSettings>(key: K, value: TranslationSettings[K]) => {
    setSettings((prev) => withFlavorDefaults({ ...prev, [key]: value }))
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
      [TRANSLATION_STORAGE_KEYS.providerFlavor]: normalized.providerFlavor,
      [TRANSLATION_STORAGE_KEYS.apiKey]: normalized.apiKey,
      [TRANSLATION_STORAGE_KEYS.baseUrl]: normalized.baseUrl,
      [TRANSLATION_STORAGE_KEYS.model]: normalized.model,
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
      TRANSLATION_STORAGE_KEYS.providerFlavor,
      TRANSLATION_STORAGE_KEYS.apiKey,
      TRANSLATION_STORAGE_KEYS.baseUrl,
      TRANSLATION_STORAGE_KEYS.model,
      TRANSLATION_STORAGE_KEYS.debugEnabled
    ])
    setSettings(EMPTY_TRANSLATION_SETTINGS)
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
      log.event.startsWith("provider_") ||
      log.event === "request_succeeded" ||
      log.event === "request_failed"
  )

  return (
    <div
      style={{
        minWidth: 380,
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}>
      <h2 style={{ fontSize: 18, margin: "0 0 10px" }}>Translation Settings</h2>
      <p style={{ color: "#5f646d", fontSize: 12, margin: "0 0 14px" }}>
        LLM-only providers. Target language is fixed to zh-CN.
      </p>

      <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
        Provider Flavor
        <select
          value={settings.providerFlavor}
          onChange={(e) => updateField("providerFlavor", e.target.value as TranslationProviderFlavor)}
          style={{ boxSizing: "border-box", marginTop: 4, padding: 8, width: "100%" }}
          disabled={loading}>
          <option value="openai-compatible">{PROVIDER_LABELS["openai-compatible"]}</option>
          <option value="anthropic-compatible">{PROVIDER_LABELS["anthropic-compatible"]}</option>
        </select>
      </label>

      <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
        API Key
        <input
          type="password"
          value={settings.apiKey}
          onChange={(e) => updateField("apiKey", e.target.value)}
          placeholder="LLM_API_KEY"
          style={{ boxSizing: "border-box", marginTop: 4, padding: 8, width: "100%" }}
          disabled={loading}
        />
      </label>

      <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
        Base URL
        <input
          type="text"
          value={settings.baseUrl}
          onChange={(e) => updateField("baseUrl", e.target.value)}
          placeholder="https://api.openai.com"
          style={{ boxSizing: "border-box", marginTop: 4, padding: 8, width: "100%" }}
          disabled={loading}
        />
      </label>

      <label style={{ display: "block", fontSize: 12, marginBottom: 10 }}>
        Model
        <input
          type="text"
          value={settings.model}
          onChange={(e) => updateField("model", e.target.value)}
          placeholder="gpt-4o-mini"
          style={{ boxSizing: "border-box", marginTop: 4, padding: 8, width: "100%" }}
          disabled={loading}
        />
      </label>

      <label
        style={{
          alignItems: "center",
          display: "flex",
          fontSize: 12,
          gap: 8,
          marginBottom: 14
        }}>
        <input
          type="checkbox"
          checked={settings.debugEnabled}
          onChange={(e) => updateField("debugEnabled", e.target.checked)}
          disabled={loading}
        />
        Enable troubleshooting logs (default ON)
      </label>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => {
            saveSettings().catch((error) => {
              setStatus(error instanceof Error ? error.message : "Failed to save.")
            })
          }}
          disabled={loading}
          style={{ padding: "8px 12px" }}>
          Save
        </button>
        <button
          onClick={() => {
            resetSettings().catch((error) => {
              setStatus(error instanceof Error ? error.message : "Failed to clear.")
            })
          }}
          disabled={loading}
          style={{ padding: "8px 12px" }}>
          Clear
        </button>
        <button
          onClick={() => {
            loadTroubleshootingLogs().catch((error) => {
              setStatus(error instanceof Error ? error.message : "Failed to refresh logs.")
            })
          }}
          disabled={loading}
          style={{ padding: "8px 12px" }}>
          Refresh Logs
        </button>
        <button
          onClick={() => {
            clearLogs().catch((error) => {
              setStatus(error instanceof Error ? error.message : "Failed to clear logs.")
            })
          }}
          disabled={loading}
          style={{ padding: "8px 12px" }}>
          Clear Logs
        </button>
      </div>

      <section style={{ marginTop: 8 }}>
        <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>LLM Interaction Logs</h3>
        <p style={{ color: "#5f646d", fontSize: 11, margin: "0 0 8px" }}>
          Shows provider events, response status, timing (`durationMs`), and previews.
        </p>
        <div
          data-testid="troubleshooting-log-output"
          style={{
            background: "#0f1220",
            borderRadius: 8,
            color: "#dce2ff",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            lineHeight: 1.4,
            maxHeight: 220,
            overflow: "auto",
            padding: 10,
            whiteSpace: "pre-wrap"
          }}>
          {llmLogs.length === 0
            ? "No LLM interaction logs yet."
            : llmLogs
                .map((log) => {
                  const payload = log.payload ?? {}
                  const provider = String(payload.provider ?? "-")
                  const status = String(payload.status ?? "-")
                  const durationMs = String(payload.durationMs ?? "-")
                  const requestUrl = String(payload.requestUrl ?? "-")
                  const model = String(payload.model ?? "-")
                  const translatedPreview = String(payload.translatedPreview ?? payload.responseTextPreview ?? "-")
                  const message = String(payload.message ?? payload.bodyPreview ?? "-")
                  return [
                    `[${log.ts}] ${log.level.toUpperCase()} ${log.event}`,
                    `provider=${provider} status=${status} durationMs=${durationMs}`,
                    `model=${model}`,
                    `requestUrl=${requestUrl}`,
                    `translatedPreview=${translatedPreview}`,
                    `message=${message}`
                  ].join("\n")
                })
                .join("\n\n")}
        </div>
      </section>

      <p style={{ color: "#5f646d", fontSize: 12, margin: "10px 0 0" }}>{status}</p>
    </div>
  )
}

export default IndexPopup
