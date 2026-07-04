import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/user.json";

/**
 * Authentication setup — logs in as a test user via credentials
 * and saves the session state for reuse in all test specs.
 *
 * Prerequisites: test users must be seeded (scripts/seed-test-users.js)
 */
setup("authenticate as test user", async ({ page }) => {
  // Ensure the database is initialized
  await page.goto("/api/init");

  // Navigate to login page
  await page.goto("/login");

  // Click "Sign in with email instead" to reveal credentials form
  await page.getByText("Sign in with email instead").click();

  // Fill in credentials
  await page.getByLabel("Email").fill("admin@test.local");
  await page.getByLabel("Password").fill("password123");

  // Submit
  await page.getByRole("button", { name: "Sign in" }).click();

  // Wait for redirect to home page (authenticated)
  await page.waitForURL("/", { timeout: 10_000 });

  // Verify we're logged in by checking the page loaded
  await expect(page).toHaveURL("/");

  // Save signed-in state
  await page.context().storageState({ path: AUTH_FILE });
});
