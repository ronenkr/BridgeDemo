import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

/**
 * Builds a fixed rigid body with one trimesh collider per static mesh.
 * All level meshes are world-space modeled (origin mode), but parent transforms
 * are applied anyway in case of placement overrides.
 */
export function buildStaticCollision(
  rapier: typeof RAPIER,
  world: RAPIER.World,
  meshes: THREE.Mesh[]
) {
  const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
  let triangles = 0;

  for (const mesh of meshes) {
    const geom = mesh.geometry;
    const posAttr = geom.attributes.position;
    if (!posAttr) continue;

    mesh.updateWorldMatrix(true, false);
    const vertices = new Float32Array(posAttr.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
      vertices.set([v.x, v.y, v.z], i * 3);
    }

    let indices: Uint32Array;
    if (geom.index) {
      indices = new Uint32Array(geom.index.array);
    } else {
      indices = new Uint32Array(posAttr.count);
      for (let i = 0; i < posAttr.count; i++) indices[i] = i;
    }

    world.createCollider(rapier.ColliderDesc.trimesh(vertices, indices), body);
    triangles += indices.length / 3;
  }

  console.log(`collision: ${meshes.length} trimeshes, ${triangles} triangles`);
  return body;
}
