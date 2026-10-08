# Serenity — Realistic 3D Nature Exploration

A runnable, procedural Three.js nature exploration prototype. The opening landscape is the live WebGL world, not a background image. All terrain, vegetation, wildlife, textures, and environmental audio are generated locally. No model or texture downloads are required.

## Run

Requires Node.js 20.19+ or 22.12+ and a desktop browser with WebGL 2 and hardware acceleration.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Click **Enter World** to enable mouse look and audio. If your browser asks, allow pointer lock. Audio can also be enabled independently from the speaker button.

```sh
npm run build
npm run preview
```

The production output is in `dist/`. Serve it through HTTP; opening `index.html` as a `file://` URL does not support ES modules. Google Fonts is optional; system typography is used when offline.

## Explore

| Action                              | Control |
| ----------------------------------- | ------- |
| Walk                                | W A S D |
| Look                                | Mouse   |
| Run                                 | Shift   |
| Jump                                | Space   |
| Crouch                              | Ctrl    |
| Observe nearby nature / read a sign | E       |
| Pause and release mouse             | Esc     |

Follow the lakeshore north, explore the forest, or walk south along the river to the wooden bridge. Shallow water is walkable; deep water is a natural boundary. Steep cliffs, trees, and rocks block movement. The finite world is 4,096 × 4,096 metres (about 16.8 km²).

Settings include four graphics presets, FOV (75° default), sensitivity, audio volume, time of day, automatic time progression, adaptive rendering, and a developer performance panel. Preferences are saved only in this browser. A full day takes about 67 minutes. Esc opens the pause controls; the ecosystem continues moving while you are paused.

## Systems

- **Terrain:** deterministic multi-octave value-noise FBM, irregular ridges, valleys, lake/pond basins and a winding river. GPU materials blend grass, soil, rock, mud and high-altitude snow using slope, elevation and multi-scale surface variation.
- **Streaming:** 128 m chunks, 49 terrain chunks around the player, a coarse 4 km distant terrain, shared geometries, instance batches, disposal of unloaded GPU buffers and camera-facing tree impostors baked from the detailed procedural trees.
- **Vegetation:** seven tree types, branching trunks, procedurally textured foliage, grass clumps containing individual blade geometry, flowers with stems/petals, shrubs, rocks and fallen logs. GLSL wind includes spatial noise, gusts, phase variation and local player interaction.
- **Water:** depth-colored, shoreline-clipped custom GLSL surfaces with Fresnel reflection, animated normals, specular light, shallow-water ripples, river flow and a small animated waterfall. Planar reflections update at a lower rate than the main view.
- **Wildlife:** articulated procedural deer, rabbits and squirrels; grazing/wandering/fleeing states; animated instanced birds with perching cycles, butterflies and fish; distance-based detail and visibility. Models are stylized procedural substitutes, not scanned animals.
- **Atmosphere:** moving procedural clouds, sun, blue night sky, stars, animated dust/pollen/fireflies, distance haze, hemisphere fill, directional light and nearby shadows.
- **Audio:** gesture-activated Web Audio, filtered wind/water/insect beds, positional water and bird calls, and footsteps that change on grass, dirt, rock and water. Sound is synthesized rather than recorded field audio.
- **Resilience:** explicit WebGL/context/shader error screens, optional audio fallback, bounded quality presets and automatic downshifting after sustained low FPS.

The prototype uses approximate reflected water depth, synthetic audio and procedural geometry. It does not include photogrammetry, physically simulated water, skeletal asset animation, full volumetric scattering, SSAO, or cascaded shadows. No 60 FPS guarantee is made: frame rate depends on GPU, viewport, browser and other active graphics workloads. Medium is the default; Low disables planar reflections and shadows. High and Ultra increase grass density, reflection resolution and rendering scale, with capped pixel ratios.

## Architecture

`src/scene/World.js` coordinates the simulation and renderer. Terrain, sky, water, details, procedural generation, chunks, vegetation, animals, controller, audio, UI, and monitoring live in separate modules. Custom grass, water and shared noise shaders are in `src/shaders/`.

## Checks

```sh
npm test
npm run build
```

With the dev server running, installed Microsoft Edge can run the browser checks:

```sh
node tests/browser-check.mjs
node tests/interaction-check.mjs
```

These check shader/runtime errors, pointer lock, keyboard movement, jumping/landing, crouch, settings, night lighting, tree collision, resource disposal across streamed regions, and the exit flow. Captured screenshots go to the ignored `test-results/` directory. Browser checks currently select the locally installed Edge channel; change `channel: 'msedge'` to your installed Chromium channel if needed.
