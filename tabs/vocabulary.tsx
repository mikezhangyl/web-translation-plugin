import { useEffect, useState } from "react"
import {
  getActiveVocabularyEntries,
  getDeletedVocabularyEntries,
  readVocabularyEntries,
  removeVocabularyEntry,
  sortVocabularyEntries,
  VOCABULARY_TRASH_RETENTION_DAYS,
  type VocabularyEntry,
  type VocabularySortOrder
} from "../lib/vocabulary-history"

type NotebookView = "notebook" | "trash"

const fontStack = "'Avenir Next', 'Segoe UI', 'Helvetica Neue', sans-serif"
const serifStack = "'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
const accentGradient = "linear-gradient(135deg, #ffb164 0%, #ff8d47 56%, #df6f2f 100%)"
const pageBackground =
  "radial-gradient(circle at 12% 8%, rgba(255, 177, 100, 0.24), transparent 28%), radial-gradient(circle at 86% 12%, rgba(99, 150, 136, 0.14), transparent 30%), linear-gradient(135deg, #fff8ef 0%, #f7f1ea 46%, #f4eee8 100%)"

const surfaceStyle = {
  background: "rgba(255, 252, 247, 0.78)",
  border: "1px solid rgba(120, 92, 62, 0.14)",
  borderRadius: 28,
  boxShadow: "0 24px 70px rgba(72, 49, 28, 0.12)"
} as const

const buttonStyle = {
  border: "1px solid rgba(120, 92, 62, 0.14)",
  borderRadius: 14,
  background: "rgba(255,255,255,0.76)",
  color: "#44362a",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  padding: "10px 13px"
} as const

const inputStyle = {
  background: "rgba(255,255,255,0.84)",
  border: "1px solid rgba(120, 92, 62, 0.14)",
  borderRadius: 16,
  boxSizing: "border-box" as const,
  color: "#2f281f",
  fontSize: 14,
  outline: "none",
  padding: "12px 14px",
  width: "100%"
}

const matchesVocabularyQuery = (entry: VocabularyEntry, query: string) => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }

  return [
    entry.sourceText,
    entry.normalizedText,
    entry.translation,
    entry.explanation,
    entry.example,
    entry.literal,
    entry.note,
    entry.contextText,
    entry.sourceTitle
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
}

