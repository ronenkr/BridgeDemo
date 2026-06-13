import "./style.css";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { Engine } from "./core/engine";
import { loadLevel } from "./world/level";
import { buildLights } from "./world/lights";
import { buildStaticCollision } from "./world/collision";
import { PlayerController } from "./player/controller";
import { Interactions } from "./interact/interactables";
import { Viewscreen } from "./interact/viewscreen";
import { Ambience } from "./audio/ambience";
import { Hud } from "./ui/hud";

async function init() {
  const container = document.querySelector<HTMLDivElement>("#app")!;
  const engine = new Engine(container);
  const ambience = new Ambience();

  const hud = new Hud(() => {
    engine.renderer.domElement.requestPointerLock();
  });

  await RAPIER.init();
  const physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  let level;
  try {
    level = await loadLevel();
  } catch (err) {
    hud.setError("Failed to load level assets — run the extraction pipeline (web/tools).");
    throw err;
  }

  engine.scene.add(level.group);
  buildLights(engine.scene, level.manifest);
  buildStaticCollision(RAPIER, physics, level.staticMeshes);

  // ?debug&pos=x,y,z&yaw=deg&pitch=deg overrides the spawn for headless verification
  const params = new URLSearchParams(location.search);
  const spawn = new THREE.Vector3().fromArray(level.manifest.spawn.position);
  let yawDeg = level.manifest.spawn.yawDeg;
  if (params.has("pos")) spawn.fromArray(params.get("pos")!.split(",").map(Number));
  if (params.has("yaw")) yawDeg = Number(params.get("yaw"));

  const player = new PlayerController(RAPIER, physics, engine.camera, spawn, yawDeg);
  if (params.has("pitch")) player.pitch = THREE.MathUtils.degToRad(Number(params.get("pitch")));

  const interactions = new Interactions(engine.camera, hud.interactLabel);
  for (const panel of level.panels) interactions.addPanel(panel);

  let viewscreen: Viewscreen | null = null;
  if (level.viewscreen) {
    viewscreen = new Viewscreen(level.viewscreen);
    interactions.addViewscreen(level.viewscreen, viewscreen);
  }

  const debugMode = params.has("debug");
  const locked = () =>
    debugMode || document.pointerLockElement === engine.renderer.domElement;

  document.addEventListener("pointerlockchange", () => {
    hud.showOverlay(!locked());
    if (locked()) ambience.start();
  });
  document.addEventListener("mousemove", (e) => {
    if (locked()) player.onMouseMove(e.movementX, e.movementY);
  });
  window.addEventListener("keydown", (e) => {
    if (!locked()) return;
    if (e.code === "KeyE") interactions.interact();
    if (e.code === "KeyV") viewscreen?.toggle();
  });
  engine.renderer.domElement.addEventListener("click", () => {
    if (locked()) interactions.interact();
  });

  engine.onFixedUpdate = (dt) => {
    if (locked()) player.update(dt);
    physics.step();
  };
  engine.onFrame = (_dt, time) => {
    player.syncCamera();
    if (locked()) interactions.update();
    viewscreen?.update(time);
  };

  engine.start();
  hud.setReady();

  // ?walktest: hold W for 3 simulated seconds (fixed steps 60..240), then report
  // the resulting position in the DOM so headless runs (--dump-dom) can verify
  // collision/walking without input. Frame-driven because Chrome's virtual time
  // fast-forwards timers without running animation frames in between.
  if (params.has("walktest")) {
    const key = (type: string) =>
      window.dispatchEvent(new KeyboardEvent(type, { code: "KeyW" }));
    // settle for 1s, walk 3s, all synchronously — headless virtual time barely
    // pumps animation frames, so don't depend on them
    const shouldWalk = params.get("walktest") === "walk";
    for (let step = 0; step < 240; step++) {
      if (shouldWalk && step === 60) key("keydown");
      player.update(1 / 60);
      physics.step();
    }
    key("keyup");
    player.syncCamera();
    if (params.has("aim")) {
      const target = new THREE.Vector3().fromArray(params.get("aim")!.split(",").map(Number));
      const dir = target.clone().sub(engine.camera.position).normalize();
      player.yaw = Math.atan2(-dir.x, -dir.z);
      player.pitch = Math.asin(dir.y);
      player.syncCamera();
    }
    interactions.update();
    if (params.has("press")) {
      window.dispatchEvent(new KeyboardEvent("keydown", { code: params.get("press")! }));
      interactions.update();
    }
    const el = document.createElement("div");
    el.id = "debug-state";
    el.textContent = JSON.stringify({
      camera: engine.camera.position.toArray().map((n) => +n.toFixed(2)),
      panels: level.panels.length,
      hover: hud.interactLabel.textContent,
    });
    document.body.appendChild(el);
  }
}

init();
