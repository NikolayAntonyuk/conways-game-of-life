import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const CELL_COLOR = 0x00ff88;
const BG_COLOR   = 0x0a0a0f;

export class Renderer3D {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene:    THREE.Scene;
  private readonly camera:   THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly mesh:     THREE.InstancedMesh;
  private readonly dummy  = new THREE.Object3D();

  private readonly cols:   number;
  private readonly rows:   number;
  private readonly slice:  number;  // cols * rows, cached

  constructor(canvas: HTMLCanvasElement, cols: number, rows: number, layers: number) {
    this.cols  = cols;
    this.rows  = rows;
    this.slice = cols * rows;

    // ── WebGL renderer ────────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.width, canvas.height, false);
    this.renderer.setClearColor(BG_COLOR);

    // ── Scene ─────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene();

    // ── Camera ────────────────────────────────────────────────────────────────
    const cx   = (cols   - 1) / 2;
    const cy   = (rows   - 1) / 2;
    const cz   = (layers - 1) / 2;
    const dist = Math.max(cols, rows, layers) * 1.5;

    this.camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 2000);
    this.camera.position.set(cx + dist * 0.6, cy + dist * 0.4, cz + dist);
    this.camera.lookAt(cx, cy, cz);

    // ── Orbit controls ────────────────────────────────────────────────────────
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(cx, cy, cz);
    this.controls.enableDamping  = true;
    this.controls.dampingFactor  = 0.08;
    this.controls.update();

    // ── Lighting ──────────────────────────────────────────────────────────────
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const dir = new THREE.DirectionalLight(CELL_COLOR, 2.5);
    dir.position.set(cols, rows * 1.5, layers * 2);
    this.scene.add(dir);

    // ── InstancedMesh — one draw call for all alive cells ─────────────────────
    const geo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    const mat = new THREE.MeshStandardMaterial({
      color:             CELL_COLOR,
      emissive:          new THREE.Color(CELL_COLOR),
      emissiveIntensity: 0.25,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, cols * rows * layers);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.scene.add(this.mesh);

    // ── Wireframe bounding box ────────────────────────────────────────────────
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(cols, rows, layers));
    const line  = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: CELL_COLOR, transparent: true, opacity: 0.12 }),
    );
    line.position.set(cx, cy, cz);
    this.scene.add(line);
  }

  /** Rebuild InstancedMesh from a flat Uint8Array buffer each step. O(totalCells). */
  syncFromBuffer(buffer: Uint8Array): void {
    const { cols, slice, dummy, mesh } = this;
    let count = 0;

    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] !== 1) continue;
      const x = i % cols;
      const y = Math.floor(i / cols) % this.rows;
      const z = Math.floor(i / slice);
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(count++, dummy.matrix);
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** Call every RAF tick — updates OrbitControls damping and submits GPU frame. */
  render(): void {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.controls.dispose();
    this.renderer.dispose();
  }
}
