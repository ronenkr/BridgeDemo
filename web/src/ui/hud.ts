export class Hud {
  readonly interactLabel: HTMLElement;
  private overlay: HTMLElement;
  private status: HTMLElement;

  constructor(onStart: () => void) {
    const make = (cls: string, parent: HTMLElement = document.body) => {
      const el = document.createElement("div");
      el.className = cls;
      parent.appendChild(el);
      return el;
    };

    make("crosshair");
    const hints = make("hints");
    hints.textContent = "WASD move · mouse look · E interact · V viewscreen";
    this.interactLabel = make("interact-label");

    this.overlay = make("start-overlay");
    this.overlay.innerHTML = `
      <h1>USS VOYAGER — BRIDGE</h1>
      <p class="loading">Loading…</p>
    `;
    this.status = this.overlay.querySelector(".loading")!;
    this.overlay.addEventListener("click", () => {
      if (this.overlay.dataset.ready === "1") onStart();
    });
  }

  setReady() {
    this.overlay.dataset.ready = "1";
    this.status.textContent = "Click to take the bridge";
    // headless verification: ?debug hides the overlay without pointer lock
    if (new URLSearchParams(location.search).has("debug")) this.showOverlay(false);
  }

  setError(message: string) {
    this.status.textContent = message;
  }

  showOverlay(visible: boolean) {
    this.overlay.style.display = visible ? "flex" : "none";
  }
}
