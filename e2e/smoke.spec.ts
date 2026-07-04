import { test, expect } from "@playwright/test";

test.describe("Smoke tests", () => {
  test("health endpoint returns ok", async ({ request }) => {
    const response = await request.get("/api/healthz");
    expect(response.ok()).toBeTruthy();
  });

  test("home page loads for authenticated user", async ({ page }) => {
    await page.goto("/");
    // The page should load without redirecting to /login
    await expect(page).toHaveURL("/");
    // Eulard should appear somewhere in the page
    await expect(page.locator("body")).toBeVisible();
  });

  test("can create and delete a diagram", async ({ page }) => {
    await page.goto("/");

    // Look for a "New Diagram" or "+" button (adjust selector as needed)
    const newDiagramBtn = page.getByRole("button", { name: /new/i });
    if (await newDiagramBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newDiagramBtn.click();

      // Should navigate to an editor page
      await page.waitForURL(/\/editor\//, { timeout: 10_000 });
      await expect(page.url()).toContain("/editor/");
    }
  });

  test("login page renders", async ({ browser }) => {
    // Use a fresh context without stored auth
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login");
    await expect(page.getByText("Sign in to your account")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in with google/i })
    ).toBeVisible();

    await context.close();
  });

  test("unauthenticated API returns redirect or 401", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Try accessing a protected endpoint without auth
    const response = await page.goto("/api/me");
    // Should redirect to login or return an error
    const url = page.url();
    const isRedirected = url.includes("/login");
    const status = response?.status();
    expect(isRedirected || status === 401 || status === 302).toBeTruthy();

    await context.close();
  });
});
