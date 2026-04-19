import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()
const SUPPORTED_SCENARIO_SCHEMA_VERSIONS = ["1.0"]

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

const isObject = (value) => value !== null && typeof value === "object"

const validateBySchema = (value, schema, currentPath = "scenario") => {
  const errors = []

  if (schema.type === "object") {
    if (!isObject(value) || Array.isArray(value)) {
      errors.push(`${currentPath} must be an object`)
      return errors
    }

    const props = schema.properties ?? {}
    const required = schema.required ?? []

    for (const key of required) {
      if (!(key in value)) {
        errors.push(`${currentPath}.${key} is required`)
      }
    }

    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(props))
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
          errors.push(`${currentPath}.${key} is not allowed`)
        }
      }
    }

    for (const [key, propSchema] of Object.entries(props)) {
      if (key in value) {
        errors.push(...validateBySchema(value[key], propSchema, `${currentPath}.${key}`))
      }
    }

    return errors
  }

  if (schema.type === "string") {
    if (typeof value !== "string") {
      errors.push(`${currentPath} must be a string`)
      return errors
    }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      errors.push(`${currentPath} must be at least ${schema.minLength} characters`)
    }
    if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
      errors.push(`${currentPath} must be one of: ${schema.enum.join(", ")}`)
    }
  }

  return errors
}

const diffPaths = (actual, expected, currentPath = "") => {
  if (!isObject(actual) || !isObject(expected)) {
    return JSON.stringify(actual) === JSON.stringify(expected) ? [] : [currentPath || "$"]
  }

  const keys = new Set([...Object.keys(actual), ...Object.keys(expected)])
  const paths = []

  for (const key of keys) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key
    const aValue = actual[key]
    const eValue = expected[key]

    if (isObject(aValue) && isObject(eValue)) {
      paths.push(...diffPaths(aValue, eValue, nextPath))
      continue
    }

    if (JSON.stringify(aValue) !== JSON.stringify(eValue)) {
      paths.push(nextPath)
    }
  }

  return paths
}

const getValueByPath = (obj, pathKey) => {
  if (pathKey === "$") {
    return obj
  }

  const parts = pathKey.split(".")
  let current = obj

  for (const part of parts) {
    if (!isObject(current) || !(part in current)) {
      return undefined
    }
    current = current[part]
  }

  return current
}

const buildActualFromInput = (input) => ({
  requestId: input.requestId,
  translatedText: input.text,
  status: "actual",
  metadata: {
    generator: "harness-dry-run",
    confidence: 1
  }
})

const main = () => {
  const args = parseArgs()
  const configPath = path.resolve(cwd, args.config ?? "harness/config/harness.config.example.json")
  const scenarioPath = path.resolve(cwd, args.scenario ?? "harness/scenarios/dry-run.translation.json")
  const scenarioSchemaPath = path.resolve(cwd, "harness/contracts/scenario.schema.json")

  const config = readJson(configPath)
  const scenario = readJson(scenarioPath)
  const scenarioSchema = readJson(scenarioSchemaPath)

  const schemaErrors = validateBySchema(scenario, scenarioSchema)
  assert(
    schemaErrors.length === 0,
    `Scenario schema validation failed:\n- ${schemaErrors.join("\n- ")}`
  )
  assert(
    SUPPORTED_SCENARIO_SCHEMA_VERSIONS.includes(scenario.schemaVersion),
    `Unsupported scenario schemaVersion '${scenario.schemaVersion}'. Supported: ${SUPPORTED_SCENARIO_SCHEMA_VERSIONS.join(", ")}`
  )

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
  const actual = buildActualFromInput(input)
  const changedPaths = diffPaths(actual, expected)
  const match = changedPaths.length === 0
  const differences = changedPaths.map((pathKey) => ({
    path: pathKey,
    actual: getValueByPath(actual, pathKey),
    expected: getValueByPath(expected, pathKey)
  }))

  const report = {
    harness: config.name ?? "unnamed-harness",
    scenarioSchemaVersion: scenario.schemaVersion,
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
    comparison: {
      match,
      diffKeys: changedPaths,
      differences,
      actual,
      expected
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
