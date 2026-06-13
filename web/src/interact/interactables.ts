import * as THREE from "three";
import type { Panel } from "../world/level";
import type { Viewscreen } from "./viewscreen";

const MAX_DISTANCE = 3.2;

interface Target {
  object: THREE.Mesh;
  label: () => string;
  interact: () => void;
}

export class Interactions {
  private raycaster = new THREE.Raycaster();
  private targets = new Map<THREE.Object3D, Target>();
  private objects: THREE.Mesh[] = [];
  private hovered: Target | null = null;

  private camera: THREE.Camera;
  private labelEl: HTMLElement;

  constructor(camera: THREE.Camera, labelEl: HTMLElement) {
    this.camera = camera;
    this.labelEl = labelEl;
    this.raycaster.far = MAX_DISTANCE;
  }

  addPanel(panel: Panel) {
    this.register({
      object: panel.mesh,
      label: () => `${panel.powered ? "Disable" : "Enable"} panel ${panel.name}  [E]`,
      interact: () => {
        panel.powered = !panel.powered;
        panel.mesh.material = panel.powered ? panel.onMaterial : panel.offMaterial;
      },
    });
  }

  addViewscreen(mesh: THREE.Mesh, viewscreen: Viewscreen) {
    this.register({
      object: mesh,
      label: () => `Toggle viewscreen  [E / V]`,
      interact: () => viewscreen.toggle(),
    });
  }

  private register(t: Target) {
    this.targets.set(t.object, t);
    this.objects.push(t.object);
  }

  update() {
    this.camera.updateMatrixWorld();
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = this.raycaster.intersectObjects(this.objects, false)[0];
    this.hovered = hit ? (this.targets.get(hit.object) ?? null) : null;

    if (this.hovered) {
      this.labelEl.textContent = this.hovered.label();
      this.labelEl.style.display = "block";
    } else {
      this.labelEl.style.display = "none";
    }
  }

  interact() {
    this.hovered?.interact();
  }
}
