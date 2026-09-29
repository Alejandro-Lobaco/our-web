import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import type { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { BEATS, CUES, sampleCues, type Cue } from "./cues";
import { bakeStudio, Flame, GrainShader, makeFloor, makePlainFloor, Sparks, STUDIO_BG } from "./effects";
import { LabelLayer, type ScreenPoint } from "./labels";
import { buildLighter, type LighterRig, type PieceId } from "./lighter";
import { Sound } from "./sound";
import { SPEC } from "./spec";

const DEG = Math.PI / 180;
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (cur: number, target: number, k: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-k * dt));

export interface EngineOptions {
  mobile: boolean;
  reducedMotion: boolean;
  labelLayer?: HTMLElement | null;
  /** Congela la línea de tiempo en un valor (capturas y depuración). */
  lockTimeline?: number | null;
}

export class AscuaEngine {
  readonly sound = new Sound();
  onLitChange?: (lit: boolean) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 4, 6000);
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private grain!: ShaderPass;
  private floor!: Reflector;
  private plainFloor!: THREE.Mesh;
  private envRT!: THREE.WebGLRenderTarget;
  private rig!: LighterRig;
  private flame!: Flame;
  private sparks!: Sparks;
  private labels?: LabelLayer;
  private edges: THREE.LineSegments[] = [];
  private edgeMat = new THREE.LineBasicMaterial({ color: 0xf1e7da, transparent: true, opacity: 0, depthWrite: false });

  private raf = 0;
  private last = 0;
  private time = 0;
  private timeScale = 1;
  private tTarget = 0;
  private t = 0;
  private cue: Cue = { ...CUES[0] };
  private pointer = new THREE.Vector2();
  private pointerS = new THREE.Vector2();
  private tilt = 0;
  private tiltS = 0;
  private bpTarget = 0;
  private bp = 0;
  private bpActive = false;
  private lit = false;
  private flameAmt = 0;
  private lidPrev = 0;
  private wheelAngle = 0;
  private wheelVel = 0;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private quality = 0;
  private perf = { frames: 0, time: 0, grace: 2.5 };
  private ro?: ResizeObserver;
  private disposed = false;
  private jumped = false;
  private tmp = new THREE.Vector3();
  private screen: ScreenPoint[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: EngineOptions,
  ) {}

  async init() {
    const { mobile } = this.opts;
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: "high-performance",
    });
    this.renderer = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    this.dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 2);
    this.measure();
    renderer.setPixelRatio(this.dpr);
    renderer.setSize(this.w, this.h, false);

    // Luz: estudio horneado a entorno.
    this.envRT = bakeStudio(renderer);
    this.scene.environment = this.envRT.texture;
    // Fondo como color de escena (no clearColor): así se limpia en espacio lineal.
    this.scene.background = STUDIO_BG;
    this.scene.environmentIntensity = 1;

    // Producto.
    this.rig = buildLighter({ mobile });
    this.scene.add(this.rig.root);
    this.flame = new Flame(this.rig.flameAnchor);
    this.sparks = new Sparks(this.dpr);
    this.rig.sparkAnchor.add(this.sparks.group);

    // Aristas para el modo plano.
    for (const m of this.rig.meshes) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), this.edgeMat);
      e.visible = false;
      m.add(e);
      this.edges.push(e);
    }

    // Suelo.
    const rs = mobile ? 0.4 : 0.5;
    this.floor = makeFloor(Math.round(this.w * this.dpr * rs), Math.round(this.h * this.dpr * rs));
    this.plainFloor = makePlainFloor();
    this.plainFloor.visible = false;
    this.scene.add(this.floor, this.plainFloor);

    // Post: MSAA HDR → bloom → ACES → grano.
    const rt = new THREE.WebGLRenderTarget(this.w * this.dpr, this.h * this.dpr, {
      type: THREE.HalfFloatType,
      samples: mobile ? 2 : 4,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.setPixelRatio(this.dpr);
    this.composer.setSize(this.w, this.h);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.w / 2, this.h / 2), 0.6, 0.45, 2.1);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grain = new ShaderPass(GrainShader);
    this.grain.uniforms.uAmount.value = mobile ? 0.028 : 0.034;
    this.composer.addPass(this.grain);

    if (this.opts.labelLayer) this.labels = new LabelLayer(this.opts.labelLayer, this.rig.labels);
    this.screen = this.rig.labels.map(() => ({ x: 0, y: 0 }));

    if (this.opts.lockTimeline != null) this.tTarget = this.t = this.opts.lockTimeline;
    this.step(0, true);
    await renderer.compileAsync(this.scene, this.camera);
    if (this.disposed) return;
    this.composer.render();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.canvas);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ── API pública ───────────────────────────────────────────
  setTimeline(t: number) {
    if (this.opts.lockTimeline != null) return;
    const next = clamp(t, 0, CUES[CUES.length - 1].at);
    // Saltos largos (enlaces del menú): se corta en seco en vez de recorrer todo el guion.
    if (Math.abs(next - this.t) > 1.5) {
      this.t = next;
      this.jumped = true;
    }
    this.tTarget = next;
  }

  setTilt(x: number) {
    this.tilt = clamp(x, -1, 1);
  }

  setBlueprint(on: boolean) {
    this.bpTarget = on ? 1 : 0;
  }

  setSound(on: boolean) {
    this.sound.setEnabled(on);
    this.sound.setFlame(this.flameAmt);
  }

  get isLit() {
    return this.lit;
  }

  /** Mantener completado: la rueda gira, saltan chispas y prende la llama. */
  strike() {
    if (this.cue.lid < 0.6) return;
    this.wheelVel = -26;
    this.sparks.emit(this.rig.sparkOrigin, 42);
    this.sound.rasp();
    this.timeScale = Math.min(this.timeScale, 0.45);
    window.setTimeout(() => {
      if (this.disposed || this.cue.lid < 0.6) return;
      this.setLit(true);
      this.sound.whoomp();
    }, 90);
  }

  extinguish() {
    this.setLit(false);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener("pointermove", this.onPointer);
    this.sound.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Points) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
          m.dispose();
        }
      }
    });
    this.floor?.dispose();
    this.envRT?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();
  }

  // ── Interno ───────────────────────────────────────────────
  private setLit(on: boolean) {
    if (this.lit === on) return;
    this.lit = on;
    this.onLitChange?.(on);
  }

  private onPointer = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  };

  private measure() {
    this.w = Math.max(1, this.canvas.clientWidth || window.innerWidth);
    this.h = Math.max(1, this.canvas.clientHeight || window.innerHeight);
  }

  private resize() {
    const pw = this.w;
    const ph = this.h;
    this.measure();
    if (pw === this.w && ph === this.h) return;
    this.applyQuality();
  }

  private applyQuality() {
    const scale = [1, 0.8, 0.68, 0.58][this.quality];
    const dpr = Math.max(0.75, Math.min(window.devicePixelRatio || 1, this.opts.mobile ? 1.75 : 2) * scale);
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(this.w, this.h);
    this.sparks.setPixelRatio(dpr);
    const rs = this.opts.mobile ? 0.4 : 0.5;
    this.floor.getRenderTarget().setSize(Math.round(this.w * dpr * rs), Math.round(this.h * dpr * rs));
    this.bloom.enabled = this.quality < 2;
    const reflect = this.quality < 3;
    this.floor.visible = reflect;
    this.plainFloor.visible = !reflect;
  }

  /** Si el móvil no llega a 40 fps: baja resolución, luego quita bloom, luego el reflejo. */
  private watchPerf(realDt: number) {
    if (this.opts.lockTimeline != null) return;
    if (this.perf.grace > 0) {
      this.perf.grace -= realDt;
      return;
    }
    this.perf.frames++;
    this.perf.time += realDt;
    if (this.perf.time < 1.6) return;
    const fps = this.perf.frames / this.perf.time;
    this.perf.frames = 0;
    this.perf.time = 0;
    if (fps < 40 && this.quality < 3) {
      this.quality++;
      this.applyQuality();
      this.perf.grace = 1.2;
    }
  }

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const realDt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (document.hidden) return;
    this.watchPerf(realDt);
    this.step(realDt, false);
    this.composer.render(realDt);
  };

  private pieceProgress(explode: number, order: number) {
    const st = 0.12;
    const span = 1 + 3 * st;
    return easeInOut(clamp(explode * span - order * st));
  }

  private step(realDt: number, snap: boolean) {
    const { mobile, reducedMotion } = this.opts;
    const dt = realDt;
    const quiet = snap || this.jumped;
    this.jumped = false;

    // Scroll suavizado (lerp ≈ 0.09 a 60 fps).
    this.t = snap ? this.tTarget : damp(this.t, this.tTarget, reducedMotion ? 14 : 5.5, dt);
    const prevT = this.cue.at;
    const c = sampleCues(this.t, this.cue);

    // Un único reloj para todo; la cámara lenta solo baja su ritmo.
    this.timeScale = snap ? c.timeScale : damp(this.timeScale, reducedMotion ? 1 : c.timeScale, 3, dt);
    const sdt = dt * this.timeScale;
    this.time += sdt;

    this.pointerS.x = damp(this.pointerS.x, this.pointer.x, 3, dt);
    this.pointerS.y = damp(this.pointerS.y, this.pointer.y, 3, dt);
    this.tiltS = damp(this.tiltS, this.tilt, 4, dt);

    // Eventos en el beat: chispas a cámara lenta al cruzar el detalle.
    if (!quiet && (prevT - BEATS.sparks) * (this.t - BEATS.sparks) < 0 && this.t > prevT) {
      this.wheelVel = -14;
      this.sparks.emit(this.rig.sparkOrigin, 30);
      this.sound.rasp();
    }

    // Despiece.
    const { pieces, lidHinge, wheelSpin, root } = this.rig;
    for (const id of Object.keys(pieces) as PieceId[]) {
      const p = pieces[id];
      const k = this.pieceProgress(c.explode, p.order);
      p.group.position.copy(p.offset).multiplyScalar(k);
    }
    const lidExplode = this.pieceProgress(c.explode, pieces.tapa.order);
    lidHinge.rotation.z = SPEC.lidOpen * smoothstep(0, 1, c.lid) * (1 - lidExplode);

    // Sonido de tapa y apagado al cerrar.
    if (!quiet) {
      if (this.lidPrev < 0.22 && c.lid >= 0.22) this.sound.clink();
      if (this.lidPrev > 0.2 && c.lid <= 0.2) {
        this.sound.clack();
        this.setLit(false);
      }
    }
    this.lidPrev = c.lid;
    if (c.explode > 0.3 && this.lit) this.setLit(false);

    // Respiración en reposo.
    const idle = reducedMotion ? 0 : c.idle;
    root.rotation.y = idle * Math.sin(this.time * 0.32) * 0.16;

    // Rueda.
    this.wheelVel *= Math.exp(-sdt * 3.2);
    this.wheelAngle += this.wheelVel * sdt;
    wheelSpin.rotation.z = this.wheelAngle;

    // Llama.
    const flameTarget = this.lit ? 1 : 0;
    this.flameAmt = snap ? flameTarget : damp(this.flameAmt, flameTarget, this.lit ? 7 : 12, dt);
    const lean = clamp(-this.tiltS * 0.9 - this.pointerS.x * 0.18 + Math.sin(this.time * 1.3) * 0.04, -1, 1);
    this.flame.update(this.time, this.flameAmt, lean, this.camera);
    this.sound.setFlame(this.flameAmt);
    this.sparks.update(sdt);
    const fu = (this.floor.material as THREE.ShaderMaterial).uniforms;
    fu.uWarm.value = this.flameAmt * 0.055;
    fu.uWarmCenter.value.set(SPEC.wick.x, 0);

    // Entorno: gira con el cursor o el giroscopio.
    this.scene.environmentRotation.set(this.pointerS.y * 0.12, this.pointerS.x * 0.55 + this.tiltS * 0.5, 0);

    this.placeCamera(c, mobile);
    this.updateBlueprint(dt, snap);
    this.grain.uniforms.uTime.value = reducedMotion ? 0 : this.time;
    this.updateLabels(c, mobile);
  }

  private placeCamera(c: Cue, mobile: boolean) {
    const cam = this.camera;
    cam.fov = mobile ? 34 : 30;
    cam.aspect = this.w / this.h;
    const tv = Math.tan((cam.fov * DEG) / 2);
    const th = tv * cam.aspect;
    const dist = Math.max(c.size / (2 * tv), c.width / (2 * th));
    const az = (c.az + this.pointerS.x * 3) * DEG;
    const el = clamp((c.el + this.pointerS.y * 2) * DEG, 1.5 * DEG, 80 * DEG);
    const [tx, ty, tz] = c.target;
    cam.position.set(tx + dist * Math.cos(el) * Math.sin(az), ty + dist * Math.sin(el), tz + dist * Math.cos(el) * Math.cos(az));
    cam.lookAt(tx, ty, tz);
    const sx = mobile ? c.msx : c.sx;
    const sy = mobile ? c.msy : c.sy;
    cam.setViewOffset(this.w, this.h, -sx * this.w, -sy * this.h, this.w, this.h);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  private updateBlueprint(dt: number, snap: boolean) {
    this.bp = snap ? this.bpTarget : damp(this.bp, this.bpTarget, 6, dt);
    const on = this.bp > 0.003;
    if (on !== this.bpActive) {
      this.bpActive = on;
      for (const m of this.rig.materials.all) {
        m.transparent = on;
        m.depthWrite = !on;
        m.needsUpdate = true;
      }
      for (const e of this.edges) e.visible = on;
    }
    if (on) {
      for (const m of this.rig.materials.all) m.opacity = 1 - 0.9 * this.bp;
      this.edgeMat.opacity = 0.85 * this.bp;
    }
  }

  private updateLabels(c: Cue, mobile: boolean) {
    if (!this.labels) return;
    const vis = smoothstep(0.78, 0.98, c.explode);
    if (vis < 0.01) {
      this.labels.hide();
      return;
    }
    this.rig.root.updateMatrixWorld();
    this.rig.labels.forEach((l, i) => {
      const g = this.rig.pieces[l.piece].group;
      this.tmp.copy(l.anchor).applyMatrix4(g.matrixWorld).project(this.camera);
      this.screen[i].x = (this.tmp.x * 0.5 + 0.5) * this.w;
      this.screen[i].y = (-this.tmp.y * 0.5 + 0.5) * this.h;
    });
    this.tmp.set(c.target[0], c.target[1], c.target[2]).project(this.camera);
    const cx = (this.tmp.x * 0.5 + 0.5) * this.w;
    this.labels.update(this.screen, cx, this.w, this.h, vis, mobile);
  }
}
