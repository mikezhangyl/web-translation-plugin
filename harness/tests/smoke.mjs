import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const cwd = process.cwd()
const reportPath = path.join(cwd, "harness/reports/latest.json")

const run = spawnSync(
  "node",
  [
    "harness/scripts/run-harness.mjs",
    "--config",
    "harness/config/harness.config.example.json",
    "--scenario",
    "harness/scenarios/dry-run.translation.json"
  ],
  { cwd, encoding: "utf8" }
)

if (run.status !== 0) {
  console.error(run.stdout)
  console.error(run.stderr)
  throw new Error("Harness runner execution failed")
}

if (!fs.existsSync(reportPath)) {
  throw new Error("Smoke test failed: report file was not generated")
}

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"))

if (report.status !== "passed") {
  throw new Error(`Smoke test failed: expected report.status=passed, got ${report.status}`)
}

if (report.scenarioId !== "dry-run.translation.baseline") {
  throw new Error(`Smoke test failed: unexpected scenarioId ${report.scenarioId}`)
}

console.log("Harness smoke test passed.")
