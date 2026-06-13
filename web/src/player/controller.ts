import * as THREE from "three";
import type RAPIER from "@dimforge/rapier3d-compat";

const EYE_HEIGHT = 1.62;
const CAPSULE_RADIUS = 0.3;
const CAPSULE_HALF = 0.6; // cylinder half-height; total height ~1.8 m
const WALK_SPEED = 2.6;
const GRAVITY = -9.81;

export class PlayerController {
  yaw = 0;
  pitch = 0;

  private body: RAPIER.RigidBody;
  private collider: RAPIER.Collider;
  private controller: RAPIER.KinematicCharacterController;
  private velocityY = 0;
  private keys = new Set<string>();

  private camera: THREE.PerspectiveCamera;

  constructor(
    rapier: typeof RAPIER,
    world: RAPIER.World,
    camera: THREE.PerspectiveCamera,
    spawn: THREE.Vector3,
    yawDeg: number
  ) {
    this.camera = camera;
    this.yaw = THREE.MathUtils.degToRad(yawDeg);

    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + 1, spawn.z)
    );
    this.collider = world.createCollider(
      rapier.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_RADIUS),
      this.body
    );

    this.controller = world.createCharacterController(0.02);
    this.controller.enableAutostep(0.35, 0.15, true);
    this.controller.enableSnapToGround(0.35);
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    this.controller.setApplyImpulsesToDynamicBodies(false);

    window.addEventListener("keydown", (e) => this.keys.add(e.code));
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());
  }

  onMouseMove(dx: number, dy: number) {
    this.yaw -= dx * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0022, -1.45, 1.45);
  }

  update(dt: number) {
    const forward =
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) -
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0);
    const strafe =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);

    const move = new THREE.Vector3(strafe, 0, -forward);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(WALK_SPEED * dt);
      move.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    }

    this.velocityY = this.controller.computedGrounded()
      ? -0.5 * dt
      : this.velocityY + GRAVITY * dt;
    move.y = this.velocityY * dt;

    this.controller.computeColliderMovement(this.collider, move);
    const corrected = this.controller.computedMovement();
    const pos = this.body.translation();
    this.body.setNextKinematicTranslation({
      x: pos.x + corrected.x,
      y: pos.y + corrected.y,
      z: pos.z + corrected.z,
    });
  }

  syncCamera() {
    const pos = this.body.translation();
    this.camera.position.set(pos.x, pos.y - (CAPSULE_HALF + CAPSULE_RADIUS) + EYE_HEIGHT, pos.z);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
  }
}
