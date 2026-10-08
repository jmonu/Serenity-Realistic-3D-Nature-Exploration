import "./style.css";
import { World } from "./scene/World.js";
import { UI } from "./ui/UI.js";
const ui = new UI();
async function boot() {
  try {
    const canvas = document.querySelector("#world");
    const test = document.createElement("canvas");
    if (!test.getContext("webgl2"))
      throw new Error(
        "Serenity needs WebGL 2. Please enable hardware acceleration and use a current desktop version of Chrome, Edge, Firefox, or Safari.",
      );
    const world = new World(canvas, {
      progress: ui.progress,
      ready: ui.ready,
      error: ui.error,
      lock: ui.lock,
      exit: ui.exit,
      quality: ui.quality,
      toast: ui.toast,
      tick: ui.tick,
    });
    ui.world = world;
    await world.init();
    if (world.failed) return;
    ui.bind(world);
    if (import.meta.env.DEV) window.__serenity = world;
  } catch (error) {
    console.error(error);
    ui.error(
      error.message || "The world could not load. Please reload the page.",
    );
  }
}
window.addEventListener("unhandledrejection", (event) => {
  console.error(event.reason);
  ui.toast(
    "Something interrupted the experience. Please reload if the world has stopped responding.",
  );
});
boot();
