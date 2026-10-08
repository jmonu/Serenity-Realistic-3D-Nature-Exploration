import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { seeded, hash } from "../utils/Noise.js";
import {
  heightAt,
  slopeAt,
  forestDensity,
  pathDistance,
  CHUNK,
} from "../world/WorldGenerator.js";
import noiseGLSL from "../shaders/noise.glsl?raw";
const dummy = new THREE.Object3D();
export const SPECIES = [
  "Oak",
  "Pine",
  "Birch",
  "Maple",
  "Palm",
  "Deadwood",
  "Sapling",
];
function branch(a, b, r1, r2) {
  const dir = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r2, r1, dir.length(), 7, 2);
  g.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize(),
    ),
  );
  g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
  return g;
}
function leafTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d"),
    r = seeded(827);
  ctx.strokeStyle = "#8b9870";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(128, 238);
  ctx.quadraticCurveTo(135, 130, 118, 15);
  ctx.stroke();
  for (let branch = 0; branch < 12; branch++) {
    const y = 35 + branch * 15,
      side = branch % 2 ? 1 : -1,
      ex = 128 + side * (30 + r() * 65),
      ey = y - 15 - r() * 20;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(128, y + 15);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    for (let j = 0; j < 9; j++) {
      const f = j / 9,
        x = 128 + (ex - 128) * f,
        py = y + 15 + (ey - y - 15) * f;
      for (const sign of [-1, 1]) {
        ctx.save();
        ctx.translate(x, py);
        ctx.rotate(side * 0.6 + sign * 0.65);
        ctx.fillStyle = ["#f0f0d8", "#c9d4ac", "#e4e8ca", "#b7c39a"][
          Math.floor(r() * 4)
        ];
        ctx.beginPath();
        ctx.ellipse(sign * 7, 0, 4 + r() * 3, 9 + r() * 5, 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function barkTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext("2d"),
    r = seeded(25);
  ctx.fillStyle = "#85705c";
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? "32,24,18" : "172,160,131"},${r() * 0.5})`;
    ctx.fillRect(r() * 128, r() * 256, 1 + r() * 3, 3 + r() * 65);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function prototype(species, lod) {
  const random = seeded(820 + species * 41),
    barks = [],
    leaves = [];
  const pine = species === 1,
    palm = species === 4,
    dead = species === 5;
  const h = pine ? 15 : species === 2 ? 13 : species === 6 ? 5 : 10;
  const trunk = species === 2 ? 0.18 : species === 6 ? 0.09 : 0.33;
  const bend = (random() - 0.5) * 1.2;
  barks.push(
    branch(
      new THREE.Vector3(),
      new THREE.Vector3(bend, h * 0.87, 0),
      trunk,
      0.045,
    ),
  );
  const count = lod === 0 ? (pine ? 16 : 12) : lod === 1 ? 7 : 4;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399 + random(),
      y = pine ? h * (0.2 + (0.7 * i) / count) : h * (0.45 + 0.4 * random()),
      extent = pine ? (1 - y / h) * 4.9 : palm ? 4 : 2.2 + random() * 2.2;
    const start = new THREE.Vector3((bend * y) / h, y, 0),
      end = new THREE.Vector3(
        Math.cos(angle) * extent + bend,
        y + (pine ? 0.25 : palm ? -0.5 : 1.5),
        Math.sin(angle) * extent,
      );
    barks.push(branch(start, end, pine ? 0.055 : 0.085, 0.017));
    if (dead) continue;
    const leafCount = lod === 0 ? (pine ? 60 : 75) : lod === 1 ? 25 : 12;
    for (let j = 0; j < leafCount; j++) {
      const theta = random() * Math.PI * 2,
        rr = Math.sqrt(random());
      let p = end.clone();
      if (pine) {
        p.lerp(start, random() * 0.8);
        p.x += Math.cos(theta) * rr * 0.8;
        p.z += Math.sin(theta) * rr * 0.8;
        p.y += (random() - 0.3) * 1.2;
      } else if (palm) {
        p.lerp(start, random());
        p.y += Math.sin((j / leafCount) * Math.PI) * 1.3;
        p.x += (random() - 0.5) * 0.8;
        p.z += (random() - 0.5) * 0.8;
      } else {
        p.x += Math.cos(theta) * rr * 1.8;
        p.z += Math.sin(theta) * rr * 1.8;
        p.y += (random() - 0.45) * 2.1;
      }
      const s =
        lod === 0 ? (pine ? 0.6 : 0.6) + random() * 0.5 : lod === 1 ? 1.4 : 2.2;
      const g = new THREE.PlaneGeometry(
        s * (pine ? 0.65 : 1),
        s * (pine ? 1.8 : 1.25),
      );
      g.rotateX((random() - 0.5) * 2.6);
      g.rotateY(random() * Math.PI * 2);
      g.rotateZ(random() * Math.PI);
      g.translate(...p.toArray());
      leaves.push(g);
    }
  }
  const bark = mergeGeometries(barks);
  barks.forEach((g) => g.dispose());
  const foliage = leaves.length ? mergeGeometries(leaves) : null;
  leaves.forEach((g) => g.dispose());
  return { bark, foliage, h };
}
export class TreeSystem {
  constructor(uniforms) {
    this.uniforms = uniforms;
    const map = leafTexture(),
      barkMap = barkTexture();
    this.bark = new THREE.MeshStandardMaterial({
      map: barkMap,
      roughness: 1,
      color: 0xb9ada0,
    });
    this.birch = new THREE.MeshStandardMaterial({
      map: barkMap,
      roughness: 0.96,
      color: 0xf3ede0,
    });
    this.leaf = new THREE.MeshStandardMaterial({
      map,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.9,
      color: 0x82905a,
    });
    this.leaf.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniforms);
      s.vertexShader =
        "uniform float uTime; uniform float uWind;\n" +
        noiseGLSL +
        s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
 vec3 wp=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;
 float gust=fbm2(wp.xz*.045+vec2(uTime*.09,uTime*.03))-.5;
 transformed.x+=gust*uWind*pow(max(position.y,0.)*.075,2.)*.6;
 transformed.z+=sin(uTime*1.6+wp.x*.8+wp.z)*.025*min(position.y,3.);`,
      );
    };
    this.prototypes = SPECIES.map((_, i) =>
      [0, 1, 2].map((l) => prototype(i, l)),
    );
  }
  placements(cx, cz) {
    const r = seeded(hash(cx, cz) * 4294967295),
      out = [];
    for (let i = 0; i < 100; i++) {
      const x = (cx + r()) * CHUNK,
        z = (cz + r()) * CHUNK,
        y = heightAt(x, z);
      const density = forestDensity(x, z);
      if (
        y < 4.5 ||
        y > 215 ||
        slopeAt(x, z) > 0.9 ||
        pathDistance(x, z) < 5 ||
        r() > 0.08 + density * 0.83
      )
        continue;
      let type = r() < 0.6 ? 1 : r() < 0.45 ? 0 : r() < 0.6 ? 2 : 3;
      if (r() < 0.04) type = 5;
      if (r() < 0.08) type = 6;
      if (z > 650 && y < 40 && r() < 0.2) type = 4;
      out.push({
        x,
        y,
        z,
        type,
        scale: 0.7 + r() * 0.65,
        rotation: r() * Math.PI * 2,
        radius: type === 6 ? 0.19 : 0.55,
      });
    }
    return out;
  }
  bakeDistant(renderer) {
    this.atlas = new THREE.WebGLRenderTarget(1792, 512);
    const scene = new THREE.Scene(),
      cam = new THREE.OrthographicCamera(-7, 7, 17, -1, 0.1, 60);
    cam.position.set(0, 0, 24);
    cam.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xdce8cf, 0x38442b, 2));
    const sun = new THREE.DirectionalLight(0xffedc6, 2.3);
    sun.position.set(-5, 10, 12);
    scene.add(sun);
    const old = renderer.getRenderTarget(),
      clear = new THREE.Color();
    renderer.getClearColor(clear);
    const alpha = renderer.getClearAlpha(),
      auto = renderer.autoClear;
    renderer.setRenderTarget(this.atlas);
    renderer.setClearColor(0, 0);
    renderer.clear();
    renderer.autoClear = false;
    for (let type = 0; type < 7; type++) {
      const p = this.prototypes[type][0],
        group = new THREE.Group();
      for (const [geo, mat] of [
        [p.bark, type === 2 ? this.birch : this.bark],
        [p.foliage, this.leaf],
      ]) {
        if (!geo) continue;
        const mesh = new THREE.InstancedMesh(geo, mat, 1);
        dummy.position.set(0, 0, 0);
        dummy.rotation.set(0, 0.6, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(0, dummy.matrix);
        if (mat === this.leaf)
          mesh.setColorAt(0, new THREE.Color().setHSL(0.25, 0.27, 0.47));
        group.add(mesh);
      }
      scene.add(group);
      renderer.setViewport(type * 256, 0, 256, 512);
      renderer.render(scene, cam);
      scene.remove(group);
      group.traverse((o) => {
        if (o.isInstancedMesh) o.dispose();
      });
    }
    renderer.setRenderTarget(old);
    renderer.setClearColor(clear, alpha);
    renderer.autoClear = auto;
    renderer.setViewport(0, 0, innerWidth, innerHeight);
    this.billboardGeo = new THREE.PlaneGeometry(14, 18);
    this.billboardGeo.translate(0, 8, 0);
    this.billboardMat = new THREE.MeshBasicMaterial({
      map: this.atlas.texture,
      alphaTest: 0.35,
      side: THREE.DoubleSide,
    });
    this.billboardMat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, this.uniforms);
      s.vertexShader = "varying float vSpecies;\n" + s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
    vSpecies=instanceColor.r;
    vec3 base=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
    vec3 right=normalize(vec3(cameraPosition.z-base.z,0.,base.x-cameraPosition.x));
    transformed=right*position.x+vec3(0.,position.y,0.);`,
      );
      s.fragmentShader =
        "uniform float uDay; varying float vSpecies;\n" + s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <color_fragment>",
        "",
      );
      s.fragmentShader = s.fragmentShader.replace(
        "#include <map_fragment>",
        `diffuseColor*=texture2D(map,vec2((vMapUv.x+vSpecies)/7.,vMapUv.y));diffuseColor.rgb*=.16+.84*uDay;`,
      );
    };
  }
  distant(placements) {
    const group = new THREE.Group();
    if (!placements.length) return group;
    const mesh = new THREE.InstancedMesh(
      this.billboardGeo,
      this.billboardMat,
      placements.length,
    );
    placements.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(t.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new THREE.Color().setRGB(t.type, 1, 1));
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
    return group;
  }
  build(placements, lod) {
    if (lod > 0 && this.atlas) return this.distant(placements);
    const group = new THREE.Group();
    if (this.focus) {
      const far = placements.filter(
        (t) => Math.hypot(t.x - this.focus.x, t.z - this.focus.z) > 105,
      );
      group.add(this.distant(far));
      placements = placements.filter(
        (t) => Math.hypot(t.x - this.focus.x, t.z - this.focus.z) <= 105,
      );
    }
    for (let type = 0; type < SPECIES.length; type++) {
      const items = placements.filter((t) => t.type === type);
      if (!items.length) continue;
      const p = this.prototypes[type][lod];
      for (const [geo, mat] of [
        [p.bark, type === 2 ? this.birch : this.bark],
        [p.foliage, this.leaf],
      ]) {
        if (!geo) continue;
        const mesh = new THREE.InstancedMesh(geo, mat, items.length);
        items.forEach((t, i) => {
          dummy.position.set(t.x, t.y - 0.08, t.z);
          dummy.rotation.set(0, t.rotation, 0);
          dummy.scale.set(
            t.scale * (0.8 + hash(i, type) * 0.4),
            t.scale,
            t.scale,
          );
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          if (mat === this.leaf) {
            const c = new THREE.Color().setHSL(
              type === 3 ? 0.22 : type === 1 ? 0.25 : 0.23,
              0.19 + hash(i, 43) * 0.15,
              0.38 + hash(i, type) * 0.17,
            );
            mesh.setColorAt(i, c);
          }
        });
        mesh.castShadow = lod === 0;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        group.add(mesh);
      }
    }
    return group;
  }
}
