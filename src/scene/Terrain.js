import * as THREE from "three";
import { heightAt, CHUNK } from "../world/WorldGenerator.js";
import noiseGLSL from "../shaders/noise.glsl?raw";
export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.center = { value: new THREE.Vector2() };
    this.material = this.createMaterial(false);
    this.farMaterial = this.createMaterial(true);
    this.far = new THREE.Mesh(
      this.geometry(-2048, -2048, 4096, 384),
      this.farMaterial,
    );
    this.far.receiveShadow = true;
    scene.add(this.far);
  }
  geometry(x, z, size, res) {
    const g = new THREE.PlaneGeometry(size, size, res, res);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i) + x + size / 2,
        pz = p.getZ(i) + z + size / 2;
      p.setXYZ(i, px, heightAt(px, pz), pz);
    }
    g.computeVertexNormals();
    return g;
  }
  createMaterial(far) {
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.98,
    });
    m.onBeforeCompile = (s) => {
      s.uniforms.uCenter = this.center;
      s.vertexShader =
        "varying vec3 vGround; varying vec3 vSlope;\n" + s.vertexShader;
      s.vertexShader = s.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvGround=position; vSlope=normal;",
      );
      s.fragmentShader =
        "uniform vec2 uCenter; varying vec3 vGround; varying vec3 vSlope;\n" +
        noiseGLSL +
        s.fragmentShader;
      s.fragmentShader = s.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
 ${far ? "if(max(abs(vGround.x-uCenter.x),abs(vGround.z-uCenter.y))<447.9)discard;" : ""}
 float macro=fbm2(vGround.xz*.035);float micro=noise2(vGround.xz*4.);float grit=mix(noise2(vGround.xz*28.),.5,smoothstep(3.,14.,distance(cameraPosition,vGround)));micro=mix(micro,.5,smoothstep(15.,80.,distance(cameraPosition,vGround)));
 float slope=1.-normalize(vSlope).y;
 vec3 grass=mix(vec3(.105,.155,.045),vec3(.25,.29,.095),macro);
 vec3 rock=mix(vec3(.19,.20,.17),vec3(.38,.37,.32),micro*.45+macro*.55);
 float path=abs(vGround.x-(128.+sin(vGround.z*.012)*24.+sin(vGround.z*.035)*5.));
 vec3 soil=mix(vec3(.19,.145,.09),vec3(.34,.27,.17),micro);
 vec3 base=mix(grass,rock,smoothstep(.13,.48,slope));
 base=mix(base,rock,smoothstep(110.,235.,vGround.y)*.75);
 base=mix(base,soil,(1.-smoothstep(2.,4.,path))*(1.-smoothstep(75.,105.,vGround.y)));
 base=mix(base,vec3(.16,.155,.10),1.-smoothstep(2.4,4.7,vGround.y));
 base=mix(base,vec3(.65,.66,.62),smoothstep(245.,330.,vGround.y)*(1.-smoothstep(.3,.7,slope)));
 diffuseColor.rgb*=base*(.85+grit*.27);`,
      );
    };
    m.customProgramCacheKey = () => `terrain-${far}`;
    return m;
  }
  chunk(cx, cz) {
    const mesh = new THREE.Mesh(
      this.geometry(cx * CHUNK, cz * CHUNK, CHUNK, 32),
      this.material,
    );
    mesh.receiveShadow = true;
    return mesh;
  }
  updateCenter(cx, cz) {
    this.center.value.set(cx * CHUNK + 64, cz * CHUNK + 64);
  }
}
