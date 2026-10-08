import { fbm, noise, smoothstep, clamp } from "../utils/Noise.js";
export const WORLD_HALF = 2048,
  CHUNK = 128,
  WATER_LEVEL = 2.4;
export const LAKE = { x: 30, z: -105, rx: 145, rz: 205 };
export const SPAWN = { x: 102, z: 118 };
export function riverX(z) {
  return 45 + Math.sin(z * 0.018) * 19 + Math.sin(z * 0.006) * 28;
}
export function lakeDistance(x, z) {
  return Math.sqrt(
    ((x - LAKE.x) / LAKE.rx) ** 2 + ((z - LAKE.z) / LAKE.rz) ** 2,
  );
}
export function pathDistance(x, z) {
  return Math.abs(
    x - (128 + Math.sin(z * 0.012) * 24 + Math.sin(z * 0.035) * 5),
  );
}
export function heightAt(x, z) {
  const lake = lakeDistance(x, z),
    river = Math.abs(x - riverX(z));
  const rolling =
    12 + fbm(x * 0.006, z * 0.006) * 18 + fbm(x * 0.032, z * 0.032, 3) * 2.4;
  const mountainMask = smoothstep(
    340,
    1100,
    Math.hypot(x * 0.83, (z + 80) * 0.95),
  );
  const peaks =
    85 +
    Math.pow(1 - Math.abs(fbm(x * 0.0025 + 40, z * 0.0025, 5)), 3) * 260 +
    fbm(x * 0.008, z * 0.008) * 70;
  let h = rolling + mountainMask * peaks;
  const shore = smoothstep(0.82, 1.15, lake);
  h = (-5 + fbm(x * 0.019, z * 0.019, 3) * 1.2) * (1 - shore) + h * shore;
  if (z > 70 && z < 1100) {
    const r = smoothstep(5, 17, river) * smoothstep(60, 130, z);
    const blend = (1 - smoothstep(5, 17, river)) * smoothstep(70, 130, z);
    h = h * (1 - blend) + (WATER_LEVEL - 2.5) * blend;
  }
  // A woodland pond, a secluded upland pool, and an inlet waterfall basin.
  for (const p of [
    [-280, 160, 29],
    [320, -400, 38],
  ]) {
    const d = Math.hypot(x - p[0], z - p[1]);
    h =
      h * smoothstep(p[2] - 0.5, p[2] + 16, d) +
      (WATER_LEVEL - 2) * (1 - smoothstep(p[2] - 0.5, p[2] + 16, d));
  }
  return h;
}
export function slopeAt(x, z) {
  const dx = (heightAt(x + 1, z) - heightAt(x - 1, z)) * 0.5,
    dz = (heightAt(x, z + 1) - heightAt(x, z - 1)) * 0.5;
  return Math.hypot(dx, dz);
}
export function forestDensity(x, z) {
  return (
    clamp((noise(x * 0.008 + 16, z * 0.008 - 8) - 0.3) * 2.2) *
    smoothstep(1.04, 1.26, lakeDistance(x, z)) *
    (1 - smoothstep(110, 250, heightAt(x, z)))
  );
}
export function surfaceAt(x, z) {
  const h = heightAt(x, z);
  return h < WATER_LEVEL + 0.2
    ? "water"
    : slopeAt(x, z) > 0.65 || h > 100
      ? "rock"
      : pathDistance(x, z) < 2.7
        ? "dirt"
        : "grass";
}
export function biomeAt(x, z) {
  return heightAt(x, z) > 105
    ? "The High Ridges"
    : lakeDistance(x, z) < 1.2
      ? "Silvermere Shore"
      : forestDensity(x, z) > 0.5
        ? "Whispering Woods"
        : "Wildflower Meadows";
}
export function walkHeight(x, z) {
  if (onBridge(x, z)) return BRIDGE_LEVEL;
  return heightAt(x, z);
}
export function onBridge(x, z) {
  return Math.abs(z - 220) < 2.15 && Math.abs(x - riverX(220)) < 17.5;
}
export const BRIDGE_LEVEL =
  Math.max(
    heightAt(riverX(220) - 17.5, 220),
    heightAt(riverX(220) + 17.5, 220),
  ) + 0.12;
