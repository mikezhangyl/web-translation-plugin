import fs from "node:fs"
import path from "node:path"

const root = process.cwd()
const currentSessionPath = path.join(root, "codex/current-session.md")
const templatePath = path.join(root, "codex/log-template.md")
const logsDirPath = path.join(root, "codex/logs")

const errors = []

const requiredStepSections = [
  "### User Instruction",
  "### Understanding",
  "### Plan",
  "### Actions Taken",
  "### Validation",
  "### Result"
]

const exactTemplate = `## Step N

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
...
`

const cjkRegex = /[\u3400-\u9fff]/
const sessionFilePattern = /^session-(\d{3})\.md$/
const SESSION_STEP_LIMIT = 100

const readFile = (filePath) => {
  try {
    return fs.readFileSync(filePath, "utf8")
  } catch (error) {
    errors.push(`Missing required file: ${path.relative(root, filePath)}`)
    return ""
  }
}

const ensureNoCjk = (label, content) => {
  if (cjkRegex.test(content)) {
    errors.push(`${label} contains non-English CJK characters.`)
  }
}

const extractStepNumbers = (content) =>
  [...content.matchAll(/^## Step (\d+)\s*$/gm)].map((match) => Number(match[1]))

const currentSessionContent = readFile(currentSessionPath)
const templateContent = readFile(templatePath)

if (templateContent.trim() !== exactTemplate.trim()) {
  errors.push("codex/log-template.md does not match the required exact structure.")
}

ensureNoCjk("codex/current-session.md", currentSessionContent)
ensureNoCjk("codex/log-template.md", templateContent)

const sessionPathMatch = currentSessionContent.match(/- Current session file:\s*`([^`]+)`/)
const nextStepMatch = currentSessionContent.match(/- Next step number:\s*`(\d+)`/)

if (!sessionPathMatch) {
  errors.push("codex/current-session.md is missing 'Current session file'.")
}

if (!nextStepMatch) {
  errors.push("codex/current-session.md is missing 'Next step number'.")
}

const sessionRelativePath = sessionPathMatch?.[1]
const nextStepNumber = nextStepMatch ? Number(nextStepMatch[1]) : NaN
const sessionPath = sessionRelativePath ? path.join(root, sessionRelativePath) : ""
const sessionContent = sessionPath ? readFile(sessionPath) : ""

const listSessionFiles = () => {
  try {
    return fs
      .readdirSync(logsDirPath)
      .map((name) => {
        const match = name.match(sessionFilePattern)
        if (!match) {
          return null
        }
        return {
          name,
          index: Number(match[1]),
          relativePath: `codex/logs/${name}`,
          absolutePath: path.join(logsDirPath, name)
        }
      })
      .filter(Boolean)
      .sort((a, b) => a.index - b.index)
  } catch (error) {
    errors.push("Missing required directory: codex/logs")
    return []
  }
}

const allSessionFiles = listSessionFiles()

if (sessionRelativePath && !sessionRelativePath.startsWith("codex/logs/session-")) {
  errors.push("Current session file must point to a file under codex/logs/session-*.md.")
}

if (sessionRelativePath) {
  const currentName = path.basename(sessionRelativePath)
  if (!sessionFilePattern.test(currentName)) {
    errors.push("Current session filename must match session-XXX.md (zero-padded).")
  }
}

if (!Number.isFinite(nextStepNumber) || nextStepNumber < 2) {
  errors.push("Next step number must be an integer >= 2.")
}

if (allSessionFiles.length === 0) {
  errors.push("No session files found under codex/logs.")
}

if (allSessionFiles.length > 0) {
  if (allSessionFiles[0].index !== 1) {
    errors.push("Session files must start at session-001.md.")
  }

  for (let i = 1; i < allSessionFiles.length; i += 1) {
    if (allSessionFiles[i].index !== allSessionFiles[i - 1].index + 1) {
      errors.push(
        `Session file numbering must be continuous. Found ${allSessionFiles[i - 1].name} then ${allSessionFiles[i].name}.`
      )
      break
    }
  }

  const latestSession = allSessionFiles[allSessionFiles.length - 1]
  if (sessionRelativePath && latestSession.relativePath !== sessionRelativePath) {
    errors.push(
      `Current session must point to the latest session file (${latestSession.relativePath}).`
    )
  }

  allSessionFiles.forEach((sessionFile) => {
    const content = readFile(sessionFile.absolutePath)
    if (!content) {
      return
    }
    ensureNoCjk(sessionFile.relativePath, content)
    const stepNumbers = extractStepNumbers(content)
    const lastStep = stepNumbers[stepNumbers.length - 1] ?? 0
    if (lastStep > SESSION_STEP_LIMIT) {
      errors.push(
        `${sessionFile.relativePath} exceeds ${SESSION_STEP_LIMIT} steps. Create the next session file and continue there.`
      )
    }
  })
}

if (sessionContent) {
  const stepMatches = [...sessionContent.matchAll(/^## Step (\d+)\s*$/gm)]
  const stepNumbers = extractStepNumbers(sessionContent)

  if (stepNumbers.length === 0) {
    errors.push("Session log must contain at least one step (`## Step N`).")
  }

  if (stepNumbers[0] !== 1) {
    errors.push("Session log step numbering must start from Step 1.")
  }

  for (let i = 1; i < stepNumbers.length; i += 1) {
    if (stepNumbers[i] !== stepNumbers[i - 1] + 1) {
      errors.push(
        `Session log step numbers must be continuous. Found Step ${stepNumbers[i - 1]} then Step ${stepNumbers[i]}.`
      )
      break
    }
  }

  const lastStep = stepNumbers[stepNumbers.length - 1]
  if (lastStep > SESSION_STEP_LIMIT) {
    errors.push(
      `Active session exceeds ${SESSION_STEP_LIMIT} steps. Rotate to the next session file before recording more steps.`
    )
  }
  if (Number.isFinite(nextStepNumber) && lastStep + 1 !== nextStepNumber) {
    errors.push(
      `Next step mismatch: current-session says ${nextStepNumber}, but session log implies ${lastStep + 1}.`
    )
  }

  stepMatches.forEach((match, index) => {
    const stepStart = match.index ?? 0
    const stepEnd = stepMatches[index + 1]?.index ?? sessionContent.length
    const stepBlock = sessionContent.slice(stepStart, stepEnd)
    const stepNo = match[1]

    let previousSectionIndex = -1
    requiredStepSections.forEach((sectionTitle) => {
      const sectionIndex = stepBlock.indexOf(sectionTitle)
      if (sectionIndex === -1) {
        errors.push(`Step ${stepNo} is missing required section: ${sectionTitle}`)
        return
      }

      if (sectionIndex <= previousSectionIndex) {
        errors.push(`Step ${stepNo} has invalid section order near: ${sectionTitle}`)
      }
      previousSectionIndex = sectionIndex
    })
  })
}

if (errors.length > 0) {
  console.error("Logging compliance check failed:")
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log("Logging compliance check passed.")
