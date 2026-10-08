import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
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
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://localhost:5173/");
  await page.waitForFunction(() => window.__serenity?.snapshot().ready, null, {
    timeout: 90000,
  });
  await page.locator("#enter").click();
  await page.waitForFunction(() => window.__serenity.player.locked, null, {
    timeout: 10000,
  });
  const start = await page.evaluate(() => window.__serenity.snapshot());
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(1500);
  await page.keyboard.up("KeyW");
  const moved = await page.evaluate(() => window.__serenity.snapshot());
  assert.ok(
    Math.hypot(
      moved.position[0] - start.position[0],
      moved.position[2] - start.position[2],
    ) > 1,
    "W moves player",
  );
  await page.keyboard.press("Space");
  await page.waitForTimeout(120);
  assert.equal(
    await page.evaluate(() => window.__serenity.player.grounded),
    false,
    "jump leaves ground",
  );
  await page.waitForTimeout(1300);
  assert.equal(
    await page.evaluate(() => window.__serenity.player.grounded),
    true,
    "jump lands",
  );
  await page.keyboard.down("ControlLeft");
  await page.waitForTimeout(500);
  assert.ok(
    await page.evaluate(() => window.__serenity.player.eye < 1.2),
    "crouch changes eye height",
  );
  await page.keyboard.up("ControlLeft");
  await page.screenshot({ path: "test-results/exploration.png" });
  await page.evaluate(() => document.exitPointerLock());
  await page.locator("#settings").waitFor({ state: "visible" });
  await page.locator("#quality").selectOption("High");
  await page.waitForTimeout(2000);
  assert.equal(
    await page.evaluate(() => window.__serenity.qualityName),
    "High",
  );
  await page.locator("#fov").fill("88");
  await page.locator("#fov").dispatchEvent("input");
  assert.equal(await page.evaluate(() => window.__serenity.camera.fov), 88);
  await page.locator("#time").fill("22");
  await page.locator("#time").dispatchEvent("input");
  await page.locator("#cycle").uncheck();
  await page.waitForTimeout(700);
  assert.ok(
    await page.evaluate(() => window.__serenity.uniforms.uDay.value < 0.1),
    "night lighting",
  );
  await page.screenshot({ path: "test-results/settings-night.png" });
  await page.locator("#quality").selectOption("Medium");
  await page.locator("#time").fill("8.4");
  await page.locator("#time").dispatchEvent("input");
  await page.locator("#resume").click();
  await page.waitForFunction(() => window.__serenity.player.locked);
  const collision = await page.evaluate(() => {
    const w = window.__serenity,
      c = [...w.chunks.chunks.values()].find((c) => c.trees.length);
    return w.chunks.collides(c.trees[0].x, c.trees[0].z);
  });
  assert.ok(collision, "tree collision");
  const before = await page.evaluate(() => window.__serenity.snapshot());
  for (const x of [400, 700, 950, 102, 400, 700, 950, 102]) {
    await page.evaluate((x) => {
      const w = window.__serenity;
      w.player.position.x = x;
      w.player.position.z = 300;
      w.player.position.y = 250;
      w.chunks.update(w.player.position, 49);
      w.grass.update(w.player.position);
    }, x);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => window.__serenity.chunks.queue.length === 0);
  const streamed = await page.evaluate(() => window.__serenity.snapshot());
  assert.equal(streamed.chunks, 49);
  assert.ok(
    streamed.geometries < before.geometries + 80,
    "streaming releases old geometries",
  );
  await page.evaluate(() => document.exitPointerLock());
  await page.locator("#exit").click();
  assert.equal(await page.locator("#intro").isVisible(), true);
  assert.equal(await page.evaluate(() => window.__serenity.started), false);
  await page.evaluate(() => {
    const w = window.__serenity;
    w.setQuality(1);
    w.reduceQuality();
  });
  assert.equal(
    await page.evaluate(() => window.__serenity.qualityName),
    "Low",
    "adaptive quality downshift",
  );
  assert.equal(
    await page.evaluate(() => window.__serenity.chunks.chunks.size),
    49,
    "quality changes preserve terrain",
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/intro-1280.png" });
  console.log(
    JSON.stringify(
      {
        passed: true,
        start,
        moved,
        streamed,
        gpu: await page.evaluate(() => window.__serenity.monitor.gpu),
        errors,
      },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
