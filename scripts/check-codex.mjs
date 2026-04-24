import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export const parseTomlStringField = (contents, key) => {
  const match = contents.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"))
  return match?.[1] ?? null
}

export const parseAgentEntries = (configContents) => {
  const entries = []
  let currentRoleName = null
  let currentBody = []

  const flushCurrentEntry = () => {
    if (!currentRoleName) {
      return
    }

    entries.push({
      roleName: currentRoleName,
      configFile: parseTomlStringField(currentBody.join("\n"), "config_file")
    })
  }

  for (const line of configContents.split(/\r?\n/)) {
    const sectionMatch = line.match(/^\[agents\.([^\]]+)\]$/)
    if (sectionMatch) {
      flushCurrentEntry()
      currentRoleName = sectionMatch[1]
      currentBody = []
      continue
    }

    if (currentRoleName) {
      currentBody.push(line)
    }
  }

  flushCurrentEntry()

  return entries
}

export const runCheckCodex = (repoRoot = process.cwd()) => {
  const codexRoot = path.join(repoRoot, ".codex")
  const agentsRoot = path.join(codexRoot, "agents")
  const failures = []

  const fail = (message) => {
    failures.push(message)
  }

  const readText = (relativePath) =>
    readFileSync(path.join(repoRoot, relativePath), "utf8")

  const checkRequiredFile = (relativePath) => {
    const absolutePath = path.join(repoRoot, relativePath)
    if (!existsSync(absolutePath)) {
      fail(`Missing Codex file: ${relativePath}`)
      return false
    }
    return true
  }

  const checkCodexConfig = () => {
    const configPath = ".codex/config.toml"
    if (!checkRequiredFile(configPath)) {
      return []
    }

    const contents = readText(configPath)
    if (/\bpersistent_instructions\s*=/.test(contents)) {
      fail(".codex/config.toml uses unsupported persistent_instructions; use developer_instructions.")
    }
    if (!/\bdeveloper_instructions\s*=/.test(contents)) {
      fail(".codex/config.toml is missing developer_instructions.")
    }
    if (!/\[features\][\s\S]*?\bmulti_agent\s*=\s*true/.test(contents)) {
      fail(".codex/config.toml must enable features.multi_agent for repo-local delegation.")
    }

    return parseAgentEntries(contents)
  }

  const checkAgentFile = (relativePath, expectedName) => {
    if (!checkRequiredFile(relativePath)) {
      return
    }

    const contents = readText(relativePath)
    const name = parseTomlStringField(contents, "name")
    const description = parseTomlStringField(contents, "description")
    const developerInstructionsMatch = contents.match(/^developer_instructions\s*=\s*"""\n[\s\S]+?\n"""/m)

    if (!name) {
      fail(`${relativePath} is missing name.`)
    } else if (name !== expectedName) {
      fail(`${relativePath} name is ${name}; expected ${expectedName}.`)
    }
    if (!description) {
      fail(`${relativePath} is missing description.`)
    }
    if (!developerInstructionsMatch) {
      fail(`${relativePath} is missing developer_instructions.`)
    }
  }

  const configuredAgents = checkCodexConfig()

  if (!existsSync(agentsRoot)) {
    fail("Missing .codex/agents directory.")
  } else {
    const configuredFiles = new Set()
    for (const { roleName, configFile } of configuredAgents) {
      if (!configFile) {
        fail(`.codex/config.toml agent ${roleName} is missing config_file.`)
        continue
      }
      const relativePath = path.join(".codex", configFile)
      configuredFiles.add(relativePath)
      checkAgentFile(relativePath, roleName)
    }

    for (const entry of readdirSync(agentsRoot, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".toml")) {
        continue
      }
      const relativePath = path.join(".codex", "agents", entry.name)
      if (!configuredFiles.has(relativePath)) {
        const expectedName = path.basename(entry.name, ".toml").replace(/-/g, "_")
        checkAgentFile(relativePath, expectedName)
      }
    }
  }

  return failures
}

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isMainModule) {
  const failures = runCheckCodex()

  if (failures.length > 0) {
    console.error("[check-codex] FAIL")
    for (const message of failures) {
      console.error(`- ${message}`)
    }
    process.exit(1)
  }

  console.log("[check-codex] PASS")
}
