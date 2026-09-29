/**
 * Medidas reales de ASCUA en milímetros. Una unidad de escena = 1 mm.
 * Origen: centro de la base de la carcasa, apoyada en el suelo (y = 0).
 * Frente = +z, bisagra a la derecha (+x).
 */
export const SPEC = {
  W: 38,
  D: 13,
  R: 2.6,
  wall: 0.9,
  caseH: 36.5,
  lidH: 20.5,
  seam: 0.25,
  chamfer: 0.6,
  rimChamfer: 0.3,

  insert: { W: 35.6, D: 11.0, R: 1.7, y0: 1.0, y1: 37.0 },

  chimney: { x0: -17.4, x1: 7.2, top: 53.2, t: 0.5, z: 5.5 },

  wheel: { x: 4.2, y: 50.8, r: 3.4, rIn: 3.02, width: 4.2, teeth: 36, ear: 3.0 },
  flint: { r: 1.2, y0: 42.6, y1: 47.4 },
  tube: { rIn: 1.3, rOut: 1.75, y1: 45.8 },
  spring: { r: 0.95, wire: 0.22, turns: 11, y0: 27.8, y1: 42.4 },
  wick: { x: -2.8, r: 1.5, y1: 44.2 },
  cam: { x0: 10.0, x1: 16.6, top: 46.6, t: 3.4 },

  hinge: { x: 19.0, y: 36.62, r: 1.3 },
  lidOpen: (-125 * Math.PI) / 180,
} as const;

export const LID_Y0 = SPEC.caseH + SPEC.seam;
