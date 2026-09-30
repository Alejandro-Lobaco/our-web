import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { dotTexture } from "./materials";

const NOISE_GLSL = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
`;

// ── Estudio: softbox, tiras y un rim ámbar, horneado con PMREM ─────────────
export function bakeStudio(renderer: THREE.WebGLRenderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x000000);
  const geo = new THREE.PlaneGeometry(1, 1);
  const panel = (w: number, h: number, pos: [number, number, number], intensity: number, color = 0xffffff) => {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.scale.set(w, h, 1);
    m.position.set(...pos);
    m.lookAt(0, pos[1] * 0.35, 0);
    env.add(m);
  };
  panel(5.5, 3.4, [-5, 4.6, 4.2], 4.2); // softbox principal, arriba a la izquierda
  panel(12, 2.6, [0.8, 0.2, 8.5], 1.1); // cartón de relleno frontal: da forma a las caras negras
  panel(0.7, 8, [6.4, 0.8, 2.2], 3.4); // tira derecha
  panel(0.55, 8, [-6.8, 0.4, -2.4], 2.4); // tira izquierda trasera
  panel(7, 7, [0, 8, -1], 0.55); // cenital suave
  panel(4, 0.35, [0.5, 0.7, -6.5], 1.2, 0xff9a3c); // rim ámbar, rasante
  panel(24, 24, [0, -5, 0], 0.015); // rebote del suelo
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
  });
  geo.dispose();
  return rt;
}

// ── Suelo: espejo negro con desenfoque, fundido radial y halo de luz ──────
const FloorShader = {
  name: "AscuaFloor",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 0.32 },
    uBg: { value: new THREE.Color() },
    uRadius: { value: 170 },
    uHalo: { value: new THREE.Color(0.05, 0.047, 0.044) },
    uWarm: { value: 0 },
    uWarmCenter: { value: new THREE.Vector2(0, 0) },
    uBlur: { value: 0.0022 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vLocal;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vLocal = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform vec3 uBg;
    uniform float uRadius;
    uniform vec3 uHalo;
    uniform float uWarm;
    uniform vec2 uWarmCenter;
    uniform float uBlur;
    varying vec4 vUv;
    varying vec2 vLocal;
    void main() {
      vec3 acc = vec3(0.0);
      float wsum = 0.0;
      for (int i = -2; i <= 2; i++) {
        for (int j = -2; j <= 2; j++) {
          vec2 o = vec2(float(i), float(j)) * uBlur * vUv.w;
          float w = 1.0 / (1.0 + float(i * i + j * j));
          acc += texture2DProj(tDiffuse, vec4(vUv.xy + o, vUv.zw)).rgb * w;
          wsum += w;
        }
      }
      vec3 refl = acc / wsum;
      float d = length(vLocal) / uRadius;
      float fade = 1.0 - smoothstep(0.08, 1.0, d);
      float halo = exp(-dot(vLocal, vLocal) / (48.0 * 48.0));
      float warm = exp(-dot(vLocal - uWarmCenter, vLocal - uWarmCenter) / (38.0 * 38.0));
      vec3 col = mix(uBg, refl, uStrength * fade) + uHalo * halo + vec3(1.0, 0.45, 0.12) * warm * uWarm;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

/** Fondo del estudio (lineal): tras ACES queda en el #070708 de la página. */
export const STUDIO_BG = new THREE.Color().setRGB(0.0085, 0.0085, 0.0092);

export function makeFloor(width: number, height: number) {
  const floor = new Reflector(new THREE.PlaneGeometry(900, 900), {
    textureWidth: width,
    textureHeight: height,
    clipBias: 0.003,
    shader: FloorShader,
    multisample: 0,
  });
  (floor.material as THREE.ShaderMaterial).uniforms.uBg.value.copy(STUDIO_BG);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.25;
  return floor;
}

/** Suelo sin reflejo para el nivel de calidad más bajo. */
export function makePlainFloor() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uHalo: { value: new THREE.Color(0.05, 0.047, 0.044) }, uBg: { value: STUDIO_BG.clone() } },
    vertexShader: `varying vec2 vLocal; void main(){ vLocal = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uHalo; uniform vec3 uBg; varying vec2 vLocal; void main(){ gl_FragColor = vec4(uBg + uHalo * exp(-dot(vLocal,vLocal)/(48.0*48.0)), 1.0); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.25;
  return m;
}

// ── Llama ─────────────────────────────────────────────────────────────────
export class Flame {
  readonly mesh: THREE.Mesh;
  readonly light: THREE.PointLight;
  private uniforms = {
    uTime: { value: 0 },
    uAmount: { value: 0 },
    uLean: { value: 0 },
  };

  constructor(anchor: THREE.Object3D) {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uAmount;
        uniform float uLean;
        varying vec2 vUv;
        ${NOISE_GLSL}
        void main() {
          float h = max(uAmount, 0.001);
          float y = vUv.y / h;
          if (y > 1.08) discard;
          float n = fbm(vec2(vUv.x * 4.0, vUv.y * 5.0 - uTime * 4.4));
          float n2 = noise(vec2(uTime * 2.1, 3.7));
          float x = vUv.x - 0.5;
          x -= uLean * y * y * 0.32;
          x += (n - 0.5) * 0.2 * y;
          x += (n2 - 0.5) * 0.08 * y * y;
          float yc = clamp(y, 0.0, 1.0);
          float w = 0.30 * pow(yc, 0.42) * pow(1.0 - yc, 0.8) + 0.0001;
          float d = abs(x) / w;
          float body = smoothstep(1.0, 0.5, d) * smoothstep(1.02, 0.62, y);
          float core = smoothstep(0.72, 0.0, d) * smoothstep(0.8, 0.12, y) * smoothstep(0.0, 0.1, y);
          float blue = smoothstep(0.24, 0.02, y) * smoothstep(0.15, 0.9, d) * smoothstep(1.25, 0.85, d);
          vec3 col = vec3(1.0, 0.40, 0.09) * body * 2.4
                   + vec3(1.0, 0.84, 0.52) * core * 3.4
                   + vec3(0.16, 0.32, 1.0) * blue * 1.6;
          col *= 0.82 + 0.36 * n;
          col *= smoothstep(0.0, 0.2, uAmount);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.scale.set(13, 30, 1);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    anchor.add(this.mesh);

    this.light = new THREE.PointLight(0xff8f3a, 0, 0, 2);
    this.light.position.set(0, 9, 0);
    anchor.add(this.light);
  }

  update(time: number, amount: number, lean: number, camera: THREE.Camera) {
    const flick = 1 + 0.07 * Math.sin(time * 13.1) + 0.05 * Math.sin(time * 7.3 + 1.7) + 0.04 * Math.sin(time * 23.7);
    this.uniforms.uTime.value = time;
    this.uniforms.uAmount.value = amount * (0.96 + 0.04 * flick);
    this.uniforms.uLean.value = lean;
    this.mesh.visible = amount > 0.002;
    this.light.intensity = amount * 1400 * flick;
    // Billboard cilíndrico: la llama siempre mira a cámara.
    const wp = this.mesh.getWorldPosition(_v);
    const parentRot = this.mesh.parent ? _q.setFromRotationMatrix(this.mesh.parent.matrixWorld) : _q.identity();
    const yaw = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z);
    this.mesh.rotation.y = yaw - _e.setFromQuaternion(parentRot, "YXZ").y;
  }
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

// ── Chispas: estelas aditivas con gravedad ───────────────────────────────
export class Sparks {
  readonly group = new THREE.Group();
  private n = 200;
  private pos = new Float32Array(this.n * 3);
  private vel = new Float32Array(this.n * 3);
  private life = new Float32Array(this.n);
  private max = new Float32Array(this.n);
  private heat = new Float32Array(this.n);
  private cursor = 0;
  private lineGeo = new THREE.BufferGeometry();
  private pointGeo = new THREE.BufferGeometry();
  private linePos = new Float32Array(this.n * 6);
  private lineCol = new Float32Array(this.n * 6);
  private pointCol = new Float32Array(this.n * 3);
  private pointsMat: THREE.PointsMaterial;

  constructor(pixelRatio: number) {
    this.lineGeo.setAttribute("position", new THREE.BufferAttribute(this.linePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lineGeo.setAttribute("color", new THREE.BufferAttribute(this.lineCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.pointGeo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.pointGeo.setAttribute("color", new THREE.BufferAttribute(this.pointCol, 3).setUsage(THREE.DynamicDrawUsage));
    const additive = { vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false } as const;
    const lines = new THREE.LineSegments(this.lineGeo, new THREE.LineBasicMaterial(additive));
    this.pointsMat = new THREE.PointsMaterial({ ...additive, size: 3 * pixelRatio, sizeAttenuation: false, map: dotTexture() });
    const points = new THREE.Points(this.pointGeo, this.pointsMat);
    lines.frustumCulled = false;
    points.frustumCulled = false;
    lines.renderOrder = 11;
    points.renderOrder = 11;
    this.group.add(lines, points);
  }

  setPixelRatio(pr: number) {
    this.pointsMat.size = 3 * pr;
  }

  emit(origin: THREE.Vector3, count: number) {
    for (let k = 0; k < count; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.n;
      const speed = 70 + Math.random() * 190;
      let dx = -1;
      let dy = 0.15 + (Math.random() - 0.3) * 0.9;
      let dz = (Math.random() - 0.5) * 0.9;
      const l = Math.hypot(dx, dy, dz);
      dx /= l;
      dy /= l;
      dz /= l;
      this.pos.set([origin.x, origin.y, origin.z], i * 3);
      this.vel.set([dx * speed, dy * speed, dz * speed], i * 3);
      this.max[i] = 0.12 + Math.random() * 0.3;
      this.life[i] = this.max[i];
      this.heat[i] = 0.6 + Math.random() * 0.8;
    }
  }

  get active() {
    for (let i = 0; i < this.n; i++) if (this.life[i] > 0) return true;
    return false;
  }

  update(dt: number) {
    const g = -420;
    const drag = Math.exp(-dt * 3.5);
    for (let i = 0; i < this.n; i++) {
      const o = i * 3;
      if (this.life[i] <= 0) {
        this.lineCol.fill(0, i * 6, i * 6 + 6);
        this.pointCol.fill(0, o, o + 3);
        continue;
      }
      this.life[i] -= dt;
      this.vel[o] *= drag;
      this.vel[o + 1] = this.vel[o + 1] * drag + g * dt;
      this.vel[o + 2] *= drag;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      const t = Math.max(0, this.life[i] / this.max[i]);
      const e = t * t * this.heat[i];
      const tail = 0.03;
      this.linePos.set(
        [
          this.pos[o],
          this.pos[o + 1],
          this.pos[o + 2],
          this.pos[o] - this.vel[o] * tail,
          this.pos[o + 1] - this.vel[o + 1] * tail,
          this.pos[o + 2] - this.vel[o + 2] * tail,
        ],
        i * 6,
      );
      this.lineCol.set([5 * e, 2.6 * e, 0.8 * e, 0, 0, 0], i * 6);
      this.pointCol.set([6 * e, 3.4 * e, 1.3 * e], o);
    }
    (this.lineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.lineGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    (this.pointGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.pointGeo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}

// ── Grano de película (tras el tone mapping) ─────────────────────────────
export const GrainShader = {
  name: "AscuaGrain",
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0.035 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    varying vec2 vUv;
    float h(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float g = h(gl_FragCoord.xy + fract(uTime) * 97.0) - 0.5;
      c.rgb += g * uAmount;
      gl_FragColor = c;
    }
  `,
};

// ── Rótulo gigante detrás del producto (se refleja en el suelo) ───────────
export async function makeWordmark(fontFamily: string, mobile: boolean) {
  const family = fontFamily || "Georgia, serif";
  try {
    await document.fonts.load(`400 120px ${family}`);
  } catch {
    // Si la fuente no carga, el canvas usa la de reserva.
  }
  const W = mobile ? 1536 : 2560;
  const H = Math.round(W * 0.3);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const size = H * 0.96;
  ctx.font = `400 ${size}px ${family}`;
  const g = ctx.createLinearGradient(0, H * 0.1, 0, H);
  g.addColorStop(0, "rgba(255,236,214,1)");
  g.addColorStop(0.7, "rgba(255,226,196,0.75)");
  g.addColorStop(1, "rgba(255,210,170,0.25)");
  ctx.fillStyle = g;
  // Espaciado manual (letterSpacing no está en todos los navegadores).
  const text = "ASCUA";
  const spacing = size * 0.04;
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = W / 2 - total / 2;
  ctx.textAlign = "left";
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, H * 0.86);
    x += widths[i] + spacing;
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    color: new THREE.Color(0, 0, 0),
  });
  const width = 330;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (H / W)), mat);
  mesh.position.set(6, 50, -150);
  mesh.renderOrder = -1;
  return mesh;
}

// ── Brasas: motas cálidas que suben despacio (todo en GPU) ────────────────
export class Embers {
  readonly points: THREE.Points;
  private uniforms = {
    uTime: { value: 0 },
    uAmount: { value: 0 },
    uPx: { value: 800 },
  };

  constructor(count: number) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = -120 + Math.random() * 250;
      pos[i * 3 + 1] = Math.random() * 170;
      pos[i * 3 + 2] = -130 + Math.random() * 200;
      seed[i * 4] = 4 + Math.random() * 11; // velocidad de subida (mm/s)
      seed[i * 4 + 1] = Math.random() * Math.PI * 2; // fase
      seed[i * 4 + 2] = 0.35 + Math.random() * 0.8; // tamaño (mm)
      seed[i * 4 + 3] = 0.4 + Math.random() * 0.6; // brillo
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 seed;
        uniform float uTime;
        uniform float uPx;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          float h = 170.0;
          p.y = mod(position.y + uTime * seed.x, h);
          p.x += sin(uTime * 0.5 + seed.y) * 5.0 + sin(uTime * 1.3 + seed.y * 2.0) * 1.5;
          p.z += cos(uTime * 0.4 + seed.y) * 4.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.0, seed.z * uPx / -mv.z);
          float edge = smoothstep(0.0, 25.0, p.y) * (1.0 - smoothstep(h - 45.0, h, p.y));
          float twinkle = 0.65 + 0.35 * sin(uTime * (1.5 + seed.w * 2.0) + seed.y * 5.0);
          vAlpha = edge * twinkle * seed.w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uAmount;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(1.0, 0.5, 0.16) * 2.2 * a * vAlpha * uAmount, 1.0);
        }
      `,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 12;
  }

  update(time: number, amount: number, camera: THREE.PerspectiveCamera, bufferHeight: number) {
    this.uniforms.uTime.value = time;
    this.uniforms.uAmount.value = amount;
    this.uniforms.uPx.value = bufferHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));
    this.points.visible = amount > 0.005;
  }
}
