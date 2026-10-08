import * as THREE from "three";
import { heightAt } from "../world/WorldGenerator.js";
import { smoothstep } from "../utils/Noise.js";
const dummy = new THREE.Object3D();
export class Birds {
  constructor(scene, chunks) {
    this.chunks = chunks;
    this.clock = { value: 0 };
    this.perches = [];
    this.lastCell = "";
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          0, 0, -0.24, 0.78, 0.02, 0.04, 0.25, 0, 0.25, 0, 0, -0.24, -0.78,
          0.02, 0.04, -0.25, 0, 0.25, -0.05, 0, -0.3, 0.05, 0, -0.3, 0, 0.035,
          0.35,
        ],
        3,
      ),
    );
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x41463b,
      side: THREE.DoubleSide,
      roughness: 1,
    });
    mat.onBeforeCompile = (s) => {
      s.uniforms.uBirdTime = this.clock;
      s.vertexShader = "uniform float uBirdTime;\n" + s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
 float phase=instanceMatrix[3].x*.13;float flap=sin(uBirdTime*7.+phase);transformed.y+=abs(position.x)*flap*.5;`,
      );
    };
    this.mesh = new THREE.InstancedMesh(g, mat, 24);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  update(t, player) {
    this.clock.value = t;
    const cell = Math.floor(player.x / 128) + "," + Math.floor(player.z / 128);
    if (cell !== this.lastCell) {
      this.lastCell = cell;
      this.perches = [];
      for (const c of this.chunks.chunks.values())
        for (const tree of c.trees)
          if (
            tree.type !== 5 &&
            Math.hypot(tree.x - player.x, tree.z - player.z) < 200
          )
            this.perches.push(tree);
    }
    for (let i = 0; i < 24; i++) {
      const perch = this.perches[(i * 7) % Math.max(1, this.perches.length)],
        phase = (t * 0.045 + i * 0.123) % 1,
        flight =
          smoothstep(0.14, 0.24, phase) * (1 - smoothstep(0.82, 0.94, phase));
      const anchorX = perch?.x ?? player.x + Math.sin(i) * 60,
        anchorZ = perch?.z ?? player.z + Math.cos(i) * 60;
      const base =
        heightAt(anchorX, anchorZ) +
        (perch ? (perch.type === 1 ? 13 : 9) * perch.scale : 12);
      const angle = t * 0.12 + i * 2.4;
      const x = anchorX + Math.sin(angle) * flight * 24,
        z = anchorZ + Math.cos(angle) * flight * 24;
      dummy.position.set(x, base + flight * (7 + Math.sin(angle * 2) * 3), z);
      dummy.rotation.set(0, -angle - Math.PI / 2, Math.sin(angle) * 0.1);
      dummy.scale.set(flight > 0.05 ? 0.7 : 0.13, 0.7, 0.7);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
