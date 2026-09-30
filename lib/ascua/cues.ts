/**
 * Guion de cámara. `at` es la posición en la línea de tiempo del scroll:
 * parte entera = índice de sección, decimal = avance dentro de ella.
 *
 * 0 Hero · 1 Despiece · 2 Material · 3 Detalle · 4 Encender · 5 Acabados
 *
 * Regla de ritmo: cada acto se asienta hacia el 20 % de su sección, aguanta
 * mientras se lee el texto y sale a partir del ~60 %. Ninguna transición
 * ocupa menos de ~1,5 pantallas de scroll.
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
  /** Rótulo gigante detrás del producto (0–1). */
  mark: number;
  /** Brasas flotando en el aire (0–1). */
  embers: number;
  /** Desplazamiento del producto en pantalla (fracción del viewport), escritorio. */
  sx: number;
  sy: number;
  /** Ídem en móvil. */
  msx: number;
  msy: number;
}

type CueInput = Partial<Cue> & { at: number };

const RAW: CueInput[] = [
  // 0 · Hero: abierto y encendido, rótulo detrás
  { at: 0.0, target: [7, 36, 0], size: 116, width: 96, az: 20, el: 8, lid: 1, explode: 0, idle: 1, timeScale: 1, mark: 1, embers: 1, sx: 0.16, sy: 0.02, msx: 0, msy: -0.18 },
  { at: 0.35, size: 110, az: 16 },
  // 1 · Despiece (se abre entre el final del hero y el 22 % del acto)
  { at: 1.22, target: [4, 64, 0], size: 160, width: 120, az: 6, el: 7, explode: 1, idle: 0, mark: 0, embers: 0.35, sx: 0.12, sy: 0.02, msy: 0.05 },
  { at: 1.62, az: 20, el: 8 },
  // 2 · Material: remontaje y media órbita lenta
  { at: 2.2, target: [10, 38, 0], size: 112, width: 118, az: 40, el: 12, explode: 0, embers: 0.3, sx: -0.2, sy: 0, msy: -0.12 },
  { at: 2.7, size: 108, width: 114, az: 220, el: 16 },
  // 3 · Detalle: la órbita sigue hasta la macro de la rueda, cámara lenta
  { at: 3.22, target: [1.5, 50, 0], size: 40, width: 46, az: 398, el: 40, sx: 0.16, sy: -0.02, msy: -0.1, timeScale: 0.32 },
  { at: 3.45, target: [3.2, 51, 0], size: 27, width: 32, az: 408, el: 38, timeScale: 0.28 },
  { at: 3.6, size: 30, width: 35, az: 404, el: 36, timeScale: 0.3 },
  // 4 · Encender
  { at: 4.22, target: [10, 47, 0], size: 100, width: 110, az: 372, el: 10, sx: 0.17, sy: 0, msy: -0.1, timeScale: 1, embers: 0.6 },
  { at: 4.62, target: [10, 49, 0], size: 96, width: 106, az: 366, el: 9 },
  // 5 · Acabados: la tapa se cierra y vuelve el plano de hero
  { at: 5.0, target: [5, 38, 0], size: 106, width: 96, az: 376, el: 8, lid: 1, sx: -0.02, msy: -0.12 },
  { at: 5.22, target: [0, 29, 0], size: 118, width: 84, az: 384, el: 7, lid: 0, idle: 1, mark: 0.45, embers: 0.7, sx: -0.19, sy: 0.02, msy: -0.26 },
  { at: 6.0, size: 112, az: 380 },
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

/** Momentos del guion que disparan eventos. */
export const BEATS = {
  /** Chispas a cámara lenta en la macro. */
  sparks: 3.47,
  /** Por debajo de este punto el hero mantiene la llama viva. */
  heroLit: 0.5,
};

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const KEYS = ["size", "width", "az", "el", "lid", "explode", "idle", "timeScale", "mark", "embers", "sx", "sy", "msx", "msy"] as const;

export function sampleCues(t: number, out: Cue): Cue {
  const cues = CUES;
  let i = 0;
  while (i < cues.length - 1 && cues[i + 1].at <= t) i++;
  const a = cues[i];
  const b = cues[Math.min(i + 1, cues.length - 1)];
  const k = b.at > a.at ? smooth(Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at)))) : 0;
  out.at = t;
  out.target = [lerp(a.target[0], b.target[0], k), lerp(a.target[1], b.target[1], k), lerp(a.target[2], b.target[2], k)];
  for (const key of KEYS) out[key] = lerp(a[key], b[key], k);
  return out;
}
