import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--disable-gpu-sandbox"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173");
await page
  .getByRole("heading", { name: "A little precision. A lot of possibility." })
  .waitFor();
await page.locator("canvas").waitFor();
await page.waitForTimeout(2500);
await fs.mkdir("test-results", { recursive: true });
await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
await page.getByRole("button", { name: "Run mesh test", exact: true }).click();
await page
  .getByText("No overlap at 48 sampled phases.", { exact: true })
  .waitFor();
await page.getByTitle("Play simulation", { exact: true }).click();
await page.waitForTimeout(700);
await page.getByTitle("Pause simulation", { exact: true }).click();
assert.ok(
  await page.getByTitle("Play simulation", { exact: true }).isVisible(),
);
await page.getByRole("button", { name: "Driven gear B" }).click();
await page
  .getByRole("spinbutton", { name: "Number of teeth", exact: true })
  .fill("48");
assert.equal(
  await page
    .getByRole("spinbutton", { name: "Number of teeth", exact: true })
    .inputValue(),
  "48",
);
await page
  .getByRole("spinbutton", { name: "Normal module", exact: true })
  .fill("3");
assert.ok(await page.getByText("Modules must match to mesh.").isVisible());
await page.getByRole("button", { name: "Snap to mesh", exact: true }).click();
assert.equal(
  await page
    .getByRole("spinbutton", { name: "Normal module", exact: true })
    .inputValue(),
  "2",
);
await page.getByRole("button", { name: "Manufacturing", exact: true }).click();
await page
  .getByRole("spinbutton", { name: "Pair backlash", exact: true })
  .fill("0.25");
await page
  .getByRole("spinbutton", { name: "Bore allowance", exact: true })
  .fill("0.3");
await page.getByRole("button", { name: "Geometry", exact: true }).click();
for (const title of [
  "Parallel shafts · angled teeth",
  "Opposed helices · balanced thrust",
  "90° shafts · spherical involute",
  "90° shafts · curved teeth · Concept geometry",
  "Pinion and internal ring",
  "Rotary to linear motion",
  "Crossed shafts · high reduction · Concept geometry",
  "Wheel-led worm drive · Concept geometry",
  "Parallel shafts · straight teeth",
]) {
  await page.getByTitle(title, { exact: true }).click();
  await page.waitForTimeout(120);
  assert.ok(await page.locator("canvas").isVisible());
}
await page.getByRole("button", { name: "2D profile", exact: true }).click();
assert.ok(await page.locator(".profile-view svg").isVisible());
await page.getByRole("button", { name: "3D assembly", exact: true }).click();
for (const format of ["STL", "STEP", "DXF"]) {
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp("^" + format) })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download " + format, exact: true })
    .click();
  const download = await downloadPromise;
  await download.saveAs("test-results/" + download.suggestedFilename());
}
await page.getByRole("button", { name: "Save project", exact: true }).click();
await page.waitForTimeout(800);
await page.reload();
assert.ok(
  await page
    .getByRole("spinbutton", { name: "Number of teeth", exact: true })
    .isVisible(),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
assert.equal(
  await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  ),
  false,
);
await page.getByRole("button", { name: "Export", exact: true }).click();
assert.ok(await page.getByRole("dialog").isVisible());
await page.getByRole("button", { name: "Close dialog", exact: true }).click();
assert.deepEqual(errors, []);
console.log(
  "Browser checks passed: simulation, parameters, snapping, tolerances, all 9 families, profile, 3 exports, persistence, mobile layout.",
);
await browser.close();
