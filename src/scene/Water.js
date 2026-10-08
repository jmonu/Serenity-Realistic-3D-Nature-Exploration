import * as THREE from "three";
import { heightAt, riverX, WATER_LEVEL } from "../world/WorldGenerator.js";
import noiseGLSL from "../shaders/noise.glsl?raw";
import vertexShader from "../shaders/waterVertex.glsl?raw";
import fragmentShader from "../shaders/waterFragment.glsl?raw";
export class Water {
  constructor(scene, uniforms) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.reflection = new THREE.WebGLRenderTarget(512, 512, {
      type: THREE.HalfFloatType,
    });
    this.mirror = new THREE.PerspectiveCamera();
    this.reflectionMatrix = new THREE.Matrix4();
    this.uniforms = {
      ...uniforms,
      uReflection: { value: this.reflection.texture },
      uReflectionMatrix: { value: this.reflectionMatrix },
      uHasReflection: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader,
      fragmentShader: noiseGLSL + fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.addPatch(30, -105, 330, 455, 100, 130);
    this.addPatch(-280, 160, 85, 85, 30, 30);
    this.addPatch(320, -400, 110, 110, 30, 30);
    const positions = [],
      grounds = [],
      indices = [];
    for (let i = 0; i <= 220; i++) {
      const z = 70 + i * 4.7;
      for (let j = 0; j < 5; j++) {
        const x = riverX(z) + (j - 2) * 6;
        positions.push(x, WATER_LEVEL, z);
        grounds.push(heightAt(x, z));
        if (i < 220 && j < 4) {
          const a = i * 5 + j;
          indices.push(a, a + 5, a + 1, a + 1, a + 5, a + 6);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute(
      "groundHeight",
      new THREE.Float32BufferAttribute(grounds, 1),
    );
    g.setIndex(indices);
    this.group.add(new THREE.Mesh(g, this.material));
    scene.add(this.group);
    this.frame = 0;
    this.quality = 1;
    this.makeFalls(uniforms);
  }
  addPatch(x, z, w, h, rx, rz) {
    if (w === 330) {
      w = 620;
      h = 740;
      rx = 155;
      rz = 185;
    }
    const g = new THREE.PlaneGeometry(w, h, rx, rz);
    g.rotateX(-Math.PI / 2);
    g.translate(x, WATER_LEVEL, z);
    const p = g.attributes.position,
      heights = [];
    for (let i = 0; i < p.count; i++)
      heights.push(heightAt(p.getX(i), p.getZ(i)));
    g.setAttribute(
      "groundHeight",
      new THREE.Float32BufferAttribute(heights, 1),
    );
    this.group.add(new THREE.Mesh(g, this.material));
  }
  makeFalls(u) {
    const mat = new THREE.ShaderMaterial({
      uniforms: u,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      vertexShader:
        "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        noiseGLSL +
        "uniform float uTime;uniform float uDay;varying vec2 vUv;void main(){float n=fbm2(vec2(vUv.x*18.,vUv.y*5.+uTime*2.));float edge=smoothstep(0.,.15,vUv.x)*smoothstep(1.,.85,vUv.x);gl_FragColor=vec4(vec3(.73,.85,.8)*(.2+uDay*.8),edge*(.2+n*.65));}",
    });
    const falls = new THREE.Mesh(new THREE.PlaneGeometry(6, 10, 1, 1), mat);
    falls.rotation.y = Math.PI / 2;
    falls.position.set(-110, 7.2, -113);
    this.group.add(falls);
    const cliff = new THREE.Mesh(
      new THREE.DodecahedronGeometry(6, 1),
      new THREE.MeshStandardMaterial({ color: 0x696b5c, roughness: 1 }),
    );
    cliff.scale.set(0.65, 1.15, 1.5);
    cliff.position.set(-114, 5.5, -113);
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    this.scene.add(cliff);
  }
  update(renderer, camera) {
    this.frame++;
    if (
      this.quality === 0 ||
      this.frame % (this.quality === 3 ? 2 : this.quality === 2 ? 4 : 6) !==
        0 ||
      camera.position.y < WATER_LEVEL + 0.15
    )
      return;
    const mirror = this.mirror;
    mirror.copy(camera);
    mirror.position.copy(camera.position);
    mirror.position.y = 2 * WATER_LEVEL - camera.position.y;
    const direction = camera.getWorldDirection(new THREE.Vector3());
    direction.y *= -1;
    mirror.up.set(0, -1, 0);
    mirror.lookAt(mirror.position.clone().add(direction));
    mirror.updateMatrixWorld();
    mirror.matrixWorldInverse.copy(mirror.matrixWorld).invert();
    this.reflectionMatrix
      .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
      .multiply(mirror.projectionMatrix)
      .multiply(mirror.matrixWorldInverse);
    const target = renderer.getRenderTarget(),
      shadow = renderer.shadowMap.autoUpdate,
      shadowDirty = renderer.shadowMap.needsUpdate,
      clipping = renderer.clippingPlanes;
    this.group.visible = false;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = false;
    renderer.clippingPlanes = [
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -WATER_LEVEL + 0.05),
    ];
    renderer.setRenderTarget(this.reflection);
    renderer.clear();
    renderer.render(this.scene, mirror);
    renderer.setRenderTarget(target);
    renderer.clippingPlanes = clipping;
    renderer.shadowMap.autoUpdate = shadow;
    renderer.shadowMap.needsUpdate = shadowDirty;
    this.group.visible = true;
    this.uniforms.uHasReflection.value = 1;
  }
  setQuality(q) {
    this.quality = q;
    this.uniforms.uHasReflection.value = 0;
    this.reflection.setSize(q > 1 ? 768 : 384, q > 1 ? 768 : 384);
  }
}
