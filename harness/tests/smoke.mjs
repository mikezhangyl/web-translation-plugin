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
    expectDiffIncludes: ["translatedText", "status", "metadata.generator"]
  },
  {
    path: "harness/scenarios/dry-run.translation.variant.json",
    id: "dry-run.translation.variant",
    expectMatch: true,
    expectDiffIncludes: []
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
    throw new Error("Smoke test failed: report file was not generated")
  }

  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))

  if (report.status !== "passed") {
    throw new Error(`Smoke test failed: expected report.status=passed, got ${report.status}`)
  }

  if (report.scenarioId !== scenario.id) {
    throw new Error(`Smoke test failed: unexpected scenarioId ${report.scenarioId}`)
  }

  if (typeof report.comparison?.match !== "boolean") {
    throw new Error("Smoke test failed: comparison.match is missing or invalid")
  }

  if (!Array.isArray(report.comparison?.diffKeys)) {
    throw new Error("Smoke test failed: comparison.diffKeys is missing or invalid")
  }

  if (report.comparison.match !== scenario.expectMatch) {
    throw new Error(
      `Smoke test failed: scenario ${scenario.id} expected match=${scenario.expectMatch} got ${report.comparison.match}`
    )
  }

  for (const expectedPath of scenario.expectDiffIncludes) {
    if (!report.comparison.diffKeys.includes(expectedPath)) {
      throw new Error(
        `Smoke test failed: scenario ${scenario.id} missing expected diff path '${expectedPath}'`
      )
    }
  }
}

console.log("Harness smoke test passed for baseline and variant scenarios.")
