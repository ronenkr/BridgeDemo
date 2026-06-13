import * as THREE from "three";

const FIXED_DT = 1 / 60;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  /** Called at a fixed 60 Hz for physics. */
  onFixedUpdate: (dt: number) => void = () => {};
  /** Called once per rendered frame. */
  onFrame: (dt: number, time: number) => void = () => {};

  private accumulator = 0;
  private lastTime = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      72,
      window.innerWidth / window.innerHeight,
      0.05,
      200
    );

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  start() {
    this.lastTime = performance.now();
    this.renderer.setAnimationLoop((time) => {
      const dt = Math.min((time - this.lastTime) / 1000, 0.05);
      this.lastTime = time;

      this.accumulator += dt;
      while (this.accumulator >= FIXED_DT) {
        this.onFixedUpdate(FIXED_DT);
        this.accumulator -= FIXED_DT;
      }

      this.onFrame(dt, time / 1000);
      this.renderer.render(this.scene, this.camera);
    });
  }
}
