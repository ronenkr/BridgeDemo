// Stages umodel extraction output (extract/umodel) into web/public/assets:
//   models/   *.gltf + *.bin   (flattened, names are unique)
//   textures/ *.png            (flattened)
//   audio/    *.wav
//   level/materials.json       (material name -> { diffuse, emissive, normal })
//
// Run after tools/extract-umodel.ps1 and tools/parse-umap.mjs.

import { readdirSync, readFileSync, copyFileSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, extname, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcRoot = join(root, "extract", "umodel");
const assets = join(root, "web", "public", "assets");

const dirs = {
  ".gltf": join(assets, "models"),
  ".bin": join(assets, "models"),
  ".png": join(assets, "textures"),
  ".wav": join(assets, "audio"),
};
for (const d of new Set(Object.values(dirs))) mkdirSync(d, { recursive: true });
mkdirSync(join(assets, "level"), { recursive: true });

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

const counts = {};
const materials = {};
const seen = new Map();

for (const file of walk(srcRoot)) {
  const ext = extname(file).toLowerCase();
  const dest = dirs[ext];
  if (dest) {
    const name = basename(file);
    if (seen.has(name) && seen.get(name) !== file) {
      console.warn(`name collision, skipping: ${file} (kept ${seen.get(name)})`);
      continue;
    }
    seen.set(name, file);
    copyFileSync(file, join(dest, name));
    counts[ext] = (counts[ext] || 0) + 1;
  } else if (ext === ".mat") {
    // umodel material descriptor: "Diffuse=scn10_1", "Normal=...", "Other[0]=scn10_1_i"
    const entry = {};
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^(\w+)(?:\[\d+\])?=(.+)$/);
      if (!m) continue;
      const [, key, value] = m;
      if (key === "Diffuse") entry.diffuse = value;
      else if (key === "Normal") entry.normal = value;
      else if (key === "Other" && /_i$/.test(value)) entry.emissive = value;
    }
    if (Object.keys(entry).length) materials[basename(file, ".mat")] = entry;
  }
}

writeFileSync(join(assets, "level", "materials.json"), JSON.stringify(materials, null, 2));
console.log("staged:", JSON.stringify(counts));
console.log(`materials.json: ${Object.keys(materials).length} textured materials`);
