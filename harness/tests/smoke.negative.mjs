import { spawnSync } from "node:child_process"

const cwd = process.cwd()

const invalidRun = spawnSync(
  "node",
  [
    "harness/scripts/run-harness.mjs",
    "--config",
    "harness/config/harness.config.example.json",
    "--scenario",
    "harness/scenarios/invalid.extra-field.json"
  ],
  { cwd, encoding: "utf8" }
)

if (invalidRun.status === 0) {
  throw new Error("Negative smoke failed: invalid scenario unexpectedly passed")
}

const invalidOutput = `${invalidRun.stdout}\n${invalidRun.stderr}`
if (!invalidOutput.includes("Scenario schema validation failed")) {
  throw new Error("Negative smoke failed: missing schema validation error output")
}

const unsupportedVersionRun = spawnSync(
  "node",
  [
    "harness/scripts/run-harness.mjs",
    "--config",
    "harness/config/harness.config.example.json",
    "--scenario",
    "harness/scenarios/invalid.unsupported-version.json"
  ],
  { cwd, encoding: "utf8" }
)

if (unsupportedVersionRun.status === 0) {
  throw new Error("Negative smoke failed: unsupported schemaVersion unexpectedly passed")
}

const unsupportedVersionOutput = `${unsupportedVersionRun.stdout}\n${unsupportedVersionRun.stderr}`
if (!unsupportedVersionOutput.includes("Unsupported scenario schemaVersion")) {
  throw new Error("Negative smoke failed: missing unsupported schemaVersion error output")
}

console.log("Harness negative smoke passed for invalid schema and unsupported-version scenarios.")
