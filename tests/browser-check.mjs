import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
await fs.mkdir("test-results", { recursive: true });
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
await page.goto("http://localhost:5173/");
await page.waitForFunction(
  () =>
    window.__serenity?.snapshot().ready ||
    !document.querySelector("#error").hidden,
  null,
  { timeout: 90000 },
);
await page.waitForTimeout(3500);
await page.screenshot({ path: "test-results/intro.png" });
console.log(
  JSON.stringify(
    {
      errors,
      errorPanel: await page.locator("#error").isVisible(),
      snapshot: await page.evaluate(() => window.__serenity?.snapshot()),
    },
    null,
    2,
  ),
);
await browser.close();
if (errors.length) process.exitCode = 1;
