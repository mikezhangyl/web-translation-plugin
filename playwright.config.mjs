import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "@playwright/test"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  testDir: path.join(__dirname, "tests/e2e"),
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  }
})
