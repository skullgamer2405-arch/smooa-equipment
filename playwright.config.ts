import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5174",
    browserName: "chromium",
    launchOptions: {
      ...(process.env.CI
        ? {}
        : { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium" }),
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev:demo -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    env: { VITE_DEMO_MODE: "true" },
  },
  reporter: [["list"], ["html", { open: "never" }]],
});
