import * as THREE from "three";
import {
  SPAWN,
  heightAt,
  walkHeight,
  slopeAt,
  WORLD_HALF,
  WATER_LEVEL,
  onBridge,
} from "../world/WorldGenerator.js";
import { clamp } from "../utils/Noise.js";
export class PlayerController {
  constructor(camera, canvas, chunks, onLock) {
    this.camera = camera;
    this.canvas = canvas;
    this.chunks = chunks;
    this.onLock = onLock;
    this.position = new THREE.Vector3(
      SPAWN.x,
      walkHeight(SPAWN.x, SPAWN.z),
      SPAWN.z,
    );
    this.velocity = new THREE.Vector3();
    this.yaw = 0.35;
    this.pitch = -0.03;
    this.sensitivity = 1;
    this.keys = new Set();
    this.locked = false;
    this.grounded = true;
    this.eye = 1.7;
    this.bob = 0;
    this.walked = 0;
    this.camera.rotation.order = "YXZ";
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.keys.clear();
      this.onLock(this.locked);
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0018 * this.sensitivity;
      this.pitch = clamp(
        this.pitch - e.movementY * 0.0018 * this.sensitivity,
        -1.5,
        1.5,
      );
    });
    document.addEventListener("keydown", (e) => {
      if (!this.locked) return;
      if (
        [
          "Space",
          "KeyW",
          "KeyS",
          "KeyA",
          "KeyD",
          "ControlLeft",
          "ControlRight",
        ].includes(e.code)
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "Space" && !e.repeat && this.grounded) {
        this.velocity.y = 5.5;
        this.grounded = false;
      }
    });
    document.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.velocity.set(0, 0, 0);
      if (this.locked) document.exitPointerLock();
    });
  }
  async lock() {
    if (!this.canvas.requestPointerLock)
      throw new Error(
        "Pointer lock is unavailable. Open Serenity in a desktop browser.",
      );
    await this.canvas.requestPointerLock();
  }
  update(dt) {
    if (!this.locked) return;
    const crouch =
        this.keys.has("ControlLeft") || this.keys.has("ControlRight"),
      run = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
      inWater = heightAt(this.position.x, this.position.z) < WATER_LEVEL;
    let speed = crouch ? 1.35 : run ? 6 : 3.1;
    if (inWater) speed *= 0.55;
    const x = Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")),
      z = Number(this.keys.has("KeyS")) - Number(this.keys.has("KeyW"));
    const l = Math.hypot(x, z) || 1;
    const vx = ((x * Math.cos(this.yaw) + z * Math.sin(this.yaw)) / l) * speed,
      vz = ((-x * Math.sin(this.yaw) + z * Math.cos(this.yaw)) / l) * speed;
    const blend = 1 - Math.exp(-dt * 11);
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, vx, blend);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, vz, blend);
    const steps = Math.max(1, Math.ceil(dt / 0.016));
    for (let i = 0; i < steps; i++) {
      const t = dt / steps,
        nx = this.position.x + this.velocity.x * t,
        nz = this.position.z + this.velocity.z * t;
      const allowed = (px, pz) =>
        Math.abs(px) < WORLD_HALF - 40 &&
        Math.abs(pz) < WORLD_HALF - 40 &&
        walkHeight(px, pz) > 0.6 &&
        walkHeight(px, pz) - this.position.y < 0.55 &&
        (!this.grounded || onBridge(px, pz) || slopeAt(px, pz) < 1.4) &&
        !this.chunks.collides(px, pz);
      if (allowed(nx, this.position.z)) this.position.x = nx;
      if (allowed(this.position.x, nz)) this.position.z = nz;
      const ground = walkHeight(this.position.x, this.position.z);
      if (this.grounded && ground >= this.position.y - 0.5) {
        this.position.y = ground;
        this.velocity.y = 0;
      } else {
        this.grounded = false;
        this.velocity.y -= 14 * t;
        this.position.y += this.velocity.y * t;
        if (this.position.y <= ground) {
          this.position.y = ground;
          this.velocity.y = 0;
          this.grounded = true;
        }
      }
    }
    const moving = Math.hypot(this.velocity.x, this.velocity.z);
    this.walked += moving * dt;
    this.bob += moving * dt * 1.65;
    this.eye = THREE.MathUtils.lerp(
      this.eye,
      crouch ? 1.05 : 1.7,
      1 - Math.exp(-dt * 12),
    );
    const targetY =
      this.position.y +
      this.eye +
      (this.grounded ? Math.sin(this.bob) * 0.018 * Math.min(moving, 1) : 0);
    this.camera.position.x = this.position.x;
    this.camera.position.z = this.position.z;
    this.camera.position.y = THREE.MathUtils.lerp(
      this.camera.position.y,
      targetY,
      1 - Math.exp(-dt * 18),
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
  placeCamera() {
    this.camera.position.copy(this.position).y += this.eye;
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
}
