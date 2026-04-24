import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

const repoRoot = process.cwd()
const docsRoot = path.join(repoRoot, "docs")

const requiredFiles = [
  "docs/index.md",
  "docs/ARCHITECTURE.md",
  "docs/RELIABILITY.md",
  "docs/SECURITY.md",
  "docs/product-specs/index.md",
  "docs/product-specs/current-state.md",
  "docs/requirements/index.md",
  "docs/requirements/active/index.md",
  "docs/requirements/history/index.md",
  "docs/requirements/history/timeline.md",
  "docs/requirements/archive/index.md",
  "docs/design/index.md",
  "docs/design/history/index.md",
  "docs/issues/index.md",
  "docs/issues/open/index.md",
  "docs/issues/resolved/index.md",
  "docs/references/index.md",
  "docs/references/provider-workflow-lessons.md",
  "docs/references/observability-and-acceptance.md",
  "docs/references/sub-agent-delegation.md",
  "docs/exec-plans/index.md",
  "docs/exec-plans/active/index.md",
  "docs/exec-plans/tech-debt-tracker.md",
  "docs/archive/index.md",
  "docs/archive/status/index.md"
]

const failures = []

const fail = (message) => {
  failures.push(message)
}

const walkMarkdown = (dir, acc = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue
    }
    const nextPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkMarkdown(nextPath, acc)
      continue
    }
    if (entry.isFile() && nextPath.endsWith(".md")) {
      acc.push(nextPath)
    }
  }
  return acc
}

const isLikelyAbsoluteLocalPath = (value) =>
  value.startsWith("/Users/") ||
  value.startsWith("/home/") ||
  /^[A-Za-z]:\\/.test(value)

const normalizeYamlScalar = (value) =>
  value.trim().replace(/^["']/, "").replace(/["']$/, "")

const extractSourceCandidate = (line) => {
  const trimmed = line.trim()
  if (trimmed.startsWith("source:")) {
    return normalizeYamlScalar(trimmed.replace(/^source:\s*/, ""))
  }
  if (trimmed.startsWith("path:")) {
    return normalizeYamlScalar(trimmed.replace(/^path:\s*/, ""))
  }
  if (trimmed.startsWith("- ")) {
    return normalizeYamlScalar(trimmed.replace(/^- /, ""))
  }
  return null
}

const checkFrontmatterProvenance = (filePath, contents) => {
  if (!contents.startsWith("---\n")) {
    return
  }

  const closingIndex = contents.indexOf("\n---", 4)
  if (closingIndex === -1) {
    return
  }

  const frontmatter = contents.slice(4, closingIndex)
  if (!frontmatter.includes("source:")) {
    return
  }

  for (const line of frontmatter.split(/\r?\n/)) {
    const candidate = extractSourceCandidate(line)
    if (!candidate) {
      continue
    }
    if (isLikelyAbsoluteLocalPath(candidate)) {
      fail(
        `Non-portable source path in ${path.relative(repoRoot, filePath)}: ${line.trim()}`
      )
    }
  }
}

const checkMarkdownLinks = (filePath, contents) => {
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g
  let match

  while ((match = linkPattern.exec(contents))) {
    const target = match[1]
    if (
      target.startsWith("http://") ||
      target.startsWith("https://") ||
      target.startsWith("mailto:") ||
      target.startsWith("#") ||
      target.startsWith("/")
    ) {
      continue
    }

    const cleanTarget = target.split("#")[0]
    if (!cleanTarget) {
      continue
    }

    const resolved = path.resolve(path.dirname(filePath), cleanTarget)
    if (!existsSync(resolved)) {
      fail(
        `Broken markdown link in ${path.relative(repoRoot, filePath)} -> ${target}`
      )
    }
  }
}

for (const relativePath of requiredFiles) {
  const absolutePath = path.join(repoRoot, relativePath)
  if (!existsSync(absolutePath)) {
    fail(`Missing required docs file: ${relativePath}`)
  }
}

const legacyReadmePath = path.join(repoRoot, "docs", "exec-plans", "active", "README.md")
if (existsSync(legacyReadmePath)) {
  fail("Legacy docs/exec-plans/active/README.md should not exist; use active/index.md instead.")
}

const activeRequirementsDir = path.join(docsRoot, "requirements", "active")
if (existsSync(activeRequirementsDir)) {
  for (const entry of readdirSync(activeRequirementsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue
    }
    const initiativeDir = path.join(activeRequirementsDir, entry.name)
    const prdPath = path.join(initiativeDir, "PRD.md")
    const changelogPath = path.join(initiativeDir, "CHANGELOG.md")
    if (!existsSync(prdPath)) {
      fail(`Missing PRD.md for active requirement stream: docs/requirements/active/${entry.name}`)
    }
    if (!existsSync(changelogPath)) {
      fail(
        `Missing CHANGELOG.md for active requirement stream: docs/requirements/active/${entry.name}`
      )
    }
  }
}

if (existsSync(docsRoot)) {
  for (const markdownFile of walkMarkdown(docsRoot)) {
    const contents = readFileSync(markdownFile, "utf8")
    checkFrontmatterProvenance(markdownFile, contents)
    checkMarkdownLinks(markdownFile, contents)
  }
}

if (failures.length > 0) {
  console.error("[check-docs] FAIL")
  for (const message of failures) {
    console.error(`- ${message}`)
  }
  process.exit(1)
}

console.log("[check-docs] PASS")
