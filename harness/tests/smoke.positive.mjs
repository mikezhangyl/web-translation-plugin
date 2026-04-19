import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()
const reportPath = path.join(cwd, "harness/reports/latest.json")

const scenarios = [
  {
    path: "harness/scenarios/dry-run.translation.json",
    id: "dry-run.translation.baseline",
    expectMatch: false,
    expectDiffIncludes: ["translatedText", "status", "metadata.generator"],
    expectDifferenceValues: [
      { path: "translatedText", actual: "Hello harness", expected: "你好，harness" },
      { path: "status", actual: "actual", expected: "expected" },
      { path: "metadata.generator", actual: "harness-dry-run", expected: "expected-engine" }
    ]
  },
  {
    path: "harness/scenarios/dry-run.translation.variant.json",
    id: "dry-run.translation.variant",
    expectMatch: true,
    expectDiffIncludes: [],
    expectDifferenceValues: []
  }
]

for (const scenario of scenarios) {
  const run = spawnSync(
    "node",
    [
      "harness/scripts/run-harness.mjs",
      "--config",
      "harness/config/harness.config.example.json",
      "--scenario",
      scenario.path
    ],
    { cwd, encoding: "utf8" }
  )

  if (run.status !== 0) {
    console.error(run.stdout)
    console.error(run.stderr)
    throw new Error(`Harness runner execution failed for scenario ${scenario.id}`)
  }

  if (!fs.existsSync(reportPath)) {
    throw new Error("Positive smoke failed: report file was not generated")
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))

  if (report.status !== "passed") {
    throw new Error(`Positive smoke failed: expected report.status=passed, got ${report.status}`)
  }

  if (report.scenarioId !== scenario.id) {
    throw new Error(`Positive smoke failed: unexpected scenarioId ${report.scenarioId}`)
  }

  if (typeof report.comparison?.match !== "boolean") {
    throw new Error("Positive smoke failed: comparison.match is missing or invalid")
  }

  if (!Array.isArray(report.comparison?.diffKeys)) {
    throw new Error("Positive smoke failed: comparison.diffKeys is missing or invalid")
  }

  if (!Array.isArray(report.comparison?.differences)) {
    throw new Error("Positive smoke failed: comparison.differences is missing or invalid")
  }

  if (report.comparison.match !== scenario.expectMatch) {
    throw new Error(
      `Positive smoke failed: scenario ${scenario.id} expected match=${scenario.expectMatch} got ${report.comparison.match}`
    )
  }

  for (const expectedPath of scenario.expectDiffIncludes) {
    if (!report.comparison.diffKeys.includes(expectedPath)) {
      throw new Error(
        `Positive smoke failed: scenario ${scenario.id} missing expected diff path '${expectedPath}'`
      )
    }
  }

  for (const expectedDiff of scenario.expectDifferenceValues) {
    const found = report.comparison.differences.find((item) => item.path === expectedDiff.path)
    if (!found) {
      throw new Error(
        `Positive smoke failed: scenario ${scenario.id} missing difference detail for path '${expectedDiff.path}'`
      )
    }
    if (JSON.stringify(found.actual) !== JSON.stringify(expectedDiff.actual)) {
      throw new Error(
        `Positive smoke failed: scenario ${scenario.id} path '${expectedDiff.path}' unexpected actual value`
      )
    }
    if (JSON.stringify(found.expected) !== JSON.stringify(expectedDiff.expected)) {
      throw new Error(
        `Positive smoke failed: scenario ${scenario.id} path '${expectedDiff.path}' unexpected expected value`
      )
    }
  }
}

console.log("Harness positive smoke passed for baseline and variant scenarios.")
