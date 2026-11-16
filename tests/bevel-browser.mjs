import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await page
  .getByTitle("90° shafts · spherical involute", { exact: true })
  .click();
const width = page.getByRole("spinbutton", {
  name: "Cone face width",
  exact: true,
});
await width.waitFor();
await page.getByRole("button", { name: "Run mesh test", exact: true }).click();
await page
  .getByText("No overlap at 48 sampled phases.", { exact: true })
  .waitFor();
await page.getByTitle("Play simulation", { exact: true }).click();
await page.waitForTimeout(800);
await page.getByTitle("Pause simulation", { exact: true }).click();
await page.getByTitle("Reset motion", { exact: true }).click();
await page.screenshot({ path: "test-results/bevel-fixed.png", fullPage: true });
await width.fill("10");
assert.equal(await width.inputValue(), "10");
await page.getByRole("button", { name: "Run mesh test", exact: true }).click();
await page
  .getByText("No overlap at 48 sampled phases.", { exact: true })
  .waitFor();
await width.fill("30");
await width.blur();
assert.ok(await page.getByText(/cone face width exceeds/).isVisible());
await width.fill("8");
await width.blur();
await page.getByRole("button", { name: "Export", exact: true }).click();
await page.getByRole("dialog").getByRole("button", { name: /^STEP/ }).click();
const promise = page.waitForEvent("download");
await page.getByRole("button", { name: "Download STEP", exact: true }).click();
await (await promise).saveAs("test-results/bevel-fixed.step");
assert.deepEqual(errors, []);
console.log(
  "Bevel browser checks passed: controls, editable 10 mm width, 3D sweep, motion, invalid width rejection, STEP download.",
);
await browser.close();
