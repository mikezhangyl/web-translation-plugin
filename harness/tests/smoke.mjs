import { spawnSync } from "node:child_process"

const cwd = process.cwd()
const suites = ["harness/tests/smoke.positive.mjs", "harness/tests/smoke.negative.mjs"]

for (const suite of suites) {
  const run = spawnSync("node", [suite], { cwd, encoding: "utf8" })
  if (run.status !== 0) {
    console.error(run.stdout)
    console.error(run.stderr)
    throw new Error(`Smoke suite failed: ${suite}`)
  }
}

console.log("Harness smoke test passed for positive and negative suites.")