function VocabularyPage() {
  const [entries, setEntries] = useState<VocabularyEntry[]>([])
  const [sortOrder, setSortOrder] = useState<VocabularySortOrder>("newest")
  const [query, setQuery] = useState("")
  const [view, setView] = useState<NotebookView>("notebook")
  const [selectedId, setSelectedId] = useState("")
  const [status, setStatus] = useState("")

  const loadEntries = async () => {
    setEntries(await readVocabularyEntries())
  }

  useEffect(() => {
    loadEntries().catch((error) => {
      setStatus(error instanceof Error ? error.message : "Failed to load vocabulary.")
    })
  }, [])

  const activeEntries = getActiveVocabularyEntries(entries)
  const deletedEntries = getDeletedVocabularyEntries(entries)
  const filteredEntries = sortVocabularyEntries(
    activeEntries.filter((entry) => matchesVocabularyQuery(entry, query)),
    sortOrder
  )
  const selectedEntry =
    filteredEntries.find((entry) => entry.id === selectedId) ?? filteredEntries[0] ?? null
  const sortedDeletedEntries = sortVocabularyEntries(deletedEntries, "newest")

  const moveToTrash = async (entry: VocabularyEntry) => {
    const nextEntries = await removeVocabularyEntry(entry.id)
    setEntries(nextEntries)
    setSelectedId("")
    setStatus(`${entry.sourceText} moved to trash.`)
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: pageBackground,
        color: "#2f281f",
        fontFamily: fontStack,
        padding: "34px clamp(18px, 4vw, 52px)"
      }}>
      <section
        style={{
          display: "grid",
          gap: 24,
          margin: "0 auto",
          maxWidth: 1180
        }}>
        <header
          style={{
            alignItems: "end",
            display: "grid",
            gap: 18,
            gridTemplateColumns: "minmax(0, 1fr) auto"
          }}>
          <div>
            <p
              style={{
                color: "#9b6b3f",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                margin: "0 0 10px",
                textTransform: "uppercase"
              }}>
              Study Space
            </p>
            <h1
              style={{
                fontFamily: serifStack,
                fontSize: "clamp(38px, 6vw, 72px)",
                letterSpacing: "-0.055em",
                lineHeight: 0.95,
                margin: 0
              }}>
              Vocabulary Notebook
            </h1>
            <p style={{ color: "#6d5c4c", fontSize: 15, lineHeight: 1.6, margin: "14px 0 0", maxWidth: 680 }}>
              A roomy review desk for words saved while reading. Keep the popup light; study here.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              data-testid="notebook-view-trash"
              onClick={() => setView("trash")}
              style={{
                ...buttonStyle,
                background: view === "trash" ? "rgba(255, 177, 100, 0.22)" : buttonStyle.background
              }}
              type="button">
              Trash
            </button>
            <button
              disabled
              style={{
                ...buttonStyle,
                background: "rgba(255,255,255,0.42)",
                color: "#9d8b78",
                cursor: "not-allowed"
              }}
              type="button">
              Review coming later
            </button>
          </div>
        </header>

        {status ? (
          <div
            style={{
              ...surfaceStyle,
              borderRadius: 18,
              color: "#7a4d2a",
              fontSize: 13,
              padding: "10px 14px"
            }}>
            {status}
          </div>
        ) : null}

        {view === "trash" ? (
          <section style={{ ...surfaceStyle, padding: 24 }}>
            <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 18 }}>
              <div>
                <p style={{ color: "#9b6b3f", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", margin: "0 0 8px", textTransform: "uppercase" }}>
                  Recycle Bin
                </p>
                <h2 style={{ fontSize: 30, letterSpacing: "-0.03em", margin: 0 }}>Trash</h2>
                <p style={{ color: "#6d5c4c", fontSize: 14, lineHeight: 1.55, margin: "8px 0 0" }}>
                  Permanently deletes after {VOCABULARY_TRASH_RETENTION_DAYS} days.
                </p>
              </div>
              <button onClick={() => setView("notebook")} style={buttonStyle} type="button">
                Back to notebook
              </button>
            </div>
            {sortedDeletedEntries.length === 0 ? (
              <p style={{ color: "#6d5c4c", margin: "24px 0 0" }}>Trash is empty.</p>
            ) : (
              <div data-testid="notebook-trash-list" style={{ display: "grid", gap: 12, marginTop: 22 }}>
                {sortedDeletedEntries.map((entry) => (
                  <article
                    key={entry.id}
                    style={{
                      background: "rgba(255,255,255,0.64)",
                      border: "1px solid rgba(120, 92, 62, 0.12)",
                      borderRadius: 18,
                      padding: 16
                    }}>
                    <strong style={{ display: "block", fontFamily: serifStack, fontSize: 24 }}>
                      {entry.sourceText}
                    </strong>
                    <p style={{ color: "#5d5146", fontSize: 14, margin: "8px 0 0" }}>
                      {entry.explanation || entry.translation}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : (
          <section
            style={{
              display: "grid",
              gap: 18,
              gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)"
            }}>
            <aside style={{ ...surfaceStyle, padding: 18 }}>
              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                <input
                  data-testid="notebook-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search words, meanings, examples..."
                  style={inputStyle}
                  type="search"
                  value={query}
                />
                <select
                  data-testid="notebook-sort-order"
                  onChange={(event) => setSortOrder(event.target.value as VocabularySortOrder)}
                  style={inputStyle}
                  value={sortOrder}>
                  <option value="newest">Newest added</option>
                  <option value="oldest">Oldest added</option>
                  <option value="az">A-Z</option>
                  <option value="za">Z-A</option>
                </select>
              </div>

              {filteredEntries.length === 0 ? (
                <div
                  data-testid="notebook-empty-state"
                  style={{
                    border: "1px dashed rgba(120, 92, 62, 0.18)",
                    borderRadius: 18,
                    color: "#6d5c4c",
                    fontSize: 14,
                    lineHeight: 1.55,
                    padding: 16
                  }}>
                  No words match this notebook view.
                </div>
              ) : (
                <div data-testid="notebook-entry-list" style={{ display: "grid", gap: 10 }}>
                  {filteredEntries.map((entry) => {
                    const active = selectedEntry?.id === entry.id
                    return (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedId(entry.id)}
                        style={{
                          background: active ? "rgba(255, 177, 100, 0.2)" : "rgba(255,255,255,0.64)",
                          border: active
                            ? "1px solid rgba(223,111,47,0.32)"
                            : "1px solid rgba(120, 92, 62, 0.1)",
                          borderRadius: 18,
                          color: "#2f281f",
                          cursor: "pointer",
                          padding: 14,
                          textAlign: "left"
                        }}
                        type="button">
                        <strong
                          data-testid="notebook-entry-text"
                          style={{ display: "block", fontFamily: serifStack, fontSize: 23, lineHeight: 1.1 }}>
                          {entry.sourceText}
                        </strong>
                        <span style={{ color: "#7b6957", display: "block", fontSize: 12, marginTop: 6 }}>
                          {entry.phonetic || "No phonetic"} · {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </aside>

            <article style={{ ...surfaceStyle, minHeight: 520, padding: "clamp(24px, 4vw, 42px)" }}>
              {selectedEntry ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
                    <div>
                      <p style={{ color: "#9b6b3f", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", margin: "0 0 8px", textTransform: "uppercase" }}>
                        Word Detail
                      </p>
                      <h2
                        data-testid="notebook-detail-title"
                        style={{
                          fontFamily: serifStack,
                          fontSize: "clamp(42px, 6vw, 78px)",
                          letterSpacing: "-0.055em",
                          lineHeight: 0.95,
                          margin: 0
                        }}>
                        {selectedEntry.sourceText}
                      </h2>
                      {selectedEntry.phonetic ? (
                        <p
                          data-testid="notebook-detail-phonetic"
                          style={{ color: "#7b6957", fontSize: 18, margin: "12px 0 0" }}>
                          {selectedEntry.phonetic}
                        </p>
                      ) : null}
                    </div>
                    <button
                      aria-label={`Move ${selectedEntry.sourceText} to trash`}
                      onClick={() => {
                        moveToTrash(selectedEntry).catch((error) => {
                          setStatus(error instanceof Error ? error.message : "Failed to move word to trash.")
                        })
                      }}
                      style={{ ...buttonStyle, alignSelf: "start" }}
                      type="button">
                      Delete
                    </button>
                  </div>

                  <section style={{ display: "grid", gap: 16, marginTop: 34 }}>
                    <div>
                      <p style={{ color: "#9b6b3f", fontSize: 12, fontWeight: 800, letterSpacing: "0.1em", margin: "0 0 8px", textTransform: "uppercase" }}>
                        Meaning
                      </p>
                      <p style={{ color: "#2f281f", fontSize: 22, fontWeight: 700, lineHeight: 1.45, margin: 0 }}>
                        {selectedEntry.explanation || selectedEntry.translation}
                      </p>
                    </div>
                    {selectedEntry.literal ? (
                      <p style={{ color: "#6d5c4c", fontSize: 14, lineHeight: 1.55, margin: 0 }}>
                        Literal: {selectedEntry.literal}
                      </p>
                    ) : null}
                    {selectedEntry.note ? (
                      <p
                        style={{
                          background: "rgba(255, 177, 100, 0.14)",
                          border: "1px solid rgba(223,111,47,0.14)",
                          borderRadius: 18,
                          color: "#68462e",
                          fontSize: 14,
                          lineHeight: 1.6,
                          margin: 0,
                          padding: 14
                        }}>
                        {selectedEntry.note}
                      </p>
                    ) : null}
                    {selectedEntry.example ? (
                      <blockquote
                        style={{
                          borderLeft: "4px solid rgba(223,111,47,0.32)",
                          color: "#4d4339",
                          fontFamily: serifStack,
                          fontSize: 24,
                          lineHeight: 1.4,
                          margin: 0,
                          padding: "4px 0 4px 18px"
                        }}>
                        {selectedEntry.example}
                      </blockquote>
                    ) : null}
                    {selectedEntry.contextText ? (
                      <p style={{ color: "#6d5c4c", fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                        Context: {selectedEntry.contextText}
                      </p>
                    ) : null}
                    <p style={{ color: "#8a7a68", fontSize: 12, margin: 0 }}>
                      Added {new Date(selectedEntry.createdAt).toLocaleDateString()}
                      {selectedEntry.sourceTitle ? ` · ${selectedEntry.sourceTitle}` : ""}
                    </p>
                  </section>
                </>
              ) : (
                <div style={{ color: "#6d5c4c", fontSize: 16, lineHeight: 1.6 }}>
                  Save a flash-card word from the translation card, then study it here.
                </div>
              )}
            </article>
          </section>
        )}
      </section>
    </main>
  )
}

export default VocabularyPage
