export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export function hash(x, z, seed = 1837) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
export function noise(x, z) {
  const a = Math.floor(x),
    b = Math.floor(z),
    u = x - a,
    v = z - b;
  return lerp(
    lerp(hash(a, b), hash(a + 1, b), u * u * (3 - 2 * u)),
    lerp(hash(a, b + 1), hash(a + 1, b + 1), u * u * (3 - 2 * u)),
    v * v * (3 - 2 * v),
  );
}
export function fbm(x, z, octaves = 5) {
  let v = 0,
    a = 0.5;
  for (let i = 0; i < octaves; i++) {
    v += a * (noise(x, z) * 2 - 1);
    x = x * 2.03 + 12.7;
    z = z * 2.03 - 7.1;
    a *= 0.5;
  }
  return v;
}
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
