import * as THREE from "three";
import noiseGLSL from "../shaders/noise.glsl?raw";
import { clamp, smoothstep } from "../utils/Noise.js";
export class Sky {
  constructor(scene, uniforms) {
    this.scene = scene;
    this.uniforms = uniforms;
    this.time = 8.4;
    this.cycle = true;
    this.sun = new THREE.DirectionalLight(0xffe8b9, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -65,
      right: 65,
      top: 65,
      bottom: -65,
      near: 1,
      far: 350,
    });
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.7;
    this.sun.shadow.radius = 2;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xcbdcd9, 0x576148, 2);
    scene.add(this.hemi);
    this.sunDirection = { value: new THREE.Vector3() };
    uniforms.uSun = this.sunDirection;
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { ...uniforms, uSun: this.sunDirection },
      vertexShader:
        "varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        noiseGLSL +
        `
 uniform float uTime;uniform float uDay;uniform vec3 uSun;varying vec3 vDirection;
 void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);float warm=1.-smoothstep(.03,.35,uSun.y);
 vec3 horizon=mix(vec3(.68,.76,.72),vec3(.88,.60,.35),warm*.7);
 vec3 zenith=mix(vec3(.25,.46,.61),vec3(.32,.37,.48),warm);
 vec3 sky=mix(horizon,zenith,pow(h,.5));sky=mix(vec3(.007,.015,.035),sky,uDay);
 float sun=dot(d,normalize(uSun));sky+=vec3(1.,.85,.6)*pow(max(sun,0.),60.)*.23*uDay;sky+=vec3(2.6,2.2,1.6)*smoothstep(.99965,.99985,sun)*uDay;
 vec2 uv=d.xz/(max(d.y,.015))*.65+vec2(uTime*.0015,0.);float clouds=fbm2(uv*1.6);float cloud=smoothstep(.52,.72,clouds)*smoothstep(.01,.18,d.y);
 sky=mix(sky,mix(vec3(.045,.06,.09),vec3(.92,.91,.83),uDay),cloud*.67);
 float star=step(.9985,hash21(floor(d.xz/(d.y+.8)*1100.)))*pow(1.-uDay,3.)*smoothstep(.05,.3,d.y);sky+=star*.65;
 sky+=vec3(.7,.78,.85)*smoothstep(.9994,.9997,dot(d,-normalize(uSun)))*(1.-uDay);
 gl_FragColor=vec4(sky,1.);#include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`.replace(";#include", ";\n#include"),
    });
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1900, 32, 20),
      material,
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    scene.fog = new THREE.FogExp2(0xb5c5b8, 0.00165);
  }
  update(dt, pos) {
    if (this.cycle) this.time = (this.time + dt * 0.006) % 24;
    const a = ((this.time - 6) / 12) * Math.PI;
    const dir = this.sunDirection.value
      .set(Math.cos(a) * 0.65, Math.sin(a), -0.55)
      .normalize();
    const day = smoothstep(-0.12, 0.18, Math.sin(a));
    this.uniforms.uDay.value = day;
    this.mesh.position.copy(pos);
    this.sun.position.copy(pos).addScaledVector(dir, 160);
    if (dir.y < 0)
      this.sun.position.copy(pos).add(new THREE.Vector3(-60, 110, 60));
    this.sun.target.position.copy(pos);
    this.sun.intensity = day * 2.5 + 0.12;
    this.sun.color.setHSL(0.105, clamp(0.5 - dir.y * 0.3, 0.15, 0.6), 0.85);
    this.hemi.intensity = 0.17 + day * 1.6;
    this.scene.fog.color.setRGB(
      0.055 + day * 0.57,
      0.075 + day * 0.61,
      0.12 + day * 0.54,
    );
    this.uniforms.uFog.value.copy(this.scene.fog.color);
    this.scene.fog.density = 0.0015 + (1 - day) * 0.0004;
  }
  setQuality(q) {
    this.sun.castShadow = q > 0;
    const size = q > 1 ? 2048 : 1024;
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }
}
