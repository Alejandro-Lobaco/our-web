/**
 * Guion de cámara. `at` es la posición en la línea de tiempo del scroll:
 * parte entera = índice de sección, decimal = avance dentro de ella.
 *
 * 0 Hero · 1 Apertura · 2 Despiece · 3 Órbita · 4 Detalle · 5 Encender · 6 Cierre
 */
export interface Cue {
  at: number;
  /** Punto al que mira la cámara (mm). */
  target: [number, number, number];
  /** Alto a encuadrar (mm). */
  size: number;
  /** Ancho mínimo a encuadrar (mm); manda en pantallas verticales. */
  width: number;
  az: number;
  el: number;
  lid: number;
  explode: number;
  idle: number;
  timeScale: number;
  /** Desplazamiento del producto en pantalla (fracción del viewport), escritorio. */
  sx: number;
  sy: number;
  /** Ídem en móvil. */
  msx: number;
  msy: number;
}

type CueInput = Partial<Cue> & { at: number };

const RAW: CueInput[] = [
  // 0 · Hero: pequeño, mucho negro alrededor
  { at: 0.0, target: [0, 29, 0], size: 124, width: 84, az: 24, el: 7, lid: 0, explode: 0, idle: 1, timeScale: 1, sx: 0.17, sy: 0.02, msx: 0, msy: -0.13 },
  { at: 0.55, size: 112, az: 20 },
  // 1 · Apertura
  { at: 1.0, target: [3, 33, 0], size: 100, width: 84, az: 12, el: 11, idle: 0.2, sx: 0.17, msy: -0.14 },
  { at: 1.3, target: [9, 38, 0], size: 94, width: 100, az: 4, el: 14, lid: 0, idle: 0 },
  { at: 1.62, target: [17, 40, 0], size: 104, width: 118, az: -8, el: 16, lid: 1, sx: 0.14, msy: -0.12 },
  { at: 1.95, target: [17, 39, 0], size: 110, width: 122, az: -14, el: 14 },
  // 2 · Despiece
  { at: 2.08, target: [4, 50, 0], size: 124, width: 104, az: -6, el: 10, lid: 1, explode: 0, sx: 0.12, sy: 0.02, msy: -0.03 },
  { at: 2.45, target: [4, 66, 0], size: 158, width: 118, az: 10, el: 7, explode: 1 },
  { at: 2.88, target: [4, 66, 0], size: 158, width: 118, az: 20, el: 8, explode: 1 },
  // 3 · Órbita (remontaje al entrar)
  { at: 3.08, target: [10, 38, 0], size: 112, width: 118, az: 36, el: 12, explode: 0, sx: -0.2, sy: 0, msy: -0.12 },
  { at: 3.92, target: [10, 38, 0], size: 108, width: 114, az: 396, el: 18 },
  // 4 · Detalle: macro de rueda y chimenea, cámara lenta
  { at: 4.1, target: [1.5, 50, 0], size: 40, width: 46, az: 398, el: 40, sx: 0.16, sy: -0.02, msy: -0.1, timeScale: 0.32 },
  { at: 4.55, target: [3.2, 51, 0], size: 27, width: 32, az: 408, el: 38, timeScale: 0.28 },
  { at: 4.92, target: [2, 50, 0], size: 44, width: 50, az: 392, el: 30, timeScale: 0.6 },
  // 5 · Encender
  { at: 5.1, target: [10, 47, 0], size: 100, width: 110, az: 372, el: 10, sx: 0.17, sy: 0.0, msy: -0.1, timeScale: 1 },
  { at: 5.9, target: [10, 49, 0], size: 96, width: 106, az: 366, el: 9 },
  // 6 · Cierre: vuelve al hero
  { at: 6.12, target: [0, 29, 0], size: 120, width: 84, az: 384, el: 7, lid: 0, idle: 1, sx: -0.19, sy: 0.02, msy: -0.14 },
  { at: 7.0, size: 116, az: 380 },
];

export const CUES: Cue[] = (() => {
  const out: Cue[] = [];
  let prev = RAW[0] as Cue;
  for (const c of RAW) {
    prev = { ...prev, ...c } as Cue;
    out.push(prev);
  }
  return out;
})();

/** Momentos del guion que disparan eventos (chispas en el detalle). */
export const BEATS = { sparks: 4.42 };

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function sampleCues(t: number, out: Cue): Cue {
  const cues = CUES;
  let i = 0;
  while (i < cues.length - 1 && cues[i + 1].at <= t) i++;
  const a = cues[i];
  const b = cues[Math.min(i + 1, cues.length - 1)];
  const k = b.at > a.at ? smooth(Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at)))) : 0;
  out.at = t;
  out.target = [lerp(a.target[0], b.target[0], k), lerp(a.target[1], b.target[1], k), lerp(a.target[2], b.target[2], k)];
  for (const key of ["size", "width", "az", "el", "lid", "explode", "idle", "timeScale", "sx", "sy", "msx", "msy"] as const) {
    out[key] = lerp(a[key], b[key], k);
  }
  return out;
}
