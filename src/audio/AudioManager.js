import {
  surfaceAt,
  forestDensity,
  riverX,
  lakeDistance,
} from "../world/WorldGenerator.js";
export class AudioManager {
  constructor() {
    this.volume = 0.55;
    this.enabled = true;
    this.ready = false;
    this.step = 0;
    this.birdTimer = 0;
    this.nodes = [];
  }
  async start() {
    if (this.ready) {
      await this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC)
      throw new Error("Environmental audio is unavailable in this browser.");
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(c.destination);
    this.buffer = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
    const data = this.buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    this.wind = this.noiseLoop(450, 0.12);
    this.water = this.noiseLoop(1800, 0, true);
    this.insects = this.noiseLoop(6200, 0.015);
    this.ready = true;
    await c.resume();
  }
  noiseLoop(freq, gain, positional = false) {
    const c = this.ctx,
      source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      g = c.createGain();
    source.buffer = this.buffer;
    source.loop = true;
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = 0.6;
    g.gain.value = gain;
    source.connect(filter).connect(g);
    let panner;
    if (positional) {
      panner = c.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 12;
      panner.maxDistance = 300;
      g.connect(panner).connect(this.master);
    } else g.connect(this.master);
    source.start();
    this.nodes.push(source);
    return { source, filter, gain: g, panner };
  }
  setVolume(v) {
    this.volume = v;
    if (this.ready)
      this.master.gain.setTargetAtTime(
        this.enabled ? v : 0,
        this.ctx.currentTime,
        0.15,
      );
  }
  toggle() {
    this.enabled = !this.enabled;
    this.setVolume(this.volume);
    return this.enabled;
  }
  chirp(p) {
    const c = this.ctx,
      t = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = c.createOscillator(),
        gain = c.createGain(),
        pan = c.createPanner();
      pan.panningModel = "HRTF";
      pan.refDistance = 10;
      pan.positionX.value = p.x + (Math.random() - 0.5) * 50;
      pan.positionY.value = p.y + 8;
      pan.positionZ.value = p.z + (Math.random() - 0.5) * 50;
      const start = t + i * 0.15,
        f = 2300 + Math.random() * 1400;
      osc.frequency.setValueAtTime(f, start);
      osc.frequency.exponentialRampToValueAtTime(f * 1.4, start + 0.06);
      osc.frequency.exponentialRampToValueAtTime(f * 0.85, start + 0.13);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);
      osc.connect(gain).connect(pan).connect(this.master);
      osc.start(start);
      osc.stop(start + 0.16);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
        pan.disconnect();
      };
    }
  }
  footstep(surface) {
    const c = this.ctx,
      t = c.currentTime,
      src = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      g = c.createGain();
    src.buffer = this.buffer;
    filter.type = surface === "rock" ? "highpass" : "lowpass";
    filter.frequency.value =
      { grass: 750, dirt: 1300, rock: 800, water: 2800 }[surface] || 750;
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(surface === "water" ? 0.32 : 0.2, t + 0.014);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t, Math.random(), 0.18);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }
  update(dt, player, wind, day) {
    if (!this.ready || this.ctx.state !== "running") return;
    const c = this.ctx,
      t = c.currentTime,
      p = player.position,
      l = c.listener;
    if (l.positionX) {
      l.positionX.value = p.x;
      l.positionY.value = p.y + 1.7;
      l.positionZ.value = p.z;
      l.forwardX.value = -Math.sin(player.yaw);
      l.forwardY.value = 0;
      l.forwardZ.value = -Math.cos(player.yaw);
      l.upX.value = 0;
      l.upY.value = 1;
      l.upZ.value = 0;
    }
    this.wind.gain.gain.setTargetAtTime(
      0.1 + wind * 0.045 - forestDensity(p.x, p.z) * 0.04,
      t,
      0.8,
    );
    const lake = lakeDistance(p.x, p.z),
      near = Math.max(0, 1 - Math.abs(lake - 1) * 3);
    const river =
      p.z > 70 ? Math.max(0, 1 - Math.abs(p.x - riverX(p.z)) / 45) : 0;
    this.water.gain.gain.setTargetAtTime(
      Math.max(near * 0.3, river * 0.65),
      t,
      0.8,
    );
    this.water.panner.positionX.value = river > near ? riverX(p.z) : 30;
    this.water.panner.positionY.value = 2.4;
    this.water.panner.positionZ.value = river > near ? p.z : -105;
    this.insects.gain.gain.setTargetAtTime(0.012 + (1 - day) * 0.03, t, 1);
    if (player.locked && player.grounded && player.walked - this.step > 1.65) {
      this.step = player.walked;
      this.footstep(surfaceAt(p.x, p.z));
    }
    this.birdTimer -= dt;
    if (this.birdTimer < 0) {
      if (day > 0.2) this.chirp(p);
      this.birdTimer = 3 + Math.random() * 9;
    }
  }
  suspend() {
    if (this.ready) this.ctx.suspend();
  }
}
