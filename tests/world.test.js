import test from "node:test";
import assert from "node:assert/strict";
import {
  heightAt,
  slopeAt,
  walkHeight,
  riverX,
  SPAWN,
  WATER_LEVEL,
  WORLD_HALF,
  BRIDGE_LEVEL,
} from "../src/world/WorldGenerator.js";
import { seeded } from "../src/utils/Noise.js";
test("world is deterministic, varied and finite across the complete 16 km² domain", () => {
  const r = seeded(991),
    heights = [];
  for (let i = 0; i < 2000; i++) {
    const x = (r() - 0.5) * WORLD_HALF * 2,
      z = (r() - 0.5) * WORLD_HALF * 2,
      h = heightAt(x, z);
    assert.ok(Number.isFinite(h));
    assert.equal(h, heightAt(x, z));
    heights.push(h);
  }
  assert.ok(Math.max(...heights) > 200);
  assert.ok(Math.min(...heights) < WATER_LEVEL);
  assert.ok(heightAt(SPAWN.x, SPAWN.z) > WATER_LEVEL);
  assert.ok(slopeAt(SPAWN.x, SPAWN.z) < 1.4);
});
test("lake basin, river and bridge use consistent world coordinates", () => {
  assert.ok(heightAt(30, -105) < WATER_LEVEL - 3);
  for (let z = 150; z < 1000; z += 50)
    assert.ok(heightAt(riverX(z), z) < WATER_LEVEL);
  assert.equal(walkHeight(riverX(220), 220), BRIDGE_LEVEL);
  assert.ok(Math.abs(BRIDGE_LEVEL - heightAt(riverX(220) - 17.5, 220)) < 0.55);
  assert.ok(Math.abs(BRIDGE_LEVEL - heightAt(riverX(220) + 17.5, 220)) < 0.55);
  assert.equal(walkHeight(200, 300), heightAt(200, 300));
});
test("terrain remains continuous across chunk boundaries", () => {
  for (let x = -1024; x <= 1024; x += 128)
    for (let z = -1024; z <= 1024; z += 31) {
      assert.ok(
        Math.abs(heightAt(x - 0.001, z) - heightAt(x + 0.001, z)) < 0.1,
      );
    }
});
