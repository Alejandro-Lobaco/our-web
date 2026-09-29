import * as THREE from "three";
import { SPEC } from "./spec";

/**
 * Texturas generadas en código. La carcasa se "desenrolla": u recorre el
 * perímetro (empezando por el frente) y v la altura, a ~20 px/mm.
 */

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  return { c, ctx };
}

function blotches(ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number, count: number, strength: number, light: string, dark: string) {
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = (0.04 + r() * 0.18) * w;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const col = r() > 0.5 ? light : dark;
    g.addColorStop(0, col.replace("A", String(strength * (0.4 + r() * 0.6))));
    g.addColorStop(1, col.replace("A", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, r: () => number, amount: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function spacedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number) {
  const widths = [...text].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let x = cx - total / 2;
  [...text].forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
}

export interface FinishTextures {
  color: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
}

/** Acabado negro mate microgranallado, con grabado láser opcional en el frente. */
export function blackFinish(width: number, height: number, perimeter: number, engrave: boolean, seed: number): FinishTextures {
  const r = rand(seed);
  const pxmm = width / perimeter;

  const col = canvas(width, height);
  col.ctx.fillStyle = "#17171a";
  col.ctx.fillRect(0, 0, width, height);
  blotches(col.ctx, width, height, r, 60, 0.05, "rgba(60,60,66,A)", "rgba(0,0,0,A)");

  const rough = canvas(width, height);
  rough.ctx.fillStyle = "rgb(118,118,118)";
  rough.ctx.fillRect(0, 0, width, height);
  blotches(rough.ctx, width, height, r, 70, 0.12, "rgba(150,150,150,A)", "rgba(80,80,80,A)");
  grain(rough.ctx, width, height, r, 26);

  if (engrave) {
    const cx = (SPEC.W / 2 - SPEC.R) * pxmm;
    const hmm = height / pxmm;
    const yFromBottom = (mm: number) => height - (mm / hmm) * height;
    for (const [ctx, fill] of [
      [col.ctx, "#8d8f95"],
      [rough.ctx, "rgb(64,64,64)"],
    ] as const) {
      ctx.fillStyle = fill;
      ctx.textBaseline = "alphabetic";
      ctx.font = `500 ${Math.round(3.1 * pxmm)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      spacedText(ctx, "ASCUA", cx, yFromBottom(5.2), 1.3 * pxmm);
      ctx.font = `500 ${Math.round(1.05 * pxmm)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      spacedText(ctx, "ACERO 304 · DLC", cx, yFromBottom(3.0), 0.42 * pxmm);
      ctx.fillRect(cx - 6 * pxmm, yFromBottom(9.3), 12 * pxmm, Math.max(1, 0.12 * pxmm));
    }
  }

  const color = new THREE.CanvasTexture(col.c);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;
  const roughT = new THREE.CanvasTexture(rough.c);
  roughT.anisotropy = 8;
  return { color, rough: roughT };
}

/** Acero satinado con cepillado horizontal (inserto). */
export function brushedRough(width: number, height: number, seed: number) {
  const r = rand(seed);
  const { c, ctx } = canvas(width, height);
  ctx.fillStyle = "rgb(84,84,84)";
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 1400; i++) {
    const y = r() * height;
    const v = 60 + r() * 60;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.25 + r() * 0.4})`;
    ctx.fillRect(r() * width * -0.5, y, width * (0.4 + r()), 0.6 + r() * 1.2);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

/** Algodón trenzado con la punta chamuscada. */
export function wickTexture() {
  const W = 256;
  const H = 256;
  const r = rand(7);
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = "#cfc0a1";
  ctx.fillRect(0, 0, W, H);
  const rows = 22;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < 12; i++) {
      const x = (i / 12) * W;
      const y = (j / rows) * H;
      const dir = (i + j) % 2 === 0 ? 1 : -1;
      ctx.strokeStyle = `rgba(120,100,70,${0.35 + r() * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (W / 12) * dir * 0.8, y + H / rows);
      ctx.stroke();
    }
  }
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.3);
  g.addColorStop(0, "rgba(22,16,12,1)");
  g.addColorStop(0.55, "rgba(40,28,18,0.85)");
  g.addColorStop(1, "rgba(60,40,20,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H * 0.3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Punto suave para las cabezas de chispa. */
export function dotTexture() {
  const { c, ctx } = canvas(32, 32);
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

export interface Materials {
  body: THREE.MeshPhysicalMaterial;
  lid: THREE.MeshPhysicalMaterial;
  chamfer: THREE.MeshPhysicalMaterial;
  interior: THREE.MeshStandardMaterial;
  insert: THREE.MeshPhysicalMaterial;
  insertEdge: THREE.MeshPhysicalMaterial;
  plate: THREE.MeshPhysicalMaterial;
  steel: THREE.MeshPhysicalMaterial;
  flint: THREE.MeshStandardMaterial;
  wick: THREE.MeshStandardMaterial;
  all: THREE.Material[];
}

export function makeMaterials(opts: { mobile: boolean; perimeter: number }): Materials {
  const w = opts.mobile ? 1024 : 2048;
  const h = Math.round((w * SPEC.caseH) / opts.perimeter);
  const hLid = Math.round((w * SPEC.lidH) / opts.perimeter);
  const caseTex = blackFinish(w, h, opts.perimeter, true, 11);
  const lidTex = blackFinish(w, hLid, opts.perimeter, false, 23);
  const brushed = brushedRough(512, 256, 5);

  // Negro mate: dieléctrico casi negro con un punto metálico; el brillo lo pone el chaflán.
  const black = (t: FinishTextures) =>
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: t.color,
      roughness: 1,
      roughnessMap: t.rough,
      metalness: 0.25,
      specularIntensity: 1,
      envMapIntensity: 1.35,
    });

  const body = black(caseTex);
  const lid = black(lidTex);
  const chamfer = new THREE.MeshPhysicalMaterial({ color: 0xbabcc1, metalness: 1, roughness: 0.2 });
  const interior = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, metalness: 0.4, roughness: 0.7 });
  const insert = new THREE.MeshPhysicalMaterial({
    color: 0x7a7c81,
    metalness: 1,
    roughness: 1,
    roughnessMap: brushed,
  });
  const insertEdge = new THREE.MeshPhysicalMaterial({ color: 0x9c9ea3, metalness: 1, roughness: 0.2 });
  const plate = new THREE.MeshPhysicalMaterial({
    color: 0x1a1a1d,
    metalness: 0.35,
    roughness: 0.45,
  });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xc9cbcf, metalness: 1, roughness: 0.3 });
  const flint = new THREE.MeshStandardMaterial({ color: 0x4d4a47, metalness: 0.3, roughness: 0.72 });
  const wick = new THREE.MeshStandardMaterial({ map: wickTexture(), roughness: 0.95, metalness: 0 });

  const all = [body, lid, chamfer, interior, insert, insertEdge, plate, steel, flint, wick];
  return { body, lid, chamfer, interior, insert, insertEdge, plate, steel, flint, wick, all };
}
