import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status").filter({ hasText: "Demo preview" })).toBeVisible();
});
test("streamed finding, citations, private history and statistics", async ({ page }) => {
  await page
    .getByLabel("Claim or article URL", { exact: true })
    .fill("Lightning never strikes the same place twice.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("article", { name: "Fact-check result" })).toContainText("Refuted");
  await expect(page.getByRole("article", { name: "Fact-check result" })).toContainText("simulated");
  await expect(page.locator(".source-cited")).toHaveCount(2);
  await expect(page.locator("#result-title")).toBeFocused();
  await page.getByRole("button", { name: "Check history", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Check history", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Your statistics", exact: true }).click();
  await expect(page.locator(".statistics-summary")).toContainText("Total checks 1");
});
test("cancel aborts the stream and preserves input", async ({ page }) => {
  const field = page.getByLabel("Claim or article URL", { exact: true });
  await field.fill("slow check for this claim about lightning");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("button", { name: "Checking", exact: true })).toBeDisabled();
  await expect(page.getByRole("region", { name: "Verification progress" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel check", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel check", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Check cancelled" })).toBeVisible();
  await expect(field).toHaveValue("slow check for this claim about lightning");
});
test("provider failure is actionable and can recover", async ({ page }) => {
  const field = page.getByLabel("Claim or article URL", { exact: true });
  await field.fill("provider quota for this claim about lightning");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("quota");
  await field.fill("Lightning never strikes the same place twice.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("article", { name: "Fact-check result" })).toBeVisible();
});
test("article extraction lets the user choose claims", async ({ page }) => {
  await page
    .getByLabel("Claim or article URL", { exact: true })
    .fill("https://example.org/article");
  await page.getByRole("button", { name: "Choose article claims", exact: true }).click();
  const choice = page.getByRole("checkbox").first();
  await expect(choice).toBeChecked();
  await choice.uncheck();
  await expect(page.getByRole("button", { name: "Check", exact: true })).toBeDisabled();
  await choice.check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("article", { name: "Fact-check result" })).toContainText(
    "selected claims",
  );
});
test("history filters and JSON/CSV export/import preserve reports", async ({ page }, info) => {
  await page
    .getByLabel("Claim or article URL", { exact: true })
    .fill("Lightning never strikes the same place twice.");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("article", { name: "Fact-check result" })).toBeVisible();
  await page.getByRole("button", { name: "Check history", exact: true }).click();
  await page.getByRole("combobox", { name: "Filter history by verdict" }).selectOption("TRUE");
  await expect(page.getByText("No matching checks", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(1);
  for (const name of ["Export JSON", "Export CSV"]) {
    await page.locator(".history-export summary").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name, exact: true }).click(),
    ]);
    const file = info.outputPath(download.suggestedFilename());
    await download.saveAs(file);
    await page.getByRole("button", { name: "Clear history", exact: true }).click();
    await page.getByLabel("Import history file").setInputFiles(file);
    await expect(page.locator(".history-row")).toHaveCount(1);
    await expect(page.getByRole("status").filter({ hasText: "Imported 1 finding" })).toBeVisible();
  }
  await page.getByRole("button", { name: /^Delete check:/ }).click();
  await expect(page.getByRole("status").filter({ hasText: "Check deleted" })).toBeVisible();
  await expect(page.locator(".history-row")).toHaveCount(0);
});
test("keyboard commands and dialogs work", async ({ page }) => {
  await page.keyboard.press("Control+k");
  await expect(page.getByLabel("Claim or article URL", { exact: true })).toBeFocused();
  await page.keyboard.press("Control+Shift+p");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Open service status", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
  }
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("dialog").locator(":focus")).toHaveCount(1);
  await page.getByRole("dialog").click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open service status", exact: true }),
  ).toBeFocused();
});
test("every view fits desktop, mobile and landscape without runtime errors", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
    [375, 812],
    [360, 800],
    [320, 568],
    [844, 390],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    for (const name of ["Investigate", "Settings", "Your statistics", "Check history"]) {
      await page.getByRole("button", { name, exact: true }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        await page
          .locator("main")
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      ).toBe(true);
    }
    const service = page.getByRole("button", { name: "Open service status", exact: true });
    await service.scrollIntoViewIfNeeded();
    const bounds = await service.boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height!);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Investigate", exact: true }).click();
  await page.screenshot({ path: info.outputPath("claimlens-desktop.png") });
  expect(errors).toEqual([]);
});

test("appearance preferences, titles and public metadata work", async ({ page }) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page).toHaveTitle("Settings — Verity");
  await page.getByLabel("Colour preference").selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Colour preference").selectOption("system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByLabel("Colour preference").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const path of ["/privacy.html", "/terms.html", "/favicon.svg", "/og-claimlens.png"])
    expect((await page.request.get(path)).status()).toBe(200);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /og-claimlens.png$/,
  );
});

test("history sorting, source details and insights reflect actual saved checks", async ({
  page,
}) => {
  for (const claim of [
    "Lightning never strikes the same place twice.",
    "Water boils at 100 degrees Celsius at sea level.",
  ]) {
    await page.getByRole("button", { name: "New check", exact: true }).click();
    await page.getByLabel("Claim or article URL", { exact: true }).fill(claim);
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(page.getByRole("article", { name: "Fact-check result" })).toBeVisible();
  }
  const detail = page.locator(".source-detail").first();
  await expect(detail).not.toHaveAttribute("open", "");
  await detail.locator("summary").click();
  await expect(detail.locator(".source-credibility")).toBeVisible();
  await detail.locator("summary").click();
  await expect(detail).not.toHaveAttribute("open", "");
  await page.getByRole("button", { name: "Check history", exact: true }).click();
  await expect(page.locator(".history-row")).toHaveCount(2);
  await page.getByLabel("Sort history").selectOption("oldest");
  await expect(page.locator(".history-open h2").first()).toContainText("Lightning");
  await page.getByLabel("Sort history").selectOption("newest");
  await expect(page.locator(".history-open h2").first()).toContainText("Water");
  await page.getByLabel("Sort history").selectOption("sources");
  await expect(page.locator(".history-source-count").first()).toContainText("2 sources");
  await page.getByRole("button", { name: "Your statistics", exact: true }).click();
  await expect(page.locator(".statistics-summary")).toContainText("Total checks 2");
  await expect(page.locator(".activity-chart li")).toHaveCount(14);
  await expect(page.locator(".evidence-coverage")).toContainText("2 of 2 claims");
  await expect(page.getByRole("button", { name: "Open commands", exact: true })).toHaveCount(0);
});
