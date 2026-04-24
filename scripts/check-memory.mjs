import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const expectedTemplate = `## Step N

### User Instruction
<RAW user instruction, DO NOT rewrite>

### Understanding
...

### Plan
...

### Actions Taken
...

### Validation
...

### Result
...`

const requiredSections = [
  "### User Instruction",
  "### Understanding",
  "### Plan",
  "### Actions Taken",
  "### Validation",
  "### Result"
]

export const parseSessionFileNumber = (relativePath) => {
  const match = relativePath.match(/^codex\/logs\/session-(\d{3})\.md$/)
  return match ? Number(match[1]) : null
}

export const checkSessionInventory = (sessionFiles, currentSessionFile) => {
  const failures = []
  const currentSessionNumber = parseSessionFileNumber(currentSessionFile)

  if (currentSessionNumber === null) {
    failures.push(`Invalid current session file path: ${currentSessionFile}`)
    return failures
  }

  const parsedNumbers = sessionFiles.map((relativePath) => ({
    relativePath,
    sessionNumber: parseSessionFileNumber(relativePath)
  }))

  for (const { relativePath, sessionNumber } of parsedNumbers) {
    if (sessionNumber === null) {
      failures.push(`Unexpected memory log file name: ${relativePath}`)
    }
  }

  const validNumbers = parsedNumbers
    .map(({ sessionNumber }) => sessionNumber)
    .filter((sessionNumber) => sessionNumber !== null)
    .sort((left, right) => left - right)

  if (!validNumbers.includes(currentSessionNumber)) {
    failures.push(`codex/current-session.md points to missing session log: ${currentSessionFile}`)
  }

  for (let expectedNumber = 1; expectedNumber <= currentSessionNumber; expectedNumber += 1) {
    if (!validNumbers.includes(expectedNumber)) {
      failures.push(
        `Missing session log before active pointer: codex/logs/session-${String(expectedNumber).padStart(3, "0")}.md`
      )
    }
  }

  for (const actualNumber of validNumbers) {
    if (actualNumber > currentSessionNumber) {
      failures.push(
        `Found newer session log than codex/current-session.md points to: codex/logs/session-${String(actualNumber).padStart(3, "0")}.md`
      )
    }
  }

  return failures
}

export const runCheckMemory = (repoRoot = process.cwd()) => {
  const failures = []

  const fail = (message) => {
    failures.push(message)
  }

  const readText = (relativePath) =>
    readFileSync(path.join(repoRoot, relativePath), "utf8")

  const checkRequiredFile = (relativePath) => {
    const absolutePath = path.join(repoRoot, relativePath)
    if (!existsSync(absolutePath)) {
      fail(`Missing memory file: ${relativePath}`)
      return false
    }
    return true
  }

  const parseCurrentSession = () => {
    const relativePath = "codex/current-session.md"
    if (!checkRequiredFile(relativePath)) {
      return null
    }

    const contents = readText(relativePath)
    const sessionMatch = contents.match(/Current session file:\s*`([^`]+)`/)
    const nextStepMatch = contents.match(/Next step number:\s*`(\d+)`/)

    if (!sessionMatch) {
      fail("codex/current-session.md is missing the current session file pointer.")
      return null
    }
    if (!nextStepMatch) {
      fail("codex/current-session.md is missing the next step number.")
      return null
    }

    const sessionFile = sessionMatch[1]
    if (parseSessionFileNumber(sessionFile) === null) {
      fail(`Invalid current session file path: ${sessionFile}`)
    }

    return {
      sessionFile,
      nextStepNumber: Number(nextStepMatch[1])
    }
  }

  const checkTemplate = () => {
    const relativePath = "codex/log-template.md"
    if (!checkRequiredFile(relativePath)) {
      return
    }

    const actualTemplate = readText(relativePath).trim()
    if (actualTemplate !== expectedTemplate) {
      fail("codex/log-template.md does not match the required session-log template.")
    }
  }

  const checkSessionLog = ({ sessionFile, nextStepNumber }, enforceNextStep = false) => {
    if (!checkRequiredFile(sessionFile)) {
      return
    }

    const contents = readText(sessionFile)
    const stepMatches = [...contents.matchAll(/^## Step (\d+)$/gm)]
    if (stepMatches.length === 0) {
      fail(`${sessionFile} has no step records.`)
      return
    }

    for (const [index, match] of stepMatches.entries()) {
      const expectedStep = index + 1
      const actualStep = Number(match[1])
      if (actualStep !== expectedStep) {
        fail(`${sessionFile} has non-contiguous step numbering at Step ${actualStep}; expected Step ${expectedStep}.`)
      }

      const start = match.index
      const end = stepMatches[index + 1]?.index ?? contents.length
      const stepBlock = contents.slice(start, end)

      for (const section of requiredSections) {
        if (!stepBlock.includes(section)) {
          fail(`${sessionFile} Step ${actualStep} is missing ${section}.`)
        }
      }
    }

    if (enforceNextStep) {
      const expectedNextStepNumber = stepMatches.length + 1
      if (nextStepNumber !== expectedNextStepNumber) {
        fail(
          `codex/current-session.md next step is ${nextStepNumber}; expected ${expectedNextStepNumber}.`
        )
      }
    }
  }

  const getSessionFiles = () => {
    const logsRoot = path.join(repoRoot, "codex", "logs")
    if (!existsSync(logsRoot)) {
      fail("Missing memory file: codex/logs")
      return []
    }

    return readdirSync(logsRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.join("codex", "logs", entry.name))
      .sort()
  }

  checkTemplate()
  const currentSession = parseCurrentSession()
  const sessionFiles = getSessionFiles()

  if (currentSession) {
    for (const message of checkSessionInventory(sessionFiles, currentSession.sessionFile)) {
      fail(message)
    }

    for (const sessionFile of sessionFiles) {
      checkSessionLog(
        {
          sessionFile,
          nextStepNumber: currentSession.nextStepNumber
        },
        sessionFile === currentSession.sessionFile
      )
    }
  }

  return failures
}

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isMainModule) {
  const failures = runCheckMemory()

  if (failures.length > 0) {
    console.error("[check-memory] FAIL")
    for (const message of failures) {
      console.error(`- ${message}`)
    }
    process.exit(1)
  }

  console.log("[check-memory] PASS")
}
