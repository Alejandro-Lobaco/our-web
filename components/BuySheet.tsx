"use client";

import { useEffect, useRef, useState } from "react";
import { formatEur, type Finish } from "@/lib/content";

interface Props {
  open: boolean;
  finish: Finish;
  onClose: () => void;
}

/**
 * Compra de demostración: no pide datos de pago ni cobra nada.
 * Hoja inferior en móvil, panel centrado en escritorio.
 */
export default function BuySheet({ open, finish, onClose }: Props) {
  const price = finish.price;
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => setDone(false), 400);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-[60] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
      inert={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="buy-title"
        className={`absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-[28px] border border-bone/10 bg-[#0f0f11] px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl transition-[translate,scale,opacity] ease-sheet sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:rounded-[28px] sm:pb-6 ${
          open
            ? "translate-y-0 opacity-100 duration-500 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:scale-100"
            : "translate-y-full opacity-100 duration-300 sm:-translate-x-1/2 sm:-translate-y-[46%] sm:scale-[0.97] sm:opacity-0"
        }`}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-bone/15 sm:hidden" />
        <div className="flex items-start justify-between">
          <h2 id="buy-title" className="font-display text-3xl">
            {done ? "Listo." : "Tu pedido"}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-mute transition-colors hover:text-bone"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="mt-4 space-y-4">
            <p className="text-bone/90">
              Pedido de prueba confirmado: {qty} × ASCUA {finish.name} por {formatEur(price * qty)}.
            </p>
            <p className="text-sm text-mute">
              ASCUA es un producto conceptual. No se ha cobrado nada y no se enviará ningún mechero.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 h-12 w-full rounded-full bg-bone text-sm font-medium text-ink transition-[scale,background-color] duration-150 ease-out hover:bg-white active:scale-[0.98]"
            >
              Volver
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-4 border-y border-bone/10 py-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-[#26262a] to-[#0c0c0e] ring-1 ring-bone/10">
                <div className="h-8 w-5 rounded-[3px] ring-1 ring-white/25" style={{ background: finish.swatch }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">ASCUA {finish.name}</p>
                <p className="text-sm text-mute">{finish.detail}</p>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-bone/15">
                <button
                  type="button"
                  aria-label="Quitar uno"
                  disabled={qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-9 w-9 place-items-center text-lg text-bone/80 disabled:text-bone/25"
                >
                  −
                </button>
                <span className="w-4 text-center tabular-nums" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label="Añadir uno"
                  disabled={qty >= 5}
                  onClick={() => setQty((q) => Math.min(5, q + 1))}
                  className="grid h-9 w-9 place-items-center text-lg text-bone/80 disabled:text-bone/25"
                >
                  +
                </button>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-mute">
                <dt>Envío</dt>
                <dd>Gratis</dd>
              </div>
              <div className="flex justify-between text-base">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatEur(price * qty)}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setDone(true)}
              className="mt-6 h-12 w-full rounded-full bg-ember text-sm font-medium text-ink transition-[scale,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.98]"
            >
              Confirmar pedido
            </button>
            <p className="mt-3 text-center text-xs text-mute">
              Demostración: no se piden datos de pago ni se cobra nada.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
