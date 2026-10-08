import { Birds } from "./Birds.js";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { heightAt, slopeAt, LAKE } from "../world/WorldGenerator.js";
import { seeded } from "../utils/Noise.js";
const temp = new THREE.Object3D();
function ellipsoid(x, y, z, sx, sy, sz) {
  const g = new THREE.SphereGeometry(1, 10, 7);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}
function combine(gs) {
  const g = mergeGeometries(gs);
  gs.forEach((v) => v.dispose());
  return g;
}
function limb(x, y, z, length, r) {
  const g = new THREE.CylinderGeometry(r * 0.75, r, length, 7);
  g.translate(x, y - length * 0.5, z);
  return g;
}
function animalModel(type) {
  const deer = type === "Deer",
    rabbit = type === "Rabbit";
  const coat = new THREE.MeshStandardMaterial({
    color: deer ? 0x8d6f4d : rabbit ? 0x95897a : 0x7b5841,
    roughness: 1,
  });
  const dark = new THREE.MeshStandardMaterial({
      color: 0x242821,
      roughness: 0.85,
    }),
    cream = new THREE.MeshStandardMaterial({ color: 0xbeb698, roughness: 1 });
  const root = new THREE.Group(),
    moving = new THREE.Group(),
    head = new THREE.Group(),
    legs = [];
  const bodyGeos = deer
    ? [
        ellipsoid(0, 1.17, 0, 0.34, 0.42, 0.75),
        ellipsoid(0, 1.45, -0.55, 0.21, 0.46, 0.23),
        ellipsoid(0, 1.2, 0.72, 0.1, 0.12, 0.22),
      ]
    : [
        ellipsoid(0, 0.28, 0, 0.2, 0.25, 0.35),
        ellipsoid(0, 0.22, 0.3, 0.14, 0.15, rabbit ? 0.13 : 0.38),
      ];
  moving.add(new THREE.Mesh(combine(bodyGeos), coat));
  head.position.set(0, deer ? 1.76 : 0.5, deer ? -0.65 : -0.26);
  const headGeos = [
    ellipsoid(
      0,
      0,
      0,
      deer ? 0.18 : 0.15,
      deer ? 0.2 : 0.16,
      deer ? 0.29 : 0.19,
    ),
    ellipsoid(0, -0.07, deer ? -0.24 : -0.15, deer ? 0.11 : 0.08, 0.1, 0.16),
  ];
  for (const s of [-1, 1]) {
    const ear = ellipsoid(
      s * (deer ? 0.15 : 0.09),
      deer ? 0.22 : 0.21,
      0.035,
      deer ? 0.075 : 0.045,
      deer ? 0.18 : rabbit ? 0.22 : 0.08,
      0.045,
    );
    headGeos.push(ear);
  }
  head.add(new THREE.Mesh(combine(headGeos), coat));
  const eyes = [];
  for (const s of [-1, 1])
    eyes.push(
      ellipsoid(s * (deer ? 0.165 : 0.137), 0.015, -0.12, 0.023, 0.029, 0.029),
    );
  head.add(new THREE.Mesh(combine(eyes), dark));
  head.add(
    new THREE.Mesh(
      ellipsoid(0, -0.045, deer ? -0.41 : -0.295, 0.055, 0.042, 0.025),
      dark,
    ),
  );
  moving.add(head);
  for (const s of [-1, 1])
    for (const z of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(
        s * (deer ? 0.23 : 0.14),
        deer ? 1.13 : 0.28,
        z * (deer ? 0.47 : 0.19),
      );
      const len = deer ? 1.05 : 0.24;
      const leg = new THREE.Mesh(
        combine([
          limb(0, 0, 0, len, deer ? 0.045 : 0.04),
          ellipsoid(0, -len, 0.015, deer ? 0.055 : 0.055, 0.045, 0.075),
        ]),
        coat,
      );
      pivot.add(leg);
      moving.add(pivot);
      legs.push(pivot);
    }
  moving.add(
    new THREE.Mesh(
      ellipsoid(
        0,
        deer ? 1.1 : 0.3,
        deer ? 0.65 : 0.29,
        deer ? 0.16 : 0.1,
        deer ? 0.18 : 0.08,
        0.06,
      ),
      cream,
    ),
  );
  root.add(moving);
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  root.updateMatrixWorld(true);
  const parts = [];
  moving.traverse((o) => {
    if (o.isMesh) {
      parts.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    }
  });
  const simplified = new THREE.Mesh(combine(parts), coat);
  root.add(simplified);
  simplified.visible = false;
  return { root, moving, head, legs, simplified };
}
export class AnimalManager {
  constructor(scene, chunks) {
    this.scene = scene;
    this.birdSystem = new Birds(scene, chunks);
    this.r = seeded(783);
    this.animals = [];
    this.time = 0;
    this.limit = 20;
    for (let i = 0; i < 24; i++) {
      const type = i < 8 ? "Deer" : i < 17 ? "Rabbit" : "Squirrel";
      const model = animalModel(type);
      const a = {
        ...model,
        type,
        x: 0,
        z: 0,
        angle: this.r() * 6.28,
        phase: this.r() * 10,
        timer: this.r() * 5,
        mode: "graze",
        speed: 0,
      };
      this.relocate(a, { x: 100, z: 110 }, i === 0 ? 15 : 100);
      scene.add(a.root);
      this.animals.push(a);
    }
    this.makeAirborne();
    this.makeFish();
  }
  relocate(a, p, radius = 150) {
    for (let i = 0; i < 100; i++) {
      const angle = this.r() * 6.28,
        r = 15 + this.r() * radius;
      const x = p.x + Math.cos(angle) * r,
        z = p.z + Math.sin(angle) * r;
      if (heightAt(x, z) > 3.5 && slopeAt(x, z) < 0.65) {
        a.x = x;
        a.z = z;
        return;
      }
    }
    a.x = p.x + 10;
    a.z = p.z + 10;
  }
  makeAirborne() {
    const wings = new THREE.PlaneGeometry(0.22, 0.24);
    this.butterflies = new THREE.InstancedMesh(
      wings,
      new THREE.MeshStandardMaterial({
        color: 0xe2c57c,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      32,
    );
    this.butterflies.frustumCulled = false;
    this.scene.add(this.butterflies);
  }
  makeFish() {
    const geo = combine([
      ellipsoid(0, 0, 0, 0.11, 0.18, 0.48),
      ellipsoid(0, 0, 0.48, 0.04, 0.23, 0.18),
    ]);
    this.fish = new THREE.InstancedMesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x657f72,
        metalness: 0.15,
        roughness: 0.6,
      }),
      18,
    );
    this.fish.frustumCulled = false;
    this.scene.add(this.fish);
  }
  setQuality(q) {
    this.limit = [9, 18, 24, 24][q];
  }
  update(dt, player) {
    this.time += dt;
    for (let index = 0; index < this.animals.length; index++) {
      const a = this.animals[index],
        distance = Math.hypot(a.x - player.x, a.z - player.z);
      if (distance > 240) this.relocate(a, player);
      a.root.visible = index < this.limit && distance < 150;
      if (!a.root.visible) continue;
      const flee = distance < (a.type === "Deer" ? 11 : 7);
      a.timer -= dt;
      if (flee) {
        a.mode = "flee";
        a.angle = Math.atan2(a.x - player.x, a.z - player.z) + Math.PI;
        a.timer = 1.5;
      } else if (a.timer < 0) {
        a.mode = this.r() > 0.5 ? "walk" : "graze";
        a.timer = 3 + this.r() * 7;
        a.angle += (this.r() - 0.5) * 2;
      }
      const speed =
        a.mode === "flee"
          ? a.type === "Deer"
            ? 5
            : 3
          : a.mode === "walk"
            ? a.type === "Deer"
              ? 0.8
              : 0.45
            : 0;
      a.speed = THREE.MathUtils.lerp(a.speed, speed, Math.min(dt * 4, 1));
      const nx = a.x - Math.sin(a.angle) * a.speed * dt,
        nz = a.z - Math.cos(a.angle) * a.speed * dt;
      if (heightAt(nx, nz) > 3.3 && slopeAt(nx, nz) < 0.9) {
        a.x = nx;
        a.z = nz;
      } else a.angle += dt * 3;
      a.root.position.set(a.x, heightAt(a.x, a.z), a.z);
      a.root.rotation.y = a.angle;
      const phase = this.time * (a.mode === "flee" ? 13 : 5) + a.phase;
      for (let j = 0; j < 4; j++)
        a.legs[j].rotation.x =
          Math.sin(phase + (j % 3 === 0 ? 0 : Math.PI)) *
          0.45 *
          Math.min(a.speed, 1);
      a.moving.position.y =
        a.type === "Deer"
          ? Math.abs(Math.sin(phase)) * 0.015
          : Math.abs(Math.sin(phase)) * Math.min(a.speed, 0.4) * 0.5;
      a.head.rotation.x =
        a.mode === "graze"
          ? 0.55 + Math.sin(this.time * 0.7 + a.phase) * 0.2
          : Math.sin(this.time * 0.8 + a.phase) * 0.06;
      a.head.rotation.y = Math.sin(this.time * 0.3 + a.phase) * 0.12;
      const near = distance < 45;
      a.moving.visible = near;
      a.simplified.visible = !near;
      a.root.traverse((o) => {
        if (o.isMesh) o.castShadow = distance < 45;
      });
    }
    this.birdSystem.update(this.time, player);
    for (let i = 0; i < 32; i++) {
      const x =
          player.x +
          Math.sin(i * 12.31) * 35 +
          Math.sin(this.time * 0.4 + i) * 2,
        z =
          player.z + Math.cos(i * 8.1) * 35 + Math.cos(this.time * 0.3 + i) * 2;
      temp.position.set(
        x,
        Math.max(3, heightAt(x, z)) + 1.2 + Math.sin(this.time * 1.2 + i) * 0.5,
        z,
      );
      temp.rotation.set(
        0.8,
        Math.sin(this.time + i) * 2,
        Math.sin(this.time * 10 + i) * 1.1,
      );
      temp.scale.set(1, 1, 1);
      temp.updateMatrix();
      this.butterflies.setMatrixAt(i, temp.matrix);
    }
    this.butterflies.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 18; i++) {
      const t = this.time * 0.15 + i * 2.4,
        x = LAKE.x + Math.cos(t) * (20 + i * 4),
        z = LAKE.z + Math.sin(t) * (40 + i * 6);
      temp.position.set(x, 1 + Math.sin(t * 2) * 0.4, z);
      temp.rotation.set(0, -t, Math.sin(this.time * 4 + i) * 0.09);
      temp.scale.setScalar(0.7 + (i % 4) * 0.2);
      temp.updateMatrix();
      this.fish.setMatrixAt(i, temp.matrix);
    }
    this.fish.instanceMatrix.needsUpdate = true;
  }
  nearest(p) {
    let result = null,
      d = 12;
    for (const a of this.animals) {
      const dist = Math.hypot(a.x - p.x, a.z - p.z);
      if (a.root.visible && dist < d) {
        d = dist;
        result = a;
      }
    }
    return result;
  }
}
