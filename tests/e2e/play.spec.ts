import { expect, test, type Page } from "@playwright/test";
import { generatePuzzle } from "../../generator/generate.ts";
import { puzzleNumber } from "../../shared/day.ts";

const today = new Date().toISOString().slice(0, 10);
const number = puzzleNumber(today)!;
const puzzle = generatePuzzle("dev", number);

async function typeGrid(page: Page, rows: string[]): Promise<void> {
  await page.locator(".cell").first().click();
  await page.keyboard.type(rows.join(""));
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("regexle:test-reset")) return;
    sessionStorage.setItem("regexle:test-reset", "1");
    localStorage.setItem("regexle:seen", "1");
    localStorage.removeItem("regexle:game");
    localStorage.removeItem("regexle:record");
  });
});

test("shows ten clues around an empty grid", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.locator("#row-clues li")).toHaveText(puzzle.rows);
  await expect(page.locator("#col-clues li")).toHaveText(puzzle.cols);
  await expect(page.locator(".cell")).toHaveCount(25);
  await expect(page.locator("#focus-row code")).toHaveText(puzzle.rows[0]!);
  if (info.project.name === "mobile") {
    const fit = await page.evaluate(() => ({
      game:
        document.querySelector(".keyboard")!.getBoundingClientRect().bottom -
        document.querySelector(".board")!.getBoundingClientRect().top,
      viewport: innerHeight,
    }));
    expect(fit.game, "board through keyboard fits an iPhone 13 screen").toBeLessThanOrEqual(
      fit.viewport,
    );
  }
  await page.screenshot({ path: info.outputPath("empty.png"), fullPage: true });
});

test("opens the how-to on a first visit", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#row-clues li")).toHaveCount(5);
  await page.evaluate(() => localStorage.removeItem("regexle:seen"));
  await page.reload();
  await expect(page.locator("#help")).toBeVisible();
  await page.locator("#help form button").click();
  await expect(page.locator("#help")).toBeHidden();
});

test("explains a clue in plain words when tapped", async ({ page }) => {
  await page.goto("/");
  await page.locator("#focus-row").click();
  const explain = page.locator("#explain");
  await expect(explain).toBeVisible();
  await expect(explain).toHaveText(/\.$/);
  await page.locator("#focus-row").click();
  await expect(explain).toBeHidden();
});

test("refuses a partial grid with a notice", async ({ page }) => {
  await page.goto("/");
  await page.locator(".cell").first().click();
  await page.keyboard.type("ABC");
  await page.keyboard.press("Enter");
  await expect(page.locator("#notice")).toHaveText("Fill every cell first.");
});

test("a wrong grid is marked and remembered across a reload", async ({ page }, info) => {
  await page.goto("/");
  const wrong = puzzle.answer.map((row) => row.replace(/./g, (ch) => (ch === "Q" ? "Z" : "Q")));
  await typeGrid(page, wrong);
  await page.keyboard.press("Enter");
  await expect(page.locator(".cell.x, .cell.y, .cell.g")).toHaveCount(25, { timeout: 5000 });
  await expect(page.locator(".attempt:not(.empty)")).toHaveCount(1);
  await expect(page.locator("#notice")).toHaveText("5 checks left.");
  await page.screenshot({ path: info.outputPath("after-one.png"), fullPage: true });
  await page.reload();
  await expect(page.locator(".cell.x, .cell.y, .cell.g")).toHaveCount(25);
  await expect(page.locator(".attempt:not(.empty)")).toHaveCount(1);
});

test("the right grid turns green and opens the statistics", async ({ page }, info) => {
  await page.goto("/");
  await typeGrid(page, puzzle.answer);
  await page.keyboard.press("Enter");
  await expect(page.locator(".cell.g")).toHaveCount(25, { timeout: 5000 });
  const stats = page.locator("#stats");
  await expect(stats).toBeVisible({ timeout: 5000 });
  await expect(page.locator("#result-title")).toHaveText("Solved in one.");
  await expect(page.locator("#figures")).toContainText("100%");
  await expect(page.locator("#global-note")).toContainText(/finished game/);
  await expect(page.locator("#next")).toHaveText(/^Next puzzle in \d\d:\d\d:\d\d$/);
  await page.screenshot({ path: info.outputPath("solved.png"), fullPage: true });
  await page.locator("#share").click();
  await expect(page.locator("#share-done")).toHaveText(/Copied|Could not copy/);
});

test("settings switch theme and contrast", async ({ page }, info) => {
  await page.goto("/");
  await page.locator("#settings-button").click();
  await page.locator('input[value="dark"]').check();
  await page.locator("#contrast").check();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-contrast", "1");
  await page.locator("#settings form button").click();
  await typeGrid(page, puzzle.answer);
  await page.keyboard.press("Enter");
  await expect(page.locator(".cell.g")).toHaveCount(25, { timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.screenshot({ path: info.outputPath("dark-contrast.png"), fullPage: true });
});
