import * as THREE from "three";
import { Terrain } from "./Terrain.js";
import { Sky } from "./Sky.js";
import { Water } from "./Water.js";
import { Details } from "./Details.js";
import { ChunkManager } from "../world/ChunkManager.js";
import { GrassSystem } from "../vegetation/GrassSystem.js";
import { AnimalManager } from "../animals/AnimalManager.js";
import { PlayerController } from "../player/PlayerController.js";
import { AudioManager } from "../audio/AudioManager.js";
import { PerformanceMonitor } from "../utils/PerformanceMonitor.js";
import { SPAWN, biomeAt, surfaceAt } from "../world/WorldGenerator.js";
import { SPECIES } from "../vegetation/TreeSystem.js";
const yieldFrame = () => new Promise((r) => requestAnimationFrame(r));
export const QUALITY = ["Low", "Medium", "High", "Ultra"];
export class World {
  constructor(canvas, callbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      innerWidth / innerHeight,
      0.08,
      3500,
    );
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
      console.error(
        gl.getProgramInfoLog(program),
        gl.getShaderInfoLog(vs),
        gl.getShaderInfoLog(fs),
      );
      callbacks.error(
        "A graphics shader could not start. Update your browser and graphics driver, then try again.",
      );
      this.failed = true;
    };
    this.uniforms = {
      uTime: { value: 0 },
      uWind: { value: 1 },
      uPlayer: { value: new THREE.Vector3(SPAWN.x, 0, SPAWN.z) },
      uFog: { value: new THREE.Color(0xb5c5b8) },
      uDay: { value: 1 },
    };
    this.audio = new AudioManager();
    this.quality = 1;
    this.qualityName = "Medium";
    this.started = false;
    this.clock = new THREE.Clock();
    this.resize = () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    };
    window.addEventListener("resize", this.resize);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.failed = true;
      callbacks.error(
        "The graphics connection was interrupted. Close other graphics-heavy tabs and reload Serenity.",
      );
    });
    this.resize();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  }
  async init() {
    const report = this.callbacks.progress;
    report("Terrain", 0);
    await yieldFrame();
    this.terrain = new Terrain(this.scene);
    this.sky = new Sky(this.scene, this.uniforms);
    report("Vegetation", 1);
    await yieldFrame();
    this.chunks = new ChunkManager(this.scene, this.terrain, this.uniforms);
    this.chunks.trees.bakeDistant(this.renderer);
    this.player = new PlayerController(
      this.camera,
      this.canvas,
      this.chunks,
      this.callbacks.lock,
    );
    this.grass = new GrassSystem(this.scene, this.uniforms);
    this.chunks.update(this.player.position, 3);
    this.grass.update(this.player.position);
    report("Water", 2);
    await yieldFrame();
    this.water = new Water(this.scene, this.uniforms);
    this.details = new Details(this.scene, this.uniforms);
    report("Wildlife", 3);
    await yieldFrame();
    this.animals = new AnimalManager(this.scene, this.chunks);
    report("Environment", 4);
    while (this.chunks.queue.length) {
      this.chunks.update(this.player.position, 3);
      await yieldFrame();
    }
    this.camera.position.set(147, 23, 163);
    this.camera.lookAt(-18, 24, -170);
    this.sky.update(0, this.camera.position);
    this.animals.update(0.01, this.player.position);
    report("Audio · ready on entry", 5);
    await yieldFrame();
    this.monitor = new PerformanceMonitor(this.renderer, () =>
      this.reduceQuality(),
    );
    this.renderer.compile(this.scene, this.camera);
    if (this.failed) return;
    this.setQuality(1, false);
    this.clock.start();
    this.frame();
    report("World ready", 6);
    this.callbacks.ready();
  }
  setQuality(q, rebuild = true) {
    this.quality = q;
    this.qualityName = QUALITY[q];
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, [0.8, 1, 1.25, 1.5][q]),
    );
    this.sky.setQuality(q);
    this.water.setQuality(q);
    this.animals.setQuality(q);
    if (rebuild) {
      this.grass.setQuality(q);
      this.chunks.setQuality(q);
    }
    this.callbacks.quality?.(q);
  }
  reduceQuality() {
    if (this.quality > 0) {
      this.setQuality(this.quality - 1);
      this.callbacks.toast(
        `Graphics adjusted to ${this.qualityName.toLowerCase()} for a smoother walk.`,
      );
    } else {
      const ratio = this.renderer.getPixelRatio();
      if (ratio > 0.65) {
        this.renderer.setPixelRatio(Math.max(0.65, ratio - 0.1));
        this.callbacks.toast(
          "Resolution gently reduced to keep the valley moving smoothly.",
        );
      }
    }
  }
  frame = () => {
    if (this.failed) return;
    requestAnimationFrame(this.frame);
    const rawDt = this.clock.getDelta(),
      dt = Math.min(rawDt, 0.05);
    if (document.hidden) return;
    this.uniforms.uTime.value += dt;
    const t = this.uniforms.uTime.value;
    this.uniforms.uWind.value =
      0.7 + Math.sin(t * 0.13) * 0.18 + Math.sin(t * 0.037) * 0.25;
    this.player.update(dt);
    if (!this.started) {
      this.camera.position.x = 147 + Math.sin(t * 0.012) * 2;
      this.camera.lookAt(-18, 24, -170);
    }
    this.uniforms.uPlayer.value.copy(this.player.position);
    this.chunks.update(this.player.position);
    this.grass.update(this.player.position);
    this.sky.update(dt, this.camera.position);
    this.animals.update(dt, this.player.position);
    this.audio.update(
      dt,
      this.player,
      this.uniforms.uWind.value,
      this.uniforms.uDay.value,
    );
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = this.water.frame % 3 === 0;
    this.renderer.info.reset();
    this.water.update(this.renderer, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.monitor.update(rawDt, this);
    this.callbacks.tick?.(this);
  };
  async enter() {
    this.started = true;
    this.player.placeCamera();
    const audio = this.audio
      .start()
      .catch((e) => this.callbacks.toast(e.message));
    try {
      await this.player.lock();
    } catch (e) {
      this.callbacks.toast(
        "Click Enter World again to allow mouse look. " + e.message,
      );
    }
    await audio;
  }
  exit() {
    this.started = false;
    document.exitPointerLock();
    this.audio.suspend();
    this.camera.position.set(147, 23, 163);
    this.callbacks.exit();
  }
  observation() {
    const p = this.player.position;
    const animal = this.animals.nearest(p);
    if (animal)
      return {
        label: `Observe ${animal.type.toLowerCase()}`,
        text: {
          Deer: "Roe deer · Quiet edges of woodland are their favourite grazing places. Give them space, and watch them settle.",
          Rabbit:
            "European rabbit · A pause, a twitch of the ears, then a quick hop into the meadow.",
          Squirrel:
            "Red squirrel · An alert little woodland neighbour, searching the forest floor.",
        }[animal.type],
      };
    if (p.distanceTo(this.details.signPosition) < 6)
      return {
        label: "Read trail sign",
        text: "Silvermere Valley · Follow the shoreline north. The wooden bridge is upstream to the south. Leave only footprints.",
      };
    const tree = this.chunks.nearest(p);
    if (tree)
      return {
        label: `Inspect ${SPECIES[tree.type].toLowerCase()}`,
        text: `${SPECIES[tree.type]} · Notice the branching silhouette, the texture of the bark, and the leaves moving independently in the breeze.`,
      };
    if (surfaceAt(p.x, p.z) === "water")
      return {
        label: "Observe the shallows",
        text: "In the shallows · Light bends through ripples over the lake bed. The deeper water lies beyond the walkable shore.",
      };
    for (const c of this.chunks.chunks.values()) {
      if (c.flowers.some((f) => Math.hypot(f.x - p.x, f.z - p.z) < 2)) {
        return {
          label: "Look at wildflowers",
          text: "Meadow wildflowers · Small flowers offer a quiet stopping place for butterflies. Leave them growing for the next wanderer.",
        };
      }
    }
    return null;
  }
  snapshot() {
    return {
      ready: !!this.monitor,
      quality: this.qualityName,
      position: this.player.position.toArray(),
      locked: this.player.locked,
      biome: biomeAt(this.player.position.x, this.player.position.z),
      chunks: this.chunks.chunks.size,
      queued: this.chunks.queue.length,
      fps: this.monitor?.fps,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
    };
  }
}
