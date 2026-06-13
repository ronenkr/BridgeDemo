# USS Voyager Bridge — Three.js + Rapier port

Browser port of the 2014 UE4 BridgeDemo: walk the bridge of the USS Voyager in
first person, with physics collision, interactive console panels and a
toggleable main viewscreen.

```
npm install
npm run dev      # http://localhost:5173
```

Click to capture the mouse, then:

| Input | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Look |
| E / click | Toggle the console panel under the crosshair |
| V | Toggle the main viewscreen (starfield / off) |
| Esc | Release the mouse |

## How the assets were produced

The original project stores everything as UE4 binary `.uasset`/`.umap` packages
(no FBX/glTF sources). The geometry lives as StaticMesh packages in
`Content/mesh` (hull, split per material), `Content/screens` (console panels)
and `Content/lights` (fixtures); `Content/bridge.umap` places all of them at the
world origin. The pipeline:

1. `tools/extract-umodel.ps1` — [umodel](https://www.gildor.org/en/projects/umodel)
   exports meshes to glTF (already meters/Y-up) and textures to PNG;
   [UAssetGUI](https://github.com/atenfyr/UAssetGUI) dumps the `.umap` actor
   tables to JSON (`extract/json`).
2. `tools/parse-umap.mjs` — turns the JSON dumps into
   `public/assets/level/placements.json`: mesh→material assignments, the
   PlayerStart spawn and the 83 point-light positions from `light.umap`.
3. `tools/stage-assets.mjs` — copies models/textures/audio into
   `public/assets/` and builds `materials.json` from umodel's `.mat`
   descriptors (diffuse / emissive `_i` / normal texture per material).

Untextured UE materials (flat colors) are recreated from a palette in
`src/world/level.ts`. The viewscreen starfield and the engine-hum ambience are
procedural (the original star texture and copyrighted audio are not in the repo).

## Code map

- `src/core/engine.ts` — renderer, camera, fixed-timestep loop (60 Hz physics)
- `src/world/level.ts` — manifest + glTF loading, material reconstruction
- `src/world/collision.ts` — Rapier trimesh colliders from the visual meshes
- `src/world/lights.ts` — clusters the 83 original point lights to ~30
- `src/player/controller.ts` — Rapier kinematic character controller (capsule,
  autostep, snap-to-ground) + pointer-lock look
- `src/interact/` — crosshair raycast interactions, panels, viewscreen shader
- `src/audio/ambience.ts` — synthesized bridge hum (WebAudio)

## Debug / headless verification

Query params (used by the headless checks during development):

- `?debug` — skip the click-to-start overlay, no pointer lock needed
- `&pos=x,y,z&yaw=deg&pitch=deg` — override spawn pose
- `&walktest[=walk]` — settle physics (and optionally walk forward 3 s)
  synchronously, then write the result to a `#debug-state` DOM node
- `&aim=x,y,z&press=KeyE` — aim at a point and simulate a key press

Example:

```
chrome --headless=new --dump-dom "http://localhost:5173/?debug&walktest=walk&pos=0,1,-1&yaw=180"
```
