import * as THREE from "three";
import { riverX, heightAt, BRIDGE_LEVEL } from "../world/WorldGenerator.js";
import { seeded } from "../utils/Noise.js";
export class Details {
  constructor(scene, uniforms) {
    this.scene = scene;
    this.u = uniforms;
    const wood = new THREE.MeshStandardMaterial({
      color: 0x786044,
      roughness: 0.95,
    });
    const bridge = new THREE.Group(),
      x = riverX(220);
    for (let i = 0; i < 35; i++) {
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(0.96, 0.22, 4.3),
        wood,
      );
      plank.position.set(x - 17 + i, 5, 220);
      plank.receiveShadow = true;
      plank.castShadow = true;
      bridge.add(plank);
    }
    for (let i = 0; i < 7; i++)
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.13, 1.5, 6),
          wood,
        );
        post.position.set(x - 16 + i * 5.3, 5.7, 220 + side * 2);
        post.castShadow = true;
        bridge.add(post);
      }
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(34, 0.13, 0.16), wood);
      rail.position.set(x, 6.3, 220 + side * 2);
      bridge.add(rail);
    }
    bridge.position.y = BRIDGE_LEVEL - 5.1;
    scene.add(bridge);
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#564c37";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#d9d6b0";
    ctx.strokeRect(15, 15, 482, 226);
    ctx.fillStyle = "#ece3be";
    ctx.textAlign = "center";
    ctx.font = "27px Georgia";
    ctx.fillText("SILVERMERE VALLEY", 256, 80);
    ctx.font = "18px sans-serif";
    ctx.fillText("Shoreline trail  →", 256, 137);
    ctx.fillText("Leave only footprints.", 256, 183);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    this.signPosition = new THREE.Vector3(143, heightAt(143, 125), 125);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 1.25, 0.13),
      new THREE.MeshStandardMaterial({ map, roughness: 1 }),
    );
    sign.position.copy(this.signPosition).y += 2;
    sign.rotation.y = 0.45;
    scene.add(sign);
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.11, 2.7, 6),
      wood,
    );
    post.position.copy(this.signPosition).y += 1.2;
    scene.add(post);
    const r = seeded(99),
      points = [];
    for (let i = 0; i < 180; i++)
      points.push((r() - 0.5) * 100, r() * 14, (r() - 0.5) * 100);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    this.particles = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        vertexShader:
          "uniform float uTime;uniform vec3 uPlayer;varying float vGlow;void main(){vec3 p=position; p.x+=sin(uTime*.13+position.z)*2.;p.y+=sin(uTime*.18+position.x)*.8;p.xz+=floor(uPlayer.xz/40.)*40.;p.y+=uPlayer.y;vGlow=.45+.4*sin(uTime+position.x);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(35./-mv.z,1.,4.);}",
        fragmentShader:
          "uniform float uDay;varying float vGlow;void main(){float a=1.-smoothstep(.12,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(mix(vec3(.65,1.,.24),vec3(1.,.96,.78),uDay),a*vGlow*(.55-uDay*.28));}",
      }),
    );
    this.particles.frustumCulled = false;
    scene.add(this.particles);
  }
}
