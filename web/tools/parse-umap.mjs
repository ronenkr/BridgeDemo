// Parses UAssetGUI JSON dumps of bridge.umap / light.umap into a level manifest
// consumed by the web app (web/public/assets/level/placements.json).
//
// Pipeline (see tools/extract-umodel.ps1 for the preceding steps):
//   UAssetGUI tojson Content/bridge.umap extract/json/bridge.json VER_UE4_21
//   UAssetGUI tojson Content/light.umap  extract/json/light.json  VER_UE4_21
//   node tools/parse-umap.mjs
//
// Coordinate conversion: umodel's glTF exporter maps UE (cm, Z-up, LH) vertex
// positions to glTF (m, Y-up, RH) as (x, z, y) / 100. Point positions from the
// umap JSONs must use the same mapping so lights/spawn line up with the meshes.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const jsonDir = join(root, "extract", "json");
const outDir = join(root, "web", "public", "assets", "level");
mkdirSync(outDir, { recursive: true });

const ueToThree = ({ X, Y, Z }) => [X / 100, Z / 100, Y / 100];

function loadPkg(name) {
  return JSON.parse(readFileSync(join(jsonDir, name), "utf8"));
}

function makeResolvers(pkg) {
  const className = (i) =>
    i < 0 ? pkg.Imports[-i - 1].ObjectName : i > 0 ? pkg.Exports[i - 1].ObjectName : null;
  const importName = (i) => (i < 0 ? pkg.Imports[-i - 1].ObjectName : null);
  const prop = (exp, name) => exp.Data?.find((p) => p.Name === name);
  // Struct properties (RelativeLocation etc.) arrive as single-element arrays
  const structValue = (exp, name) => {
    const p = prop(exp, name);
    if (!p) return null;
    const v = Array.isArray(p.Value) ? p.Value[0] : p.Value;
    return v?.Value ?? v;
  };
  return { className, importName, prop, structValue };
}

// ---- bridge.umap: static mesh actors + player start ----
const bridge = loadPkg("bridge.json");
const B = makeResolvers(bridge);

const meshes = [];
for (const exp of bridge.Exports) {
  if (B.className(exp.ClassIndex) !== "StaticMeshActor") continue;
  const compRef = B.prop(exp, "StaticMeshComponent")?.Value;
  if (!compRef || compRef <= 0) continue;
  const comp = bridge.Exports[compRef - 1];
  const meshName = B.importName(B.prop(comp, "StaticMesh")?.Value);
  if (!meshName) continue;

  const override = B.prop(comp, "OverrideMaterials")?.Value?.[0]?.Value;
  const material = override !== undefined ? B.importName(override) : null;

  const loc = B.structValue(comp, "RelativeLocation");
  const entry = { mesh: meshName, material };
  if (loc && (loc.X || loc.Y || loc.Z)) entry.position = ueToThree(loc);
  meshes.push(entry);
}

let spawn = { position: [0, 1, 0], yawDeg: 0 };
for (const exp of bridge.Exports) {
  if (B.className(exp.ClassIndex) !== "PlayerStart") continue;
  const compRef = B.prop(exp, "RootComponent")?.Value;
  if (!compRef || compRef <= 0) continue;
  const comp = bridge.Exports[compRef - 1];
  const loc = B.structValue(comp, "RelativeLocation");
  const rot = B.structValue(comp, "RelativeRotation");
  if (loc) spawn.position = ueToThree(loc);
  if (rot) spawn.yawDeg = rot.Yaw ?? 0;
}

// ---- light.umap: point light positions by blueprint class ----
const light = loadPkg("light.json");
const L = makeResolvers(light);

const lightClasses = { bluelight_C: "blue", darkbluelight_C: "darkblue", whitelight_C: "white" };
const lights = [];
for (const exp of light.Exports) {
  const cls = L.className(exp.ClassIndex);
  const type = lightClasses[cls];
  if (!type) continue;
  const compRef = L.prop(exp, "RootComponent")?.Value;
  if (!compRef || compRef <= 0) continue;
  const comp = light.Exports[compRef - 1];
  const loc = L.structValue(comp, "RelativeLocation");
  if (!loc) continue;
  lights.push({ type, position: ueToThree(loc) });
}

const manifest = {
  mode: "origin",
  meshes,
  spawn,
  lights,
};

const outFile = join(outDir, "placements.json");
writeFileSync(outFile, JSON.stringify(manifest, null, 2));
console.log(
  `placements.json: ${meshes.length} mesh actors, ${lights.length} lights, spawn at [${spawn.position.map((n) => n.toFixed(2))}] yaw ${spawn.yawDeg}`
);
const withPos = meshes.filter((m) => m.position).length;
console.log(`mesh actors with non-identity position: ${withPos} (origin mode expected: 0)`);
