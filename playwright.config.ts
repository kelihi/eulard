import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Eulard E2E tests.
 *
 * Run: pnpm exec playwright test
 * UI:  pnpm exec playwright test --ui
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Setup project: authenticates and stores session state
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },

    // Main browser tests (authenticated)
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  // Start local dev server if not already running
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000/api/healthz",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      DB_HOST: "127.0.0.1",
      DB_PORT: "5433",
      DB_NAME: "eulard",
      DB_USER: "eulard-app",
      DB_PASSWORD: "localdev",
      DB_SSL: "false",
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "test-secret-do-not-use-in-production",
      AUTH_TRUST_HOST: "true",
      AUTH_GOOGLE_CLIENT_ID: "fake-client-id",
      AUTH_GOOGLE_CLIENT_SECRET: "fake-client-secret",
    },
  },
});
