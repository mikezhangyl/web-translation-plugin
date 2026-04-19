import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()

const parseArgs = () => {
  const args = process.argv.slice(2)
  const result = {}
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i]
    const value = args[i + 1]
    if (key?.startsWith("--") && value && !value.startsWith("--")) {
      result[key.slice(2)] = value
      i += 1
    }
  }
  return result
}

const readJson = (filePath) => {
  const content = fs.readFileSync(filePath, "utf8")
  return JSON.parse(content)
}

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const ensureScenarioShape = (scenario) => {
  assert(typeof scenario?.id === "string" && scenario.id.length > 0, "Scenario.id is required")
  assert(
    typeof scenario?.description === "string" && scenario.description.length > 0,
    "Scenario.description is required"
  )
  assert(scenario?.mode === "dry-run", "Scenario.mode must be 'dry-run'")
  assert(typeof scenario?.fixture?.inputPath === "string", "Scenario.fixture.inputPath is required")
  assert(
    typeof scenario?.fixture?.expectedOutputPath === "string",
    "Scenario.fixture.expectedOutputPath is required"
  )
}

const main = () => {
  const args = parseArgs()
  const configPath = path.resolve(cwd, args.config ?? "harness/config/harness.config.example.json")
  const scenarioPath = path.resolve(cwd, args.scenario ?? "harness/scenarios/dry-run.translation.json")

  const config = readJson(configPath)
  const scenario = readJson(scenarioPath)
  ensureScenarioShape(scenario)

  const inputPath = path.resolve(cwd, scenario.fixture.inputPath)
  const expectedOutputPath = path.resolve(cwd, scenario.fixture.expectedOutputPath)

  assert(fs.existsSync(inputPath), `Fixture input does not exist: ${scenario.fixture.inputPath}`)
  assert(
    fs.existsSync(expectedOutputPath),
    `Fixture expected output does not exist: ${scenario.fixture.expectedOutputPath}`
  )

  const startedAt = new Date().toISOString()
  const input = readJson(inputPath)
  const expected = readJson(expectedOutputPath)

  const report = {
    harness: config.name ?? "unnamed-harness",
    scenarioId: scenario.id,
    mode: scenario.mode,
    startedAt,
    completedAt: new Date().toISOString(),
    status: "passed",
    checks: [
      { name: "scenario-shape", status: "passed" },
      { name: "fixture-input-exists", status: "passed" },
      { name: "fixture-expected-output-exists", status: "passed" }
    ],
    artifacts: {
      inputPath: scenario.fixture.inputPath,
      expectedOutputPath: scenario.fixture.expectedOutputPath
    },
    sample: {
      inputPreviewKeys: Object.keys(input),
      expectedPreviewKeys: Object.keys(expected)
    }
  }

  const outputDir = path.resolve(cwd, config.reporting?.outputDir ?? "harness/reports")
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, "latest.json")
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8")

  console.log(`Harness run passed: ${scenario.id}`)
  console.log(`Report: ${path.relative(cwd, outputPath)}`)
}

main()
