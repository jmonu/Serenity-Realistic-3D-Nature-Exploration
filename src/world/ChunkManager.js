import { flowerGeometry } from "../vegetation/Groundcover.js";
import * as THREE from "three";
import { TreeSystem } from "../vegetation/TreeSystem.js";
import { heightAt, slopeAt, pathDistance, CHUNK } from "./WorldGenerator.js";
import { seeded, hash } from "../utils/Noise.js";
const dummy = new THREE.Object3D();
export class ChunkManager {
  constructor(scene, terrain, uniforms) {
    this.scene = scene;
    this.terrain = terrain;
    this.trees = new TreeSystem(uniforms);
    this.chunks = new Map();
    this.queue = [];
    this.quality = 1;
    this.rockGeo = new THREE.IcosahedronGeometry(1, 2);
    const p = this.rockGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const f =
        0.85 +
        hash(Math.round(p.getX(i) * 40), Math.round(p.getZ(i) * 40)) * 0.3;
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
    }
    this.rockGeo.computeVertexNormals();
    this.rockMat = new THREE.MeshStandardMaterial({
      color: 0x77776b,
      roughness: 0.96,
    });
    this.logGeo = new THREE.CylinderGeometry(0.3, 0.44, 6, 8);
    this.logGeo.rotateZ(Math.PI / 2);
    this.logMat = this.trees.bark;
    this.flowerGeo = flowerGeometry();
    this.flowerMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
    });
    this.bushGeo = this.trees.prototypes[0][2].foliage.clone();
    this.bushGeo.translate(0, -6.2, 0);
    this.bushGeo.scale(0.2, 0.2, 0.2);
  }
  lod(cx, cz) {
    return Math.max(Math.abs(cx - this.cx), Math.abs(cz - this.cz)) < 2
      ? 0
      : Math.max(Math.abs(cx - this.cx), Math.abs(cz - this.cz)) < 3
        ? 1
        : 2;
  }
  update(pos, budget = 1) {
    this.trees.focus = pos;
    for (const c of this.chunks.values())
      for (const mesh of c.group.children) {
        if (mesh.userData.distanceCull && mesh.boundingSphere) {
          const center = mesh.boundingSphere.center;
          mesh.visible =
            Math.hypot(center.x - pos.x, center.z - pos.z) <
            mesh.userData.distanceCull + mesh.boundingSphere.radius;
        }
      }
    // Quality swaps keep the terrain alive while replacing vegetation batches.
    if (this.qualityQueue?.length) {
      const c = this.qualityQueue.shift();
      if (c.group.parent) {
        c.trees = c.allTrees.filter(
          (_, i) => this.quality !== 0 || i % 3 !== 0,
        );
        c.group.remove(c.forest);
        this.disposeInstances(c.forest);
        c.forest = this.trees.build(c.trees, c.lod);
        c.group.add(c.forest);
      }
    }
    const focusKey = Math.floor(pos.x / 32) + "," + Math.floor(pos.z / 32);
    if (focusKey !== this.focusKey) {
      this.focusKey = focusKey;
      this.lodQueue = [...this.chunks.values()].filter((c) => c.lod === 0);
    }
    if (this.lodQueue?.length) {
      const c = this.lodQueue.shift();
      if (c.group.parent) {
        c.group.remove(c.forest);
        this.disposeInstances(c.forest);
        c.forest = this.trees.build(c.trees, 0);
        c.group.add(c.forest);
      }
    }
    const cx = Math.floor(pos.x / CHUNK),
      cz = Math.floor(pos.z / CHUNK);
    if (cx !== this.cx || cz !== this.cz) {
      this.cx = cx;
      this.cz = cz;
      const desired = new Set();
      this.queue = [];
      for (let z = cz - 3; z <= cz + 3; z++)
        for (let x = cx - 3; x <= cx + 3; x++) {
          const k = x + "," + z;
          desired.add(k);
          if (!this.chunks.has(k)) this.queue.push({ x, z, k });
          else {
            const c = this.chunks.get(k),
              l = this.lod(x, z);
            if (l !== c.lod) {
              c.group.remove(c.forest);
              this.disposeInstances(c.forest);
              c.forest = this.trees.build(c.trees, l);
              c.group.add(c.forest);
              c.lod = l;
            }
          }
        }
      this.queue.sort(
        (a, b) =>
          Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz),
      );
      this.desired = desired;
    }
    for (let i = 0; i < budget && this.queue.length; i++)
      this.generate(this.queue.shift());
    if (!this.queue.length) {
      this.terrain.updateCenter(this.cx, this.cz);
      for (const [k, c] of this.chunks)
        if (!this.desired.has(k)) {
          this.scene.remove(c.group);
          this.disposeInstances(c.group);
          c.terrain.geometry.dispose();
          this.chunks.delete(k);
        }
    }
  }
  disposeInstances(group) {
    group.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.userData.disposeMaterial) o.material.dispose();
    });
  }
  generate({ x, z, k }) {
    const group = new THREE.Group(),
      terrain = this.terrain.chunk(x, z),
      allTrees = this.trees.placements(x, z),
      trees = allTrees.filter((_, i) => this.quality !== 0 || i % 3 !== 0),
      lod = this.lod(x, z),
      forest = this.trees.build(trees, lod);
    group.add(terrain, forest);
    const r = seeded(hash(x, z, 183) * 4294967295),
      rocks = [],
      flowers = [],
      logs = [],
      bushes = [];
    for (let i = 0; i < 34; i++) {
      const px = (x + r()) * 128,
        pz = (z + r()) * 128,
        y = heightAt(px, pz);
      if (y < 2 || pathDistance(px, pz) < 3) continue;
      rocks.push({
        x: px,
        y: y - 0.2,
        z: pz,
        radius: 0.6 + r() * 2.7,
        scale: 0.5 + r(),
      });
    }
    for (let i = 0; i < 160; i++) {
      const px = (x + r()) * 128,
        pz = (z + r()) * 128,
        y = heightAt(px, pz);
      if (
        y < 3.5 ||
        y > 70 ||
        slopeAt(px, pz) > 0.4 ||
        pathDistance(px, pz) < 3
      )
        continue;
      flowers.push({
        x: px,
        y,
        z: pz,
        radius: 0.6 + r() * 0.6,
        scale: 1,
      });
    }
    for (const t of trees.slice(0, 14)) {
      const px = t.x + 3,
        pz = t.z + 2,
        y = heightAt(px, pz);
      if (y > 3.5)
        bushes.push({ x: px, y, z: pz, radius: 0.7 + r() * 0.7, scale: 1 });
    }
    for (const t of trees.slice(0, 2)) {
      logs.push({
        x: t.x + 5,
        y: heightAt(t.x + 5, t.z) + 0.2,
        z: t.z,
        radius: 1,
        scale: 1,
      });
    }
    for (const [items, g, m] of [
      [rocks, this.rockGeo, this.rockMat],
      [flowers, this.flowerGeo, this.flowerMat],
      [logs, this.logGeo, this.logMat],
      [bushes, this.bushGeo, this.trees.leaf],
    ]) {
      const mesh = new THREE.InstancedMesh(g, m, items.length);
      items.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        if (items === flowers) dummy.position.y += p.radius * 0.65 * 0.275;
        dummy.rotation.set(0, r() * Math.PI * 2, r() * 0.1);
        dummy.scale.set(p.radius, p.radius * p.scale * 0.65, p.radius * 0.8);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        if (items === flowers)
          mesh.setColorAt(
            i,
            new THREE.Color().setHSL(r() > 0.4 ? 0.13 : 0.75, 0.35, 0.7),
          );
        else mesh.setColorAt(i, new THREE.Color().setScalar(0.7 + r() * 0.35));
      });
      mesh.castShadow = lod === 0 && items !== flowers;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      if (items === flowers || items === bushes || items === logs)
        mesh.userData.distanceCull = items === flowers ? 65 : 130;
      group.add(mesh);
    }
    this.scene.add(group);
    this.chunks.set(k, {
      group,
      terrain,
      forest,
      allTrees,
      trees,
      rocks,
      flowers,
      lod,
    });
  }
  collides(x, z, radius = 0.35) {
    const cx = Math.floor(x / CHUNK),
      cz = Math.floor(z / CHUNK);
    for (let iz = cz - 1; iz <= cz + 1; iz++)
      for (let ix = cx - 1; ix <= cx + 1; ix++) {
        const c = this.chunks.get(ix + "," + iz);
        if (!c) continue;
        for (const t of c.trees)
          if (Math.hypot(t.x - x, t.z - z) < t.radius * t.scale + radius)
            return true;
        for (const t of c.rocks)
          if (Math.hypot(t.x - x, t.z - z) < t.radius * 0.82 + radius)
            return true;
      }
    return false;
  }
  nearest(pos, max = 5) {
    let result = null,
      d = max;
    for (const c of this.chunks.values())
      for (const t of c.trees) {
        const distance = Math.hypot(t.x - pos.x, t.z - pos.z);
        if (distance < d) {
          d = distance;
          result = t;
        }
      }
    return result;
  }
  setQuality(q) {
    this.quality = q;
    this.qualityQueue = [...this.chunks.values()];
  }
}
