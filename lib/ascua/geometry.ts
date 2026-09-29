import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Contorno cerrado en planta (x, z) con normales exteriores y longitud de arco. */
export interface Contour {
  p: THREE.Vector2[];
  n: THREE.Vector2[];
  s: number[];
  length: number;
}

/**
 * Rectángulo redondeado en planta. Empieza en el extremo izquierdo del frente
 * (+z) y avanza hacia +x, así la cara frontal ocupa u ∈ [0, w − 2r].
 */
export function roundedRectContour(w: number, d: number, r: number, seg = 12): Contour {
  const hx = w / 2 - r;
  const hz = d / 2 - r;
  const corners: [number, number, number][] = [
    [hx, hz, Math.PI / 2],
    [hx, -hz, 0],
    [-hx, -hz, -Math.PI / 2],
    [-hx, hz, -Math.PI],
  ];
  const p = [new THREE.Vector2(-hx, d / 2)];
  const n = [new THREE.Vector2(0, 1)];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 - (i / seg) * (Math.PI / 2);
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      p.push(new THREE.Vector2(cx + r * nx, cz + r * nz));
      n.push(new THREE.Vector2(nx, nz));
    }
  }
  const s = [0];
  for (let i = 1; i < p.length; i++) s.push(s[i - 1] + p[i].distanceTo(p[i - 1]));
  return { p, n, s, length: s[s.length - 1] };
}

/** Punto de perfil: d = distancia hacia dentro desde el contorno, y = altura, m = material del tramo que empieza aquí. */
export interface ProfilePoint {
  d: number;
  y: number;
  m: number;
}

export interface CapSpec {
  d: number;
  y: number;
  up: boolean;
  m: number;
}

