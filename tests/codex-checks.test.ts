import assert from "node:assert/strict"
import test from "node:test"

import { parseAgentEntries } from "../scripts/check-codex.mjs"
import { checkSessionInventory } from "../scripts/check-memory.mjs"

test("parseAgentEntries includes the final agent block in .codex/config.toml", () => {
  const configContents = `
[agents]
max_threads = 6

[agents.explorer]
description = "Explorer"
config_file = "agents/explorer.toml"

[agents.reviewer]
description = "Reviewer"
config_file = "agents/reviewer.toml"

[agents.docs_researcher]
description = "Docs"
config_file = "agents/docs-researcher.toml"
`.trim()

  assert.deepEqual(parseAgentEntries(configContents), [
    {
      roleName: "explorer",
      configFile: "agents/explorer.toml"
    },
    {
      roleName: "reviewer",
      configFile: "agents/reviewer.toml"
    },
    {
      roleName: "docs_researcher",
      configFile: "agents/docs-researcher.toml"
    }
  ])
})

test("checkSessionInventory rejects newer stale session logs than the active pointer", () => {
  const failures = checkSessionInventory(
    ["codex/logs/session-001.md", "codex/logs/session-002.md"],
    "codex/logs/session-001.md"
  )

  assert.deepEqual(failures, [
    "Found newer session log than codex/current-session.md points to: codex/logs/session-002.md"
  ])
})

test("checkSessionInventory rejects gaps before the active session pointer", () => {
  const failures = checkSessionInventory(
    ["codex/logs/session-001.md", "codex/logs/session-003.md"],
    "codex/logs/session-003.md"
  )

  assert.deepEqual(failures, [
    "Missing session log before active pointer: codex/logs/session-002.md"
  ])
})
