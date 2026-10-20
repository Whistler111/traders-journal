import { defineConfig, devices } from "@playwright/test";
const port = process.env.JOURNAL_TEST_PORT ?? "4173";
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL,
    launchOptions: {
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command:
      "node node_modules/@react-router/serve/bin.cjs build/server/index.js",
    env: { PORT: port, HOST: "127.0.0.1" },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
