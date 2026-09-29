import { expect, test } from "@playwright/test";

test("the front page loads with the masthead and today's issue", async ({ page }, info) => {
  await page.goto("/");
  await expect(page).toHaveTitle("regexle");
  await expect(page.locator(".wordmark")).toHaveText("regexle");
  await expect(page.locator("#issue")).toHaveText(/^No\. \d+ \u00b7 /);
  await page.screenshot({ path: info.outputPath("front.png"), fullPage: true });
});

test("unknown api routes answer 404 as json", async ({ request }) => {
  const res = await request.get("/api/nothing");
  expect(res.status()).toBe(404);
  expect(await res.json()).toEqual({ error: "not found" });
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  const csp = res.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toContain("__");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});
