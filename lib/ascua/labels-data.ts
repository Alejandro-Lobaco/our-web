export type PieceId = "tapa" | "rueda" | "mecha" | "piedra" | "muelle" | "inserto" | "carcasa";

/** Etiquetas del despiece (sin three.js: también las lee el HTML accesible). */
export const LABELS: { piece: PieceId; title: string; spec: string }[] = [
  { piece: "tapa", title: "Tapa", spec: "Acero 304 · 0,9 mm" },
  { piece: "rueda", title: "Rueda", spec: "36 dientes · acero templado" },
  { piece: "mecha", title: "Mecha", spec: "Algodón trenzado · Ø 3 mm" },
  { piece: "piedra", title: "Piedra", spec: "Ferrocerio · Ø 2,4 mm" },
  { piece: "inserto", title: "Chimenea", spec: "16 respiraderos" },
  { piece: "muelle", title: "Muelle", spec: "11 espiras · acero de muelle" },
  { piece: "inserto", title: "Inserto", spec: "Depósito con fieltro" },
  { piece: "carcasa", title: "Carcasa", spec: "DLC negro mate · 36,5 mm" },
];
