import * as THREE from "three";
import type { LevelManifest } from "./level";

const LIGHT_COLORS: Record<string, { color: string; intensity: number }> = {
  blue: { color: "#6f9fe8", intensity: 6 },
  darkblue: { color: "#3a5a9e", intensity: 4 },
  white: { color: "#fff4e0", intensity: 7 },
};

/**
 * The original level has 83 point lights — far too many for a forward renderer.
 * Greedily cluster same-type lights within a merge radius and scale intensity
 * by cluster size, keeping the count low while preserving the light distribution.
 */
export function buildLights(scene: THREE.Scene, manifest: LevelManifest) {
  scene.add(new THREE.HemisphereLight("#aebcd8", "#262a33", 0.55));

  const mergeRadius = 2.2;
  type Cluster = { type: string; pos: THREE.Vector3; count: number };
  const clusters: Cluster[] = [];

  for (const l of manifest.lights) {
    const p = new THREE.Vector3().fromArray(l.position);
    const near = clusters.find(
      (c) => c.type === l.type && c.pos.distanceTo(p) < mergeRadius
    );
    if (near) {
      // running centroid
      near.pos.lerp(p, 1 / (near.count + 1));
      near.count++;
    } else {
      clusters.push({ type: l.type, pos: p, count: 1 });
    }
  }

  for (const c of clusters) {
    const def = LIGHT_COLORS[c.type] ?? LIGHT_COLORS.white;
    const light = new THREE.PointLight(
      def.color,
      def.intensity * Math.sqrt(c.count),
      14,
      1.8
    );
    light.position.copy(c.pos);
    scene.add(light);
  }

  console.log(`lights: ${manifest.lights.length} -> ${clusters.length} clusters`);
}
