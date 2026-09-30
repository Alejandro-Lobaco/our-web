import type { FinishId } from "@/lib/ascua/materials";

/**
 * Actos de la página. `vh` = alto de la sección; `anchor` = punto del acto
 * (fracción) donde aterrizan los saltos del menú, ya con la cámara asentada.
 */
export const ACTS = [
  { id: "inicio", label: "Inicio", vh: 170, anchor: 0 },
  { id: "despiece", label: "Despiece", vh: 320, anchor: 0.34 },
  { id: "material", label: "Material", vh: 320, anchor: 0.3 },
  { id: "detalle", label: "Detalle", vh: 280, anchor: 0.3 },
  { id: "encender", label: "Encender", vh: 280, anchor: 0.3 },
  { id: "acabados", label: "Acabados", vh: 260, anchor: 0.3 },
] as const;

export interface Finish {
  id: FinishId;
  name: string;
  detail: string;
  price: number;
  swatch: string;
}

export const FINISHES: Finish[] = [
  {
    id: "negro",
    name: "Negro",
    detail: "Acero 304 · DLC negro mate",
    price: 89,
    swatch: "radial-gradient(circle at 32% 28%, #45454b, #121214 62%, #050506)",
  },
  {
    id: "acero",
    name: "Acero",
    detail: "Acero 304 satinado",
    price: 79,
    swatch: "radial-gradient(circle at 32% 28%, #ffffff, #b9bcc1 45%, #6f7277)",
  },
  {
    id: "laton",
    name: "Latón",
    detail: "Latón macizo cepillado",
    price: 109,
    swatch: "radial-gradient(circle at 32% 28%, #fbe7ba, #c99a4f 48%, #7a5520)",
  },
];

export const TRUST = ["Envío gratis en 48 h", "30 días de devolución", "Garantía de por vida"];

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
export const formatEur = (n: number) => eur.format(n);
