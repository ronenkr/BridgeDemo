import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export interface MeshPlacement {
  mesh: string;
  material: string | null;
  position?: [number, number, number];
}

export interface LevelManifest {
  mode: string;
  meshes: MeshPlacement[];
  spawn: { position: [number, number, number]; yawDeg: number };
  lights: { type: "blue" | "darkblue" | "white"; position: [number, number, number] }[];
}

export interface Panel {
  mesh: THREE.Mesh;
  name: string;
  onMaterial: THREE.Material;
  offMaterial: THREE.Material;
  powered: boolean;
}

export interface Level {
  group: THREE.Group;
  staticMeshes: THREE.Mesh[];
  panels: Panel[];
  viewscreen: THREE.Mesh | null;
  manifest: LevelManifest;
}

type MaterialTextures = { diffuse?: string; emissive?: string; normal?: string };

// Untextured UE materials were flat colors; recreate them by name (case-insensitive).
// [color, roughness, metalness, emissive?, emissiveIntensity?]
const PALETTE: Record<string, [string, number, number, string?, number?]> = {
  black: ["#15161a", 0.7, 0.1],
  black1: ["#15161a", 0.7, 0.1],
  white: ["#dfe2e6", 0.8, 0.0],
  dimgray: ["#4c5057", 0.85, 0.05],
  charcoal: ["#33363c", 0.9, 0.05],
  charcoaltrim: ["#33363c", 0.9, 0.05],
  leather: ["#4a4244", 0.65, 0.0],
  leather2: ["#3c3537", 0.65, 0.0],
  lightgray: ["#979ca4", 0.85, 0.05],
  color00: ["#6e737b", 0.85, 0.05],
  color05: ["#5a5e66", 0.85, 0.05],
  colora0: ["#7e2a22", 0.6, 0.0],
  colora1: ["#84572e", 0.7, 0.0],
  colorh1: ["#596070", 0.8, 0.05],
  burnt: ["#26242a", 0.95, 0.0],
  fabricbrown: ["#665747", 0.95, 0.0],
  chairgray: ["#5e6166", 0.8, 0.0],
  readalert: ["#3a0c0c", 0.5, 0.0, "#ff2a1a", 0.9],
  m_lights: ["#f5f7ff", 0.4, 0.0, "#eef2ff", 1.6],
  m_lightblueglow: ["#cfe4ff", 0.4, 0.0, "#7fb6ff", 1.8],
  lightblueglow2: ["#cfe4ff", 0.4, 0.0, "#7fb6ff", 1.8],
  lightwhitetoblueglow: ["#e8efff", 0.4, 0.0, "#bcd6ff", 1.6],
  m_baselight: ["#e8efff", 0.4, 0.0, "#d4e2ff", 1.4],
  m_window: ["#05070d", 0.2, 0.6],
  m_lighttl: ["#e8efff", 0.4, 0.0, "#d4e2ff", 1.4],
  m_turbolifttlights: ["#e8efff", 0.4, 0.0, "#d4e2ff", 1.2],
  m_mvsscanner: ["#0a1424", 0.4, 0.1, "#3f76d6", 1.2],
  m_ping: ["#0a1424", 0.4, 0.1, "#3f76d6", 1.0],
  rt_mainviewscreen_mat: ["#04060c", 0.3, 0.2],
  computerlogrendertarget_mat: ["#04080d", 0.4, 0.1, "#1c3a2c", 0.6],
  plaque: ["#c8a44e", 0.35, 0.9],
  plaque2: ["#c8a44e", 0.35, 0.9],
  default: ["#7a7e86", 0.85, 0.05],
};

// Materials whose extracted textures are unusable (e.g. the plaque's gold
// detail/noise maps); force the palette entry instead.
const FORCE_PALETTE = new Set(["plaque", "plaque2"]);

const FALLBACK_OFF = new THREE.MeshStandardMaterial({
  color: "#101216",
  roughness: 0.5,
  metalness: 0.2,
});

