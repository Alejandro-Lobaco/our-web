"use client";

import { useCallback, useEffect, useRef } from "react";

const HOLD_MS = 900;
const R = 34;
const C = 2 * Math.PI * R;

interface Props {
  lit: boolean;
  onStart: () => void;
  onComplete: () => void;
  onExtinguish: () => void;
}

/** Mantener para encender: el anillo se llena mientras dura la pulsación. */
export default function HoldButton({ lit, onStart, onComplete, onExtinguish }: Props) {
  const ring = useRef<SVGCircleElement>(null);
  const state = useRef({ holding: false, progress: 0, raf: 0, last: 0, fired: false });

  const paint = () => {
    ring.current?.setAttribute("stroke-dashoffset", String(C * (1 - state.current.progress)));
  };

  const tick = useCallback(
    (now: number) => {
      const s = state.current;
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      if (s.holding) {
        s.progress = Math.min(1, s.progress + (dt * 1000) / HOLD_MS);
        if (s.progress >= 1 && !s.fired) {
          s.fired = true;
          s.holding = false;
          onComplete();
          navigator.vibrate?.(18);
        }
      } else {
        s.progress = Math.max(0, s.progress - dt * 3.2);
      }
      paint();
      if (s.holding || s.progress > 0) s.raf = requestAnimationFrame(tick);
      else s.raf = 0;
    },
    [onComplete],
  );

  const start = () => {
    const s = state.current;
    onStart();
    if (lit) {
      onExtinguish();
      return;
    }
    s.holding = true;
    s.fired = false;
    s.last = performance.now();
    if (!s.raf) s.raf = requestAnimationFrame(tick);
  };

  const release = () => {
    const s = state.current;
    s.holding = false;
    if (!s.raf && s.progress > 0) {
      s.last = performance.now();
      s.raf = requestAnimationFrame(tick);
    }
  };

  useEffect(() => {
    const s = state.current;
    return () => cancelAnimationFrame(s.raf);
  }, []);

  useEffect(() => {
    if (!lit) {
      state.current.progress = 0;
      paint();
    }
  }, [lit]);

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        aria-label={lit ? "Apagar la llama" : "Mantén pulsado para encender"}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") release();
        }}
        className="group relative grid h-[84px] w-[84px] shrink-0 place-items-center rounded-full border border-bone/15 bg-ink/40 backdrop-blur-sm transition-transform duration-150 ease-out active:scale-[0.96]"
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 84 84" aria-hidden>
          <circle cx="42" cy="42" r={R} fill="none" stroke="rgba(236,232,225,0.12)" strokeWidth="2" />
          <circle
            ref={ring}
            cx="42"
            cy="42"
            r={R}
            fill="none"
            stroke="#ff9a3c"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C}
          />
        </svg>
        <svg
          viewBox="0 0 24 24"
          className={`h-7 w-7 transition-colors duration-300 ${lit ? "text-ember" : "text-bone/80"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          aria-hidden
        >
          <path d="M12 21c3.6 0 6-2.4 6-5.6 0-2.9-1.9-4.6-3.2-6.3-.9-1.2-1.3-2.6-1.2-4.1-2.8 1.5-4.3 4-4.1 6.6-.9-.6-1.5-1.5-1.7-2.6C6.6 10.6 6 12.3 6 14.9 6 18.4 8.4 21 12 21Z" />
        </svg>
      </button>
      <div className="text-sm leading-snug">
        <p className="text-bone">{lit ? "Encendido." : "Mantén para encender"}</p>
        <p className="text-mute">{lit ? "Toca para apagarlo." : "Gira la rueda contra la piedra."}</p>
      </div>
    </div>
  );
}
