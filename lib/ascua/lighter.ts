import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  chamferedCylinder,
  extrudeChamfered,
  flipWinding,
  gearShape,
  Helix,
  latheCreased,
  roundedRectContour,
  sweepContour,
  type ProfilePoint,
} from "./geometry";
import { LABELS, type PieceId } from "./labels-data";
import { makeMaterials, type Materials } from "./materials";
import { LID_Y0, SPEC } from "./spec";

export type { PieceId };

export interface Piece {
  id: PieceId;
  group: THREE.Group;
  /** Desplazamiento en el despiece (mm). */
  offset: THREE.Vector3;
  /** Orden de salida: las piezas de arriba salen primero y vuelven últimas. */
  order: number;
}

export interface Label {
  piece: PieceId;
  title: string;
  spec: string;
  anchor: THREE.Vector3;
}

export interface LighterRig {
  root: THREE.Group;
  pieces: Record<PieceId, Piece>;
  lidHinge: THREE.Group;
  wheelSpin: THREE.Group;
  flameAnchor: THREE.Group;
  sparkAnchor: THREE.Group;
  sparkOrigin: THREE.Vector3;
  labels: Label[];
  materials: Materials;
  meshes: THREE.Mesh[];
}

/** Punto de anclaje de cada etiqueta, en el orden de LABELS. */
const ANCHORS: [number, number, number][] = [
  [-SPEC.W / 2, LID_Y0 + 11, 0],
  [SPEC.wheel.x + SPEC.wheel.r, SPEC.wheel.y, 0],
  [SPEC.wick.x - SPEC.wick.r, 41.5, 0],
  [SPEC.wheel.x + SPEC.flint.r, 45, 0],
  [SPEC.chimney.x0, 48, SPEC.chimney.z],
  [SPEC.wheel.x + SPEC.spring.r + 0.3, 33, 0],
  [SPEC.insert.W / 2, 20, 0],
  [-SPEC.W / 2, 17, SPEC.D / 2 - 1],
];

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], list: THREE.Mesh[]) {
  // Un array de materiales solo pinta los grupos: sin grupos, material único.
  const m = new THREE.Mesh(geo, Array.isArray(mat) && (mat.length === 1 || geo.groups.length === 0) ? mat[0] : mat);
  list.push(m);
  return m;
}

/** Carcasa y tapa comparten perfil de "vaso": la tapa es el vaso volteado. */
function cupProfile(H: number): ProfilePoint[] {
  const { chamfer: c, rimChamfer: t, wall } = SPEC;
  return [
    { d: c, y: 0, m: 1 },
    { d: 0, y: c, m: 0 },
    { d: 0, y: H - t, m: 1 },
    { d: t, y: H, m: 0 },
    { d: wall - t, y: H, m: 1 },
    { d: wall, y: H - t, m: 2 },
    { d: wall, y: wall, m: 2 },
  ];
}

