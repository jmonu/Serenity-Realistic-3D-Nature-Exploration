import * as THREE from "three";
import { seeded, hash } from "../utils/Noise.js";
import { heightAt, pathDistance, slopeAt } from "../world/WorldGenerator.js";
import vertex from "../shaders/grassVertex.glsl?raw";
import fragment from "../shaders/grassFragment.glsl?raw";
import noiseGLSL from "../shaders/noise.glsl?raw";
const dummy = new THREE.Object3D();
export class GrassSystem {
  constructor(scene, uniforms) {
    this.scene = scene;
    this.tiles = new Map();
    this.density = 420;
    this.material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: noiseGLSL + vertex,
      fragmentShader: fragment,
      side: THREE.DoubleSide,
    });
    const positions = [],
      indices = [],
      r = seeded(53);
    for (let blade = 0; blade < 7; blade++) {
      const angle = r() * 6.28,
        x = (r() - 0.5) * 0.38,
        z = (r() - 0.5) * 0.38,
        height = 0.28 + r() * 0.35,
        width = 0.007 + r() * 0.006,
        bend = 0.06 + r() * 0.12,
        base = positions.length / 3;
      for (const [px, py] of [
        [-width, 0],
        [width, 0],
        [-width * 0.55 + bend * 0.3, height * 0.5],
        [width * 0.55 + bend * 0.3, height * 0.5],
        [bend, height],
      ])
        positions.push(x + Math.cos(angle) * px, py, z + Math.sin(angle) * px);
      indices.push(
        base,
        base + 1,
        base + 2,
        base + 1,
        base + 3,
        base + 2,
        base + 2,
        base + 3,
        base + 4,
      );
    }
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    this.geometry.setIndex(indices);
    this.geometry.computeVertexNormals();
  }
  setQuality(q) {
    this.density = [200, 420, 650, 900][q];
    this.clear();
  }
  clear() {
    for (const m of this.tiles.values()) {
      this.scene.remove(m);
      m.dispose();
    }
    this.tiles.clear();
    this.key = "";
  }
  update(pos) {
    const cx = Math.floor(pos.x / 16),
      cz = Math.floor(pos.z / 16),
      key = cx + "," + cz;
    if (this.key === key) return;
    this.key = key;
    const wanted = new Set();
    for (let z = cz - 4; z <= cz + 4; z++)
      for (let x = cx - 4; x <= cx + 4; x++) {
        if (Math.hypot(x - cx, z - cz) > 4.5) continue;
        const near = Math.abs(x - cx) <= 1 && Math.abs(z - cz) <= 1,
          k = x + "," + z + "," + near;
        wanted.add(k);
        if (this.tiles.has(k)) continue;
        const r = seeded(hash(x, z, 84) * 4294967295),
          items = [];
        const count = this.density * (near ? 3.5 : 1);
        for (let i = 0; i < count; i++) {
          const px = (x + r()) * 16,
            pz = (z + r()) * 16,
            py = heightAt(px, pz);
          if (
            py < 2.9 ||
            py > 155 ||
            pathDistance(px, pz) < 2.5 ||
            slopeAt(px, pz) > 1
          )
            continue;
          items.push([px, py, pz, r(), r(), r()]);
        }
        const m = new THREE.InstancedMesh(
          this.geometry,
          this.material,
          items.length,
        );
        items.forEach((p, i) => {
          dummy.position.set(p[0], p[1] - 0.015, p[2]);
          dummy.rotation.set(0, p[3] * Math.PI * 2, 0);
          dummy.scale.setScalar(0.65 + p[4] * 0.7);
          dummy.scale.y *= 0.7 + p[5] * 0.5;
          dummy.updateMatrix();
          m.setMatrixAt(i, dummy.matrix);
        });
        m.computeBoundingSphere();
        if (m.boundingSphere) m.boundingSphere.radius += 2;
        this.scene.add(m);
        this.tiles.set(k, m);
      }
    for (const [k, m] of this.tiles) {
      if (!wanted.has(k)) {
        this.scene.remove(m);
        m.dispose();
        this.tiles.delete(k);
      }
    }
  }
}
