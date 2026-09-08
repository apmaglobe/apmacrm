import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  outputDir: process.env.APMA_TEST_URL ? ".local/preview-test-results" : "test-results",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.APMA_TEST_URL ?? "http://127.0.0.1:3000",
    extraHTTPHeaders: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          "x-vercel-protection-bypass":
            process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
        }
      : {},
    headless: true,
    launchOptions: {
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    },
    trace: "off", // Auth requests must not be persisted into trace artifacts.
  },
  reporter: [["list"], ["html", { open: "never",outputFolder:process.env.APMA_TEST_URL?".local/preview-playwright-report":"playwright-report" }]],
});
