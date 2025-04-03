import {
  Component,
  ElementRef,
  AfterViewInit,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <canvas #rendererCanvas></canvas>
    <div class="status">
      {{statusText}}
      <button class="copy-button" (click)="copyResults()">📋 Copy Results</button>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        position: relative;
      }
      canvas {
        width: 100vw !important;
        height: 100vh !important;
        display: block;
      }
      .status {
        position: absolute;
        top: 10px;
        left: 10px;
        color: white;
        font-family: monospace;
        background: rgba(0, 0, 0, 0.5);
        padding: 10px;
        white-space: pre;
        max-height: 90vh;
        overflow-y: auto;
      }
      .copy-button {
        display: block;
        margin-top: 10px;
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-family: monospace;
      }
      .copy-button:active {
        background: rgba(255, 255, 255, 0.3);
      }
    `,
  ],
})
export class AppComponent implements AfterViewInit {
  @ViewChild('rendererCanvas')
  private rendererCanvas!: ElementRef<HTMLCanvasElement>;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private testMeshes: THREE.Mesh[] = [];
  private currentVertexCount = 0;
  private baselineFrameTime = 0;
  private frameTimes: number[] = [];
  private readonly maxFrameTime = 16.67; // 60 FPS in ms
  private isMeasuringBaseline = true;
  private isTestStopped = false;
  private baselineMeasurements: number[] = [];
  private logs: string[] = [];
  public statusText = 'Initializing...';

  constructor(private changeDetector: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.initThreeJS();
    this.createTestEnvironment();
    this.animate();
    
    // Add resize handler
    window.addEventListener('resize', () => this.onWindowResize());
  }

  private onWindowResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private updateStatus(text: string): void {
    this.logs.push(text);
    this.statusText = this.logs.join('\n');
    this.changeDetector.detectChanges();
  }

  private initThreeJS(): void {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.z = 5;

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.rendererCanvas.nativeElement,
      antialias: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // Controls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    this.scene.add(directionalLight);
  }

  private createTestEnvironment(): void {
    // Create a simple cube as baseline
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
    this.testMeshes.push(cube);
  }

  private measureBaselinePerformance(): void {
    const startTime = performance.now();
    this.renderer.render(this.scene, this.camera);
    const endTime = performance.now();
    this.baselineMeasurements.push(endTime - startTime);

    if (this.baselineMeasurements.length >= 60) {
      this.baselineFrameTime =
        this.baselineMeasurements.reduce((a, b) => a + b, 0) /
        this.baselineMeasurements.length;
      this.isMeasuringBaseline = false;
      this.currentVertexCount = 1000; // Start with 1000 vertices
      this.addTestMesh();
      this.updateStatus(
        `=== Baseline Performance ===\n` +
          `Testing with ${this.currentVertexCount.toLocaleString()} vertices\n` +
          `Baseline: ${this.baselineFrameTime.toFixed(2)}ms\n` +
          `=== Performance Testing ===`
      );
    }
  }

  private createTestMesh(vertexCount: number): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(vertexCount);

    // Create a sphere-like distribution of vertices
    for (let i = 0; i < vertexCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = 1;

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // Normalize normals
      const length = Math.sqrt(
        positions[i * 3] * positions[i * 3] +
          positions[i * 3 + 1] * positions[i * 3 + 1] +
          positions[i * 3 + 2] * positions[i * 3 + 2]
      );

      normals[i * 3] = positions[i * 3] / length;
      normals[i * 3 + 1] = positions[i * 3 + 1] / length;
      normals[i * 3 + 2] = positions[i * 3 + 2] / length;

      indices[i] = i;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      wireframe: true,
    });

    return new THREE.Mesh(geometry, material);
  }

  private cleanupMeshes(): void {
    // Remove all meshes except the baseline cube
    while (this.testMeshes.length > 1) {
      const mesh = this.testMeshes.pop()!;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material: THREE.Material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  }

  private measurePerformance(): void {
    // If test is already stopped, just show current status
    if (this.isTestStopped) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const startTime = performance.now();
    this.renderer.render(this.scene, this.camera);
    const endTime = performance.now();
    const frameTime = endTime - startTime;

    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > 60) {
      this.frameTimes.shift();
    }

    const avgFrameTime =
      this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    if (avgFrameTime > this.maxFrameTime) {
      // If performance is poor (over 16.67ms), show final results and stop the test
      this.isTestStopped = true;
      this.updateStatus(
        `=== Test Results ===\n` +
          `| Vertices: ${this.currentVertexCount.toLocaleString()} | Baseline: ${this.baselineFrameTime.toFixed(
            2
          )}ms | Final: ${avgFrameTime.toFixed(2)}ms | FPS: ${(
            1000 / avgFrameTime
          ).toFixed(1)}`
      );
      return;
    }

    // If performance is good (under 16.67ms), continue testing
    this.currentVertexCount += 1000;
    this.cleanupMeshes();
    this.addTestMesh();
    this.updateStatus(
      `Vertices: ${this.currentVertexCount.toLocaleString()} | Baseline: ${this.baselineFrameTime.toFixed(
        2
      )}ms | Current: ${avgFrameTime.toFixed(2)}ms | FPS: ${(
        1000 / avgFrameTime
      ).toFixed(1)}`
    );
  }

  private addTestMesh(): void {
    const mesh = this.createTestMesh(this.currentVertexCount);
    mesh.position.x = 2; // Position next to the cube
    this.scene.add(mesh);
    this.testMeshes.push(mesh);
  }

  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.controls.update();

    if (this.isMeasuringBaseline) {
      this.measureBaselinePerformance();
    } else {
      this.measurePerformance();
    }
  }

  async copyResults(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.statusText);
      const originalText = this.statusText;
      this.statusText += '\n\nCopied to clipboard! ✓';
      setTimeout(() => {
        this.statusText = originalText;
        this.changeDetector.detectChanges();
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      this.statusText += '\n\nFailed to copy. Please try manually selecting the text.';
    }
    this.changeDetector.detectChanges();
  }
}
