import { useEffect, useState } from "react"
import type {
  TranslationEnvDefaultsResponse,
  TranslationProviderFlavor
} from "./lib/translation-contract"
import {
  DEFAULT_DEBUG_ENABLED,
  EMPTY_TRANSLATION_SETTINGS,
  TRANSLATION_STORAGE_KEYS,
  withFlavorDefaults,
  type TranslationDebugLogEntry,
  type TranslationProfileId,
  type TranslationSettings
} from "./lib/translation-settings"

const PROVIDER_LABELS: Record<TranslationProviderFlavor, string> = {
  "openai-compatible": "OpenAI-compatible",
  "anthropic-compatible": "Anthropic-compatible"
}

const PROFILE_LABELS: Record<TranslationProfileId, string> = {
  custom: "Custom",
  "qwen-flash-card": "Qwen Flash Card"
}

type TracePhase = {
  ts: string
  event: string
  elapsedMs: number
  model: string
}

function IndexPopup() {
  const [settings, setSettings] = useState<TranslationSettings>(EMPTY_TRANSLATION_SETTINGS)
  const [logs, setLogs] = useState<TranslationDebugLogEntry[]>([])
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)

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
        model: model ?? (profileId === "qwen-flash-card" ? "qwen-mt-flash" : "")
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
        Provider Profile
        <select
          value={settings.profileId}
          onChange={(e) => {
            updateProfile(e.target.value as TranslationProfileId).catch((error) => {
              setStatus(error instanceof Error ? error.message : "Failed to switch profile.")
            })
          }}
          style={{ boxSizing: "border-box", marginTop: 4, padding: 8, width: "100%" }}
          disabled={loading}>
          <option value="custom">{PROFILE_LABELS.custom}</option>
          <option value="qwen-flash-card">{PROFILE_LABELS["qwen-flash-card"]}</option>
        </select>
      </label>

      <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
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
          style={{ boxSizing: "border-box", marginTop: 4, padding: 8, width: "100%" }}
          disabled={loading || settings.profileId === "qwen-flash-card"}>
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
          onChange={(e) => {
            updateFieldWithEnvFallback("model", e.target.value).catch((error) => {
              setStatus(error instanceof Error ? error.message : "Failed to update model.")
            })
          }}
          placeholder="gpt-4o-mini"
          style={{ boxSizing: "border-box", marginTop: 4, padding: 8, width: "100%" }}
          disabled={loading || settings.profileId === "qwen-flash-card"}
        />
      </label>

      {settings.profileId === "qwen-flash-card" ? (
        <p style={{ color: "#5f646d", fontSize: 11, margin: "0 0 10px" }}>
          UI fields read storage first and then Qwen env defaults for display. Runtime requests still use only saved storage values. Model is fixed to `qwen-mt-flash`.
        </p>
      ) : null}
      {settings.profileId === "custom" ? (
        <p style={{ color: "#5f646d", fontSize: 11, margin: "0 0 10px" }}>
          UI fields read storage first and then env.local defaults for display. Runtime requests use only saved storage values.
        </p>
      ) : null}

      <label style={{ display: "block", fontSize: 12, marginBottom: 10 }}>
        Benchmark Models (comma-separated)
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
        <h3 style={{ fontSize: 14, margin: "0 0 6px" }}>Pipeline & LLM Logs</h3>
        <p style={{ color: "#5f646d", fontSize: 11, margin: "0 0 8px" }}>
          Shows UI stages + provider events, with status, timing (`elapsedMs`/`durationMs`), and previews.
        </p>
        <div
          data-testid="troubleshooting-phase-breakdown"
          style={{
            background: "#f4f6fb",
            border: "1px solid #dde2f0",
            borderRadius: 8,
            color: "#2b3142",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 11,
            lineHeight: 1.35,
            marginBottom: 8,
            maxHeight: 140,
            overflow: "auto",
            padding: 8
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
                .join("\n\n")}
        </div>
      </section>

      <p style={{ color: "#5f646d", fontSize: 12, margin: "10px 0 0" }}>{status}</p>
    </div>
  )
}

export default IndexPopup