function chimneyPlateShape() {
  const { x0, x1, top } = SPEC.chimney;
  const { x: wx, y: wy, ear } = SPEC.wheel;
  const y0 = SPEC.insert.y1;
  const s = new THREE.Shape();
  const endAngle = Math.asin((top - wy) / ear);
  s.moveTo(x0, y0);
  s.lineTo(x1, y0);
  s.lineTo(x1, wy);
  s.absarc(wx, wy, ear, 0, Math.PI - endAngle, false);
  s.lineTo(x0 + 1, top);
  s.quadraticCurveTo(x0, top, x0, top - 1);
  s.closePath();
  // 2 filas × 4 respiraderos por cara = 16 en total
  for (const y of [40.4, 44.2]) {
    for (const x of [-14.2, -10.6, -7.0, -3.4]) {
      const h = new THREE.Path();
      h.absarc(x, y, 1.2, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
  }
  return s;
}

function camShape() {
  const { x0, x1, top } = SPEC.cam;
  const y0 = SPEC.insert.y1;
  const s = new THREE.Shape();
  s.moveTo(x0, y0);
  s.lineTo(x1, y0);
  s.lineTo(x1, top - 3.2);
  s.quadraticCurveTo(x1 - 0.6, top, x1 - 3.4, top);
  s.quadraticCurveTo(x0 + 0.4, top - 0.4, x0, top - 2.2);
  s.closePath();
  return s;
}

export function buildLighter(opts: { mobile: boolean }): LighterRig {
  const meshes: THREE.Mesh[] = [];
  const outer = roundedRectContour(SPEC.W, SPEC.D, SPEC.R, opts.mobile ? 10 : 14);
  const mats = makeMaterials({ mobile: opts.mobile, perimeter: outer.length });

  const root = new THREE.Group();
  const mk = (id: PieceId, offset: [number, number, number], order: number): Piece => {
    const group = new THREE.Group();
    group.name = id;
    root.add(group);
    return { id, group, offset: new THREE.Vector3(...offset), order };
  };

  const pieces: Record<PieceId, Piece> = {
    carcasa: mk("carcasa", [0, 0, 0], 4),
    inserto: mk("inserto", [0, 38, 0], 3),
    muelle: mk("muelle", [18, 34, 0], 2.5),
    piedra: mk("piedra", [18, 42, 0], 2),
    mecha: mk("mecha", [-6, 58, 0], 1.4),
    rueda: mk("rueda", [5, 48, 0], 1),
    tapa: mk("tapa", [0, 72, 0], 0),
  };

  // ── Carcasa ──────────────────────────────────────────────
  const caseGeo = sweepContour(
    outer,
    cupProfile(SPEC.caseH),
    [
      { d: SPEC.chamfer, y: 0, up: false, m: 0 },
      { d: SPEC.wall, y: SPEC.wall, up: true, m: 2 },
    ],
    { vScale: 1 / SPEC.caseH, materials: 3 },
  );
  pieces.carcasa.group.add(mesh(caseGeo, [mats.body, mats.chamfer, mats.interior], meshes));

  // Bisagra: dos nudillos en la carcasa, uno en la tapa (eje z, esquina superior derecha).
  const { hinge } = SPEC;
  const knuckle = (z0: number, z1: number) => {
    const g = chamferedCylinder(hinge.r, z0, z1, 0.25, 28);
    g.rotateX(Math.PI / 2);
    g.translate(hinge.x, hinge.y, 0);
    return g;
  };
  for (const [z0, z1] of [
    [-6.3, -2.3],
    [2.3, 6.3],
  ]) {
    pieces.carcasa.group.add(mesh(knuckle(-z1, -z0), mats.hinge, meshes));
  }

  // ── Tapa (bisagra como pivote) ───────────────────────────
  const lidHinge = new THREE.Group();
  lidHinge.position.set(hinge.x, hinge.y, 0);
  pieces.tapa.group.add(lidHinge);
  const lidGeo = sweepContour(
    outer,
    cupProfile(SPEC.lidH),
    [
      { d: SPEC.chamfer, y: 0, up: false, m: 0 },
      { d: SPEC.wall, y: SPEC.wall, up: true, m: 2 },
    ],
    { vScale: 1 / SPEC.lidH, materials: 3 },
  );
  lidGeo.scale(1, -1, 1);
  flipWinding(lidGeo);
  lidGeo.translate(-hinge.x, LID_Y0 + SPEC.lidH - hinge.y, 0);
  lidHinge.add(mesh(lidGeo, [mats.lid, mats.chamfer, mats.interior], meshes));
  const lidKnuckle = chamferedCylinder(hinge.r, -2.1, 2.1, 0.25, 28);
  lidKnuckle.rotateX(Math.PI / 2);
  lidHinge.add(mesh(lidKnuckle, mats.hinge, meshes));

  // ── Inserto ──────────────────────────────────────────────
  const ins = SPEC.insert;
  const insContour = roundedRectContour(ins.W, ins.D, ins.R, 10);
  const ic = 0.35;
  const insertGeo = sweepContour(
    insContour,
    [
      { d: ic, y: ins.y0, m: 1 },
      { d: 0, y: ins.y0 + ic, m: 0 },
      { d: 0, y: ins.y1 - ic, m: 1 },
      { d: ic, y: ins.y1, m: 0 },
    ],
    [
      { d: ic, y: ins.y0, up: false, m: 0 },
      { d: ic, y: ins.y1, up: true, m: 0 },
    ],
    { vScale: 1 / 12, materials: 2 },
  );
  const insG = pieces.inserto.group;
  insG.add(mesh(insertGeo, [mats.insert, mats.insertEdge], meshes));

  // Chimenea: placas delantera y trasera perforadas + lateral izquierdo.
  const { chimney } = SPEC;
  const plateGeo = extrudeChamfered(chimneyPlateShape(), chimney.t, 0.12, 20);
  const front = mesh(plateGeo, [mats.plate, mats.chamfer], meshes);
  front.position.z = chimney.z - chimney.t;
  const back = mesh(plateGeo, [mats.plate, mats.chamfer], meshes);
  back.position.z = -chimney.z;
  insG.add(front, back);
  const sideH = chimney.top - ins.y1 - 0.5;
  const side = mesh(new RoundedBoxGeometry(chimney.t, sideH, chimney.z * 2, 2, 0.12), [mats.plate], meshes);
  side.position.set(chimney.x0 + chimney.t / 2, ins.y1 + sideH / 2, 0);
  insG.add(side);

  // Leva de cierre con su remache.
  const camGeo = extrudeChamfered(camShape(), SPEC.cam.t, 0.2, 16);
  const cam = mesh(camGeo, [mats.plate, mats.chamfer], meshes);
  cam.position.z = -SPEC.cam.t / 2;
  insG.add(cam);
  const camRivet = chamferedCylinder(0.9, -SPEC.cam.t / 2 - 0.35, SPEC.cam.t / 2 + 0.35, 0.3, 20);
  camRivet.rotateX(Math.PI / 2);
  camRivet.translate(12.6, 41.8, 0);
  insG.add(mesh(camRivet, [mats.steel], meshes));

  // Tubo de la piedra.
  const { tube, wheel, flint } = SPEC;
  const tubeGeo = latheCreased(
    [
      [tube.rIn, ins.y1],
      [tube.rOut, ins.y1],
      [tube.rOut, tube.y1 - 0.2],
      [tube.rOut - 0.2, tube.y1],
      [tube.rIn, tube.y1],
      [tube.rIn, ins.y1],
    ],
    32,
  );
  tubeGeo.translate(wheel.x, 0, 0);
  insG.add(mesh(tubeGeo, [mats.insertEdge], meshes));

  // ── Rueda ────────────────────────────────────────────────
  const wheelSpin = new THREE.Group();
  wheelSpin.position.set(wheel.x, wheel.y, 0);
  pieces.rueda.group.add(wheelSpin);
  const gear = new THREE.ExtrudeGeometry(gearShape(wheel.teeth, wheel.r, wheel.rIn), {
    depth: wheel.width - 0.3,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.12,
    bevelOffset: -0.12,
    bevelSegments: 1,
  });
  gear.translate(0, 0, -(wheel.width - 0.3) / 2);
  wheelSpin.add(mesh(gear, [mats.steel, mats.steel], meshes));
  const axle = chamferedCylinder(0.8, -chimney.z - 0.1, chimney.z + 0.1, 0.1, 20);
  axle.rotateX(Math.PI / 2);
  axle.translate(wheel.x, wheel.y, 0);
  pieces.rueda.group.add(mesh(axle, [mats.steel], meshes));
  for (const sgn of [1, -1]) {
    const dome = latheCreased(
      [
        [0, 0],
        [1.25, 0],
        [1.2, 0.25],
        [0.9, 0.55],
        [0.45, 0.72],
        [0, 0.76],
      ],
      28,
      60,
    );
    dome.rotateX((sgn * Math.PI) / 2);
    dome.translate(wheel.x, wheel.y, sgn * chimney.z);
    pieces.rueda.group.add(mesh(dome, [mats.steel], meshes));
  }

  // ── Piedra y muelle ─────────────────────────────────────
  const flintGeo = latheCreased(
    [
      [0, flint.y0],
      [flint.r, flint.y0],
      [flint.r, flint.y1 - 0.25],
      [flint.r - 0.3, flint.y1],
      [0, flint.y1],
    ],
    24,
  );
  flintGeo.translate(wheel.x, 0, 0);
  pieces.piedra.group.add(mesh(flintGeo, [mats.flint], meshes));

  const { spring } = SPEC;
  const springGeo = new THREE.TubeGeometry(
    new Helix(spring.r, spring.y0, spring.y1, spring.turns),
    spring.turns * (opts.mobile ? 16 : 28),
    spring.wire,
    8,
    false,
  );
  springGeo.translate(wheel.x, 0, 0);
  pieces.muelle.group.add(mesh(springGeo, [mats.steel], meshes));

  // ── Mecha ────────────────────────────────────────────────
  const { wick } = SPEC;
  const wy0 = ins.y1 - 0.2;
  const wickGeo = latheCreased(
    [
      [0, wy0],
      [wick.r, wy0],
      [wick.r, wick.y1 - 0.9],
      [wick.r * 0.82, wick.y1 - 0.2],
      [wick.r * 0.4, wick.y1],
      [0, wick.y1],
    ],
    24,
    50,
  );
  // v proporcional a la altura para que la trenza no se estire.
  const wp = wickGeo.getAttribute("position");
  const wuv = wickGeo.getAttribute("uv");
  for (let i = 0; i < wp.count; i++) wuv.setY(i, (wp.getY(i) - wy0) / (wick.y1 - wy0));
  wickGeo.translate(wick.x, 0, 0);
  pieces.mecha.group.add(mesh(wickGeo, [mats.wick], meshes));

  const flameAnchor = new THREE.Group();
  flameAnchor.position.set(wick.x, wick.y1 - 0.4, 0);
  pieces.mecha.group.add(flameAnchor);

  const sparkAnchor = new THREE.Group();
  insG.add(sparkAnchor);
  const sparkOrigin = new THREE.Vector3(wheel.x - 1.2, wheel.y - wheel.r + 0.5, 0);

  const labels: Label[] = LABELS.map((l, i) => ({ ...l, anchor: new THREE.Vector3(...ANCHORS[i]) }));

  return { root, pieces, lidHinge, wheelSpin, flameAnchor, sparkAnchor, sparkOrigin, labels, materials: mats, meshes };
}
