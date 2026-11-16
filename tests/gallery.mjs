import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await fs.mkdir("test-results/gallery", { recursive: true });
for (const name of [
  "Spur",
  "Helical",
  "Herringbone",
  "Bevel",
  "Spiral bevel",
  "Internal",
  "Rack & pinion",
  "Worm drive",
  "Worm wheel",
]) {
  await page
    .locator(".type-card")
    .filter({ has: page.getByText(name, { exact: true }) })
    .click();
  await page.waitForTimeout(550);
  await page.locator(".viewport").screenshot({
    path: `test-results/gallery/${name.replace(/\W/g, "_")}.png`,
  });
}
await page
  .locator(".type-card")
  .filter({ has: page.getByText("Bevel", { exact: true }) })
  .click();
await page.waitForTimeout(500);
await page.screenshot({
  path: "test-results/gallery/workbench.png",
  fullPage: true,
});
console.log({ errors });
await browser.close();