export async function loadLevel(assetsBase = "/assets"): Promise<Level> {
  const [manifest, materialDefs] = await Promise.all([
    fetch(`${assetsBase}/level/placements.json`).then((r) => r.json()) as Promise<LevelManifest>,
    fetch(`${assetsBase}/level/materials.json`).then((r) => r.json()) as Promise<
      Record<string, MaterialTextures>
    >,
  ]);

  const matDefsLower = new Map<string, MaterialTextures>(
    Object.entries(materialDefs).map(([k, v]) => [k.toLowerCase(), v])
  );

  const texLoader = new THREE.TextureLoader();
  const texCache = new Map<string, THREE.Texture>();
  const loadTex = (name: string, srgb: boolean) => {
    const key = `${name}|${srgb}`;
    let t = texCache.get(key);
    if (!t) {
      t = texLoader.load(`${assetsBase}/textures/${name}.png`);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = false; // glTF UV convention
      t.anisotropy = 8;
      texCache.set(key, t);
    }
    return t;
  };

  const matCache = new Map<string, THREE.MeshStandardMaterial>();
  function makeMaterial(name: string | null, meshName: string): THREE.MeshStandardMaterial {
    // Material may be unset on the actor; fall back to the mesh's own name (LM__Burnt -> burnt).
    const key = (name || meshName.replace(/^LM__/, "")).toLowerCase();
    let mat = matCache.get(key);
    if (mat) return mat;

    const def = FORCE_PALETTE.has(key) ? undefined : matDefsLower.get(key);
    if (def?.diffuse) {
      mat = new THREE.MeshStandardMaterial({
        map: loadTex(def.diffuse, true),
        roughness: 0.75,
        metalness: 0.05,
      });
      if (def.emissive) {
        mat.emissiveMap = loadTex(def.emissive, true);
        mat.emissive = new THREE.Color("#ffffff");
        mat.emissiveIntensity = 1.4;
      }
      if (def.normal) {
        mat.normalMap = loadTex(def.normal, false);
      }
    } else {
      const [color, roughness, metalness, emissive, emissiveIntensity] =
        PALETTE[key] ?? PALETTE.default;
      mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      if (emissive) {
        mat.emissive = new THREE.Color(emissive);
        mat.emissiveIntensity = emissiveIntensity ?? 1;
      }
    }
    mat.name = key;
    matCache.set(key, mat);
    return mat;
  }

  const loader = new GLTFLoader();
  const group = new THREE.Group();
  const staticMeshes: THREE.Mesh[] = [];
  const panels: Panel[] = [];
  let viewscreen: THREE.Mesh | null = null;

  // Several actors can reference the same mesh package; load each file once and
  // prefer the placement whose material has extracted textures.
  const byMesh = new Map<string, MeshPlacement>();
  for (const p of manifest.meshes) {
    const existing = byMesh.get(p.mesh);
    if (!existing || (!matDefsLower.has((existing.material || "").toLowerCase()) && p.material)) {
      byMesh.set(p.mesh, p);
    }
  }

  await Promise.all(
    [...byMesh.values()].map(async (placement) => {
      let gltf;
      try {
        gltf = await loader.loadAsync(`${assetsBase}/models/${placement.mesh}.gltf`);
      } catch {
        console.warn(`missing model: ${placement.mesh}`);
        return;
      }
      const material = makeMaterial(placement.material, placement.mesh);
      gltf.scene.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        mesh.material = material;
        mesh.name = placement.mesh;
        staticMeshes.push(mesh);

        if (placement.mesh === "SC_Mainscreen") {
          viewscreen = mesh;
        } else if (placement.mesh.startsWith("SC_") && material.emissiveMap) {
          panels.push({
            mesh,
            name: placement.mesh.replace(/^SC_/, ""),
            onMaterial: material,
            offMaterial: FALLBACK_OFF,
            powered: true,
          });
        }
      });
      if (placement.position) gltf.scene.position.fromArray(placement.position);
      group.add(gltf.scene);
    })
  );

  return { group, staticMeshes, panels, viewscreen, manifest };
}
