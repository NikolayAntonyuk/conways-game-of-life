import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CellChange3D } from './GameOfLife3D.ts';

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

  // Differential update bookkeeping
  private readonly instanceIndex: Int32Array;  // buffer index → instance slot (-1 = dead)
  private readonly slotToIndex:   Int32Array;  // instance slot → buffer index

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

    // ── InstancedMesh — one draw call for all alive cells ─────────────────────
    const total = cols * rows * layers;
    const geo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    const mat = new THREE.MeshBasicMaterial({ color: CELL_COLOR });
    this.mesh = new THREE.InstancedMesh(geo, mat, total);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.scene.add(this.mesh);

    // ── Differential update maps ───────────────────────────────────────────────
    this.instanceIndex = new Int32Array(total).fill(-1);
    this.slotToIndex   = new Int32Array(total);

    // ── Wireframe bounding box ────────────────────────────────────────────────
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(cols, rows, layers));
    const line  = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: CELL_COLOR, transparent: true, opacity: 0.12 }),
    );
    line.position.set(cx, cy, cz);
    this.scene.add(line);
  }

  /** Rebuild InstancedMesh from a flat Uint8Array buffer. O(totalCells). Used for init/clear/randomize. */
  syncFromBuffer(buffer: Uint8Array): void {
    const { cols, rows, slice, dummy, mesh, instanceIndex, slotToIndex } = this;
    instanceIndex.fill(-1);
    let count = 0;

    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] !== 1) continue;
      const x = i % cols;
      const y = Math.floor(i / cols) % rows;
      const z = Math.floor(i / slice);
      dummy.position.set(x, y, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(count, dummy.matrix);
      instanceIndex[i] = count;
      slotToIndex[count] = i;
      count++;
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** Apply a diff from one step. O(changedCells). Used after each game.step(). */
  applyChanges(changes: CellChange3D[]): void {
    if (changes.length === 0) return;
    const { cols, rows, slice, dummy, mesh, instanceIndex, slotToIndex } = this;

    for (const { index, alive } of changes) {
      if (alive) {
        // Born: add new instance at mesh.count
        const slot = mesh.count;
        const x = index % cols;
        const y = Math.floor(index / cols) % rows;
        const z = Math.floor(index / slice);
        dummy.position.set(x, y, z);
        dummy.updateMatrix();
        mesh.setMatrixAt(slot, dummy.matrix);
        instanceIndex[index] = slot;
        slotToIndex[slot] = index;
        mesh.count++;
      } else {
        // Died: swap-with-last removal
        const slot = instanceIndex[index];
        if (slot === -1) continue;
        const lastSlot = mesh.count - 1;
        if (slot !== lastSlot) {
          // Move last instance into the vacated slot
          const lastIndex = slotToIndex[lastSlot];
          const lx = lastIndex % cols;
          const ly = Math.floor(lastIndex / cols) % rows;
          const lz = Math.floor(lastIndex / slice);
          dummy.position.set(lx, ly, lz);
          dummy.updateMatrix();
          mesh.setMatrixAt(slot, dummy.matrix);
          instanceIndex[lastIndex] = slot;
          slotToIndex[slot] = lastIndex;
        }
        instanceIndex[index] = -1;
        mesh.count--;
      }
    }

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
