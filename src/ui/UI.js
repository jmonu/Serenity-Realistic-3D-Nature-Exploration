import { biomeAt } from "../world/WorldGenerator.js";
const $ = (s) => document.querySelector(s);
export class UI {
  constructor() {
    this.dialog = $("#settings");
    this.intro = true;
    this.lastUpdate = 0;
    this.toastTimeout = null;
    this.bound = false;
    this.suppressClose = false;
    this.progress("Terrain", 0);
  }
  toast = (message) => {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("visible");
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => el.classList.remove("visible"), 5500);
  };
  error = (message) => {
    $("#error").hidden = false;
    $("#error-message").textContent = message;
    $("#intro").hidden = true;
    $("#settings").close();
  };
  progress = (label, step) => {
    $("#loading-status").textContent =
      step === 6
        ? "World ready. Take your time."
        : `${label} · ${Math.round((step / 6) * 100)}%`;
    $("#enter-label").textContent =
      step === 6 ? "ENTER WORLD" : "GENERATING WORLD";
  };
  ready = () => {
    $("#enter").disabled = false;
  };
  lock = (locked) => {
    if (locked) {
      this.intro = false;
      document.body.classList.add("exploring");
      $("#hud").hidden = false;
      $("#exit").hidden = false;
      if (this.dialog.open) {
        this.suppressClose = true;
        this.dialog.close();
      }
    } else if (this.world?.started) {
      if (!this.dialog.open) this.dialog.showModal();
    }
    this.world?.audio.setVolume(this.world.audio.volume);
  };
  exit = () => {
    this.intro = true;
    document.body.classList.remove("exploring");
    $("#hud").hidden = true;
    $("#exit").hidden = true;
    this.suppressClose = true;
    this.dialog.close();
  };
  quality = (q) => {
    if (this.bound) $("#quality").selectedIndex = q;
  };
  bind(world) {
    this.world = world;
    this.bound = true;
    $("#enter").onclick = () => world.enter();
    const open = () => {
      if (world.player.locked) document.exitPointerLock();
      else this.dialog.showModal();
    };
    $("#settings-open").onclick = open;
    $("#intro-settings").onclick = open;
    $("#sound-toggle").onclick = async () => {
      if (!world.audio.ready) {
        try {
          await world.audio.start();
        } catch (e) {
          this.toast(e.message);
          return;
        }
      } else world.audio.toggle();
      $("#sound-toggle").style.opacity = world.audio.enabled ? 1 : 0.45;
      $("#sound-toggle").setAttribute(
        "aria-pressed",
        String(world.audio.enabled),
      );
      this.toast(
        world.audio.enabled ? "Nature sounds on" : "Nature sounds off",
      );
    };
    $("#resume").onclick = () => {
      this.suppressClose = true;
      this.dialog.close();
      if (world.started) world.enter();
    };
    $("#exit").onclick = () => world.exit();
    this.dialog.addEventListener("cancel", (e) => {
      if (world.started) e.preventDefault();
    });
    this.dialog.addEventListener("close", () => {
      if (this.suppressClose) {
        this.suppressClose = false;
        return;
      }
      if (world.started) world.enter();
    });
    document.querySelectorAll("[data-tab]").forEach((button) => {
      button.onclick = () => {
        document.querySelectorAll("[data-tab]").forEach((b) => {
          b.classList.toggle("active", b === button);
          b.setAttribute("aria-selected", String(b === button));
        });
        $("#experience-tab").hidden = button.dataset.tab !== "experience";
        $("#controls-tab").hidden = button.dataset.tab !== "controls";
      };
    });
    const controls = {
      quality: ["change", () => world.setQuality($("#quality").selectedIndex)],
      fov: [
        "input",
        () => {
          world.camera.fov = +$("#fov").value;
          world.camera.updateProjectionMatrix();
          $("#fov-out").textContent = $("#fov").value + "°";
        },
      ],
      sensitivity: [
        "input",
        () => (world.player.sensitivity = +$("#sensitivity").value),
      ],
      volume: [
        "input",
        () => {
          world.audio.setVolume(+$("#volume").value);
          $("#volume-out").textContent =
            Math.round(+$("#volume").value * 100) + "%";
        },
      ],
      time: [
        "input",
        () => {
          world.sky.time = +$("#time").value;
          this.updateTime();
        },
      ],
      cycle: ["change", () => (world.sky.cycle = $("#cycle").checked)],
      adaptive: [
        "change",
        () => (world.monitor.adaptive = $("#adaptive").checked),
      ],
      "show-perf": [
        "change",
        () => ($("#perf").hidden = !$("#show-perf").checked),
      ],
    };
    this.controls = controls;
    for (const [id, [event, fn]] of Object.entries(controls)) {
      $("#" + id).addEventListener(event, () => {
        fn();
        this.save();
      });
    }
    this.load();
    document.addEventListener("keydown", (e) => {
      if (e.code === "KeyE" && world.player.locked) {
        const o = world.observation();
        if (o) this.toast(o.text);
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        world.audio.suspend();
        if (world.player.locked) document.exitPointerLock();
      } else if (!this.intro) world.audio.start().catch(() => {});
    });
  }
  save() {
    try {
      const data = {};
      for (const id of Object.keys(this.controls)) {
        const el = $("#" + id);
        data[id] = el.type === "checkbox" ? el.checked : el.value;
      }
      localStorage.setItem("serenity-settings-v1", JSON.stringify(data));
    } catch {}
  }
  load() {
    try {
      const data = JSON.parse(
        localStorage.getItem("serenity-settings-v1") || "{}",
      );
      for (const [id, value] of Object.entries(data)) {
        if (!this.controls[id]) continue;
        const el = $("#" + id);
        if (el.type === "checkbox") {
          if (typeof value !== "boolean") continue;
          el.checked = value;
        } else if (el.tagName === "SELECT") {
          if (![...el.options].some((o) => o.value === value)) continue;
          el.value = value;
        } else {
          const number = Number(value);
          if (!Number.isFinite(number) || number < +el.min || number > +el.max)
            continue;
          el.value = value;
        }
        this.controls[id][1]();
      }
    } catch {}
  }
  updateTime() {
    const hour = this.world.sky.time,
      h = Math.floor(hour),
      m = Math.floor((hour - h) * 60),
      str = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    $("#day-time").textContent =
      `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
    $("#time-out").textContent = str;
    $("#weather-label").textContent =
      h < 5 || h >= 20
        ? "Under a quiet sky"
        : h < 11
          ? "A gentle morning"
          : h < 16
            ? "A wandering afternoon"
            : "The last golden light";
    if (document.activeElement !== $("#time")) $("#time").value = hour;
  }
  tick = (world) => {
    const t = world.uniforms.uTime.value;
    if (t - this.lastUpdate < 0.2) return;
    this.lastUpdate = t;
    this.updateTime();
    if (world.player.locked) {
      const p = world.player.position;
      $("#biome").textContent = biomeAt(p.x, p.z);
      const angle = ((((world.player.yaw * -180) / Math.PI) % 360) + 360) % 360;
      $("#heading").textContent = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][
        Math.round(angle / 45) % 8
      ];
      const o = world.observation(),
        el = $("#interaction");
      el.hidden = !o;
      if (o) el.textContent = "E · " + o.label;
    }
  };
}
