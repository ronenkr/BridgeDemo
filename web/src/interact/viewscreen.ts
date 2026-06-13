import * as THREE from "three";

// Procedural starfield: hashed point stars with twinkle and a slow drift,
// over a faint blue space gradient. (The original used a render target fed by
// a star particle system; its texture did not survive extraction.)
const starVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const starFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float starLayer(vec2 uv, float density, float t) {
    vec2 cell = floor(uv * density);
    vec2 f = fract(uv * density);
    float h = hash(cell);
    if (h < 0.85) return 0.0;
    vec2 starPos = vec2(hash(cell + 7.0), hash(cell + 13.0)) * 0.6 + 0.2;
    float d = length(f - starPos);
    float twinkle = 0.8 + 0.2 * sin(t * (1.5 + h * 4.0) + h * 40.0);
    return smoothstep(0.16, 0.0, d) * twinkle * (0.5 + 0.5 * hash(cell + 3.0)) * 2.2;
  }

  void main() {
    vec2 uv = vUv + vec2(uTime * 0.0035, 0.0); // slow impulse drift
    vec3 col = mix(vec3(0.004, 0.006, 0.016), vec3(0.012, 0.02, 0.05), vUv.y);
    col += vec3(1.0) * starLayer(uv, 38.0, uTime);
    col += vec3(0.8, 0.85, 1.0) * starLayer(uv * 1.7 + 11.0, 55.0, uTime * 1.3) * 0.7;
    col += vec3(0.9, 0.8, 0.7) * starLayer(uv * 0.8 + 31.0, 24.0, uTime * 0.8) * 0.9;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class Viewscreen {
  private starMaterial: THREE.ShaderMaterial;
  private offMaterial: THREE.Material;
  private powered = true;
  private mesh: THREE.Mesh;

  constructor(mesh: THREE.Mesh) {
    this.mesh = mesh;
    this.starMaterial = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: { uTime: { value: 0 } },
    });
    this.offMaterial = new THREE.MeshStandardMaterial({
      color: "#04060c",
      roughness: 0.3,
      metalness: 0.4,
    });
    mesh.material = this.starMaterial;
  }

  toggle() {
    this.powered = !this.powered;
    this.mesh.material = this.powered ? this.starMaterial : this.offMaterial;
  }

  update(time: number) {
    if (this.powered) this.starMaterial.uniforms.uTime.value = time;
  }
}
