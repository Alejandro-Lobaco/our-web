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
  engrave: THREE.CanvasTexture | null;
}

/**
 * Superficie microgranallada neutra: el tono lo pone el acabado elegido
 * (material.color), así el mismo mapa sirve para negro, acero o latón.
 * Rugosidad centrada en 0,5 para escalarla con material.roughness.
 * El grabado va en una máscara aparte y cambia de contraste según el acabado.
 */
export function finishTextures(width: number, height: number, perimeter: number, engrave: boolean, seed: number): FinishTextures {
  const r = rand(seed);
  const pxmm = width / perimeter;

  const col = canvas(width, height);
  col.ctx.fillStyle = "#efefef";
  col.ctx.fillRect(0, 0, width, height);
  blotches(col.ctx, width, height, r, 60, 0.06, "rgba(255,255,255,A)", "rgba(190,190,190,A)");

  const rough = canvas(width, height);
  rough.ctx.fillStyle = "rgb(128,128,128)";
  rough.ctx.fillRect(0, 0, width, height);
  blotches(rough.ctx, width, height, r, 70, 0.12, "rgba(160,160,160,A)", "rgba(96,96,96,A)");
  grain(rough.ctx, width, height, r, 26);

  let engraveT: THREE.CanvasTexture | null = null;
  if (engrave) {
    const m = canvas(width, height);
    m.ctx.fillStyle = "#000";
    m.ctx.fillRect(0, 0, width, height);
    const cx = (SPEC.W / 2 - SPEC.R) * pxmm;
    const hmm = height / pxmm;
    const yFromBottom = (mm: number) => height - (mm / hmm) * height;
    m.ctx.fillStyle = "#fff";
    m.ctx.textBaseline = "alphabetic";
    m.ctx.font = `500 ${Math.round(3.1 * pxmm)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    spacedText(m.ctx, "ASCUA", cx, yFromBottom(5.2), 1.3 * pxmm);
    m.ctx.font = `500 ${Math.round(1.05 * pxmm)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    spacedText(m.ctx, "ACERO 304 · EDICIÓN 01", cx, yFromBottom(3.0), 0.42 * pxmm);
    m.ctx.fillRect(cx - 6 * pxmm, yFromBottom(9.3), 12 * pxmm, Math.max(1, 0.12 * pxmm));
    engraveT = new THREE.CanvasTexture(m.c);
    engraveT.anisotropy = 8;
  }

  const color = new THREE.CanvasTexture(col.c);
  color.colorSpace = THREE.SRGBColorSpace;
  color.anisotropy = 8;
  const roughT = new THREE.CanvasTexture(rough.c);
  roughT.anisotropy = 8;
  return { color, rough: roughT, engrave: engraveT };
}

// ── Acabados ──────────────────────────────────────────────────────────────
export type FinishId = "negro" | "acero" | "laton";

export interface FinishSpec {
  body: number;
  metal: number;
  rough: number;
  chamfer: number;
  chamferRough: number;
  engrave: number;
  engraveRough: number;
  engraveMetal: number;
}

export const FINISH_SPECS: Record<FinishId, FinishSpec> = {
  // DLC negro: casi dieléctrico, el brillo lo ponen los chaflanes de acero.
  negro: { body: 0x151518, metal: 0.25, rough: 0.46, chamfer: 0xbabcc1, chamferRough: 0.2, engrave: 0x9a9ca1, engraveRough: 0.3, engraveMetal: 1 },
  // Acero satinado con grabado oscurecido.
  acero: { body: 0xb4b6ba, metal: 1, rough: 0.3, chamfer: 0xe4e6ea, chamferRough: 0.12, engrave: 0x1e1e20, engraveRough: 0.8, engraveMetal: 0.1 },
  // Latón cepillado cálido.
  laton: { body: 0xc79d55, metal: 1, rough: 0.26, chamfer: 0xf0d49a, chamferRough: 0.1, engrave: 0x2a1c0c, engraveRough: 0.8, engraveMetal: 0.1 },
};

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
  hinge: THREE.MeshPhysicalMaterial;
  chamfer: THREE.MeshPhysicalMaterial;
  interior: THREE.MeshStandardMaterial;
  insert: THREE.MeshPhysicalMaterial;
  insertEdge: THREE.MeshPhysicalMaterial;
  plate: THREE.MeshPhysicalMaterial;
  steel: THREE.MeshPhysicalMaterial;
  flint: THREE.MeshStandardMaterial;
  wick: THREE.MeshStandardMaterial;
  engrave: {
    uEngraveMap: { value: THREE.Texture | null };
    uEngraveColor: { value: THREE.Color };
    uEngraveRough: { value: number };
    uEngraveMetal: { value: number };
  };
  all: THREE.Material[];
}

/** Inyecta la máscara de grabado: color, rugosidad y metal propios. */
function withEngraving(mat: THREE.MeshPhysicalMaterial, uniforms: Materials["engrave"]) {
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform sampler2D uEngraveMap;\nuniform vec3 uEngraveColor;\nuniform float uEngraveRough;\nuniform float uEngraveMetal;",
      )
      .replace(
        "#include <map_fragment>",
        "#include <map_fragment>\nfloat engrave = texture2D(uEngraveMap, vMapUv).r;\ndiffuseColor.rgb = mix(diffuseColor.rgb, uEngraveColor, engrave);",
      )
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uEngraveRough, engrave);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, uEngraveMetal, engrave);");
  };
  mat.customProgramCacheKey = () => "ascua-engrave";
}

export function makeMaterials(opts: { mobile: boolean; perimeter: number }): Materials {
  const w = opts.mobile ? 1024 : 2048;
  const h = Math.round((w * SPEC.caseH) / opts.perimeter);
  const hLid = Math.round((w * SPEC.lidH) / opts.perimeter);
  const caseTex = finishTextures(w, h, opts.perimeter, true, 11);
  const lidTex = finishTextures(w, hLid, opts.perimeter, false, 23);
  const brushed = brushedRough(512, 256, 5);
  const f = FINISH_SPECS.negro;

  const shell = (t: FinishTextures) =>
    new THREE.MeshPhysicalMaterial({
      color: f.body,
      map: t.color,
      roughness: f.rough * 2,
      roughnessMap: t.rough,
      metalness: f.metal,
      specularIntensity: 1,
      envMapIntensity: 1.35,
    });

  const engrave: Materials["engrave"] = {
    uEngraveMap: { value: caseTex.engrave },
    uEngraveColor: { value: new THREE.Color(f.engrave) },
    uEngraveRough: { value: f.engraveRough },
    uEngraveMetal: { value: f.engraveMetal },
  };
  const body = shell(caseTex);
  withEngraving(body, engrave);
  const lid = shell(lidTex);
  const hinge = new THREE.MeshPhysicalMaterial({ color: f.body, metalness: f.metal, roughness: 0.4 });
  const chamfer = new THREE.MeshPhysicalMaterial({ color: f.chamfer, metalness: 1, roughness: f.chamferRough });
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

  const all = [body, lid, hinge, chamfer, interior, insert, insertEdge, plate, steel, flint, wick];
  return { body, lid, hinge, chamfer, interior, insert, insertEdge, plate, steel, flint, wick, engrave, all };
}
