import * as THREE from "three";
export class PerformanceMonitor {
  constructor(renderer, onSlow) {
    this.renderer = renderer;
    this.onSlow = onSlow;
    this.frames = 0;
    this.elapsed = 0;
    this.fps = 60;
    this.slow = 0;
    this.cooldown = 15;
    this.element = document.querySelector("#perf");
    const gl = renderer.getContext(),
      ext = gl.getExtension("WEBGL_debug_renderer_info");
    this.gpu = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    this.adaptive = true;
    this.frustum = new THREE.Frustum();
    this.matrix = new THREE.Matrix4();
  }
  update(dt, world) {
    this.frames++;
    this.elapsed += dt;
    this.cooldown -= dt;
    if (this.elapsed < 1) return;
    this.fps = Math.round(this.frames / this.elapsed);
    this.frames = 0;
    this.elapsed = 0;
    const info = this.renderer.info;
    let visible = 0;
    this.frustum.setFromProjectionMatrix(
      this.matrix.multiplyMatrices(
        world.camera.projectionMatrix,
        world.camera.matrixWorldInverse,
      ),
    );
    world.scene.traverseVisible((o) => {
      if (
        (o.isMesh || o.isPoints) &&
        (!o.frustumCulled || this.frustum.intersectsObject(o))
      )
        visible++;
    });
    const p = world.player.position;
    this.element.textContent = `${this.fps} FPS  ·  ${world.qualityName}\nDraw calls   ${info.render.calls}\nTriangles    ${info.render.triangles.toLocaleString()}\nVisible meshes ${visible}\nChunks       ${world.chunks.chunks.size} / 49\nWorld chunk  ${Math.floor(p.x / 128)}, ${Math.floor(p.z / 128)}\nGeometries   ${info.memory.geometries}\nTextures     ${info.memory.textures}\nPixel ratio  ${this.renderer.getPixelRatio().toFixed(2)}\nGPU ${this.gpu.slice(0, 60)}`;
    if (this.fps < 29 && this.adaptive && this.cooldown < 0) this.slow++;
    else this.slow = 0;
    if (this.slow >= 6) {
      this.onSlow();
      this.slow = 0;
      this.cooldown = 20;
    }
  }
}