interface Bucket {
  pos: number[];
  nor: number[];
  uv: number[];
  idx: number[];
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();

function orientation(pos: number[], i0: number, i1: number, i2: number, nx: number, ny: number, nz: number) {
  _a.fromArray(pos, i0 * 3);
  _b.fromArray(pos, i1 * 3).sub(_a);
  _c.fromArray(pos, i2 * 3).sub(_a);
  _b.cross(_c);
  return _b.x * nx + _b.y * ny + _b.z * nz;
}

/**
 * Barre un perfil 2D a lo largo de un contorno redondeado: un "torno" para
 * piezas de planta rectangular. Normales analíticas: esquinas suaves y aristas
 * vivas entre tramos. Cada tramo lleva su propio material (cara o bisel).
 */
export function sweepContour(
  c: Contour,
  profile: ProfilePoint[],
  caps: CapSpec[],
  opts: { vScale: number; materials: number },
): THREE.BufferGeometry {
  const buckets: Bucket[] = Array.from({ length: opts.materials }, () => ({ pos: [], nor: [], uv: [], idx: [] }));
  const N = c.p.length;

  for (let k = 0; k < profile.length - 1; k++) {
    const A = profile[k];
    const B = profile[k + 1];
    const tOut = -(B.d - A.d);
    const tUp = B.y - A.y;
    const len = Math.hypot(tOut, tUp);
    if (len < 1e-6) continue;
    const nOut = tUp / len;
    const nUp = -tOut / len;
    const b = buckets[A.m];
    const base = b.pos.length / 3;
    for (let i = 0; i < N; i++) {
      const p = c.p[i];
      const n = c.n[i];
      for (const P of [A, B]) {
        b.pos.push(p.x - P.d * n.x, P.y, p.y - P.d * n.y);
        const nx = nOut * n.x;
        const nz = nOut * n.y;
        const l = Math.hypot(nx, nUp, nz) || 1;
        b.nor.push(nx / l, nUp / l, nz / l);
        b.uv.push(c.s[i] / c.length, P.y * opts.vScale);
      }
    }
    // Sentido de giro: se decide con el primer quad no degenerado (tramo frontal recto).
    let flip = false;
    for (let i = 0; i < N - 1; i++) {
      const a = base + i * 2;
      const o = orientation(b.pos, a, a + 2, a + 1, b.nor[a * 3], b.nor[a * 3 + 1], b.nor[a * 3 + 2]);
      if (Math.abs(o) > 1e-8) {
        flip = o < 0;
        break;
      }
    }
    for (let i = 0; i < N - 1; i++) {
      const a = base + i * 2;
      const bb = a + 1;
      const c2 = a + 2;
      const d2 = a + 3;
      if (flip) b.idx.push(a, bb, c2, c2, bb, d2);
      else b.idx.push(a, c2, bb, c2, d2, bb);
    }
  }

  for (const cap of caps) {
    const b = buckets[cap.m];
    const base = b.pos.length / 3;
    const ny = cap.up ? 1 : -1;
    b.pos.push(0, cap.y, 0);
    b.nor.push(0, ny, 0);
    b.uv.push(0.75, 0.5);
    for (let i = 0; i < N; i++) {
      const p = c.p[i];
      const n = c.n[i];
      const x = p.x - cap.d * n.x;
      const z = p.y - cap.d * n.y;
      b.pos.push(x, cap.y, z);
      b.nor.push(0, ny, 0);
      b.uv.push(0.75 + x / (2 * c.length), 0.5 + z * opts.vScale);
    }
    const flip = orientation(b.pos, base, base + 1, base + 2, 0, ny, 0) < 0;
    for (let i = 0; i < N - 1; i++) {
      const i1 = base + 1 + i;
      const i2 = i1 + 1;
      if (flip) b.idx.push(base, i2, i1);
      else b.idx.push(base, i1, i2);
    }
  }

  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const geo = new THREE.BufferGeometry();
  let offset = 0;
  buckets.forEach((b, m) => {
    const start = idx.length;
    for (const i of b.idx) idx.push(i + offset);
    for (const v of b.pos) pos.push(v);
    for (const v of b.nor) nor.push(v);
    for (const v of b.uv) uv.push(v);
    if (b.idx.length) geo.addGroup(start, b.idx.length, m);
    offset += b.pos.length / 3;
  });
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

/** Invierte el orden de los triángulos (tras un espejo). */
export function flipWinding(geo: THREE.BufferGeometry) {
  const index = geo.getIndex();
  if (!index) return geo;
  const a = index.array as Uint16Array | Uint32Array;
  for (let i = 0; i < a.length; i += 3) {
    const t = a[i + 1];
    a[i + 1] = a[i + 2];
    a[i + 2] = t;
  }
  index.needsUpdate = true;
  return geo;
}

/**
 * Extrusión con chaflán exacto: el contorno exterior mide lo que dice la forma.
 * Grupo 0 = caras planas, grupo 1 = cantos y chaflán.
 */
export function extrudeChamfered(shape: THREE.Shape, depth: number, chamfer: number, curveSegments = 24) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - 2 * chamfer),
    bevelEnabled: chamfer > 0,
    bevelThickness: chamfer,
    bevelSize: chamfer,
    bevelOffset: -chamfer,
    bevelSegments: 1,
    curveSegments,
  });
  geo.translate(0, 0, chamfer);
  return toCreasedNormals(geo, (32 * Math.PI) / 180);
}

/** Pieza de torno (eje y). Perfil en sentido antihorario: abajo → fuera → arriba. */
export function latheCreased(points: [number, number][], segments = 40, crease = 35) {
  const geo = new THREE.LatheGeometry(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    segments,
  );
  return toCreasedNormals(geo, (crease * Math.PI) / 180);
}

/** Cilindro con chaflán en ambos extremos, sobre el eje y, de y0 a y1. */
export function chamferedCylinder(r: number, y0: number, y1: number, c: number, segments = 40) {
  return latheCreased(
    [
      [0, y0],
      [r - c, y0],
      [r, y0 + c],
      [r, y1 - c],
      [r - c, y1],
      [0, y1],
    ],
    segments,
  );
}

/** Rueda estriada: dientes trapezoidales, extruida en z y centrada. */
export function gearShape(teeth: number, rOut: number, rIn: number) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let k = 0; k < teeth; k++) {
    const a = k * step;
    const pts: [number, number][] = [
      [a - step * 0.16, rOut],
      [a + step * 0.16, rOut],
      [a + step * 0.38, rIn],
      [a + step * 0.62, rIn],
    ];
    pts.forEach(([ang, r], i) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (k === 0 && i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  return shape;
}

/** Muelle helicoidal a lo largo del eje y. */
export class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(
    private r: number,
    private y0: number,
    private y1: number,
    private turns: number,
  ) {
    super();
  }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.r, this.y0 + t * (this.y1 - this.y0), Math.sin(a) * this.r);
  }
}
