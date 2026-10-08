import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
export function flowerGeometry() {
  const parts = [];
  const stem = new THREE.CylinderGeometry(0.009, 0.014, 0.45, 4);
  stem.translate(0, -0.05, 0);
  parts.push([stem, 0x465427]);
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3,
      petal = new THREE.SphereGeometry(0.06, 5, 3);
    petal.scale(1, 0.3, 1.7);
    petal.rotateY(angle);
    petal.translate(Math.sin(angle) * 0.055, 0.18, Math.cos(angle) * 0.055);
    parts.push([petal, 0xf1e6c5]);
  }
  const center = new THREE.SphereGeometry(0.037, 6, 4);
  center.translate(0, 0.19, 0);
  parts.push([center, 0xcbab41]);
  for (const [g, color] of parts) {
    const c = new THREE.Color(color),
      colors = [];
    for (let i = 0; i < g.attributes.position.count; i++)
      colors.push(c.r, c.g, c.b);
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }
  const geometry = mergeGeometries(parts.map((p) => p[0]));
  parts.forEach((p) => p[0].dispose());
  return geometry;
}
