import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "webgl2" ? null : original.call(this, type, ...args);
    };
  });
  await page.goto("http://localhost:5173/");
  await page.locator("#error").waitFor({ state: "visible" });
  assert.match(await page.locator("#error-message").textContent(), /WebGL 2/);
  assert.equal(await page.locator("#error button").isVisible(), true);
  console.log("WebGL unavailable fallback passed.");
} finally {
  await browser.close();
}
