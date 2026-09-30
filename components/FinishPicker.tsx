"use client";

import { FINISHES, formatEur, type Finish } from "@/lib/content";
import type { FinishId } from "@/lib/ascua/materials";

interface Props {
  value: FinishId;
  onChange: (f: Finish) => void;
}

/** Selector de acabado: radios nativos (teclado y lector de pantalla gratis). */
export default function FinishPicker({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="mb-3 text-[11px] uppercase tracking-[0.18em] text-mute">Elige el acabado</legend>
      <div className="grid grid-cols-3 gap-2">
        {FINISHES.map((f) => {
          const active = f.id === value;
          return (
            <label
              key={f.id}
              className={`group relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border px-2 py-3 transition-[border-color,background-color,scale] duration-200 ease-out active:scale-[0.97] ${
                active ? "border-ember/70 bg-ember/[0.06]" : "border-bone/10 hover:border-bone/30"
              }`}
            >
              <input
                type="radio"
                name="acabado"
                value={f.id}
                checked={active}
                onChange={() => onChange(f)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="h-9 w-9 rounded-full shadow-[inset_0_-2px_6px_rgba(0,0,0,0.45),0_2px_10px_rgba(0,0,0,0.5)] ring-1 ring-white/15"
                style={{ background: f.swatch }}
              />
              <span className="text-sm leading-none">{f.name}</span>
              <span className="text-[11px] leading-none tabular-nums text-mute">{formatEur(f.price)}</span>
              <span className="pointer-events-none absolute inset-0 rounded-2xl ring-ember/80 peer-focus-visible:ring-2" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
