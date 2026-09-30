"use client";

import Lenis from "lenis";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AscuaEngine } from "@/lib/ascua/engine";
import { LABELS } from "@/lib/ascua/labels-data";
import { ACTS, FINISHES, formatEur, TRUST, type Finish } from "@/lib/content";
import BuySheet from "./BuySheet";
import Credits from "./Credits";
import FinishPicker from "./FinishPicker";
import HoldButton from "./HoldButton";

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** 3.000 · 0,6 — Intl en español no agrupa los números de cuatro cifras. */
const fmt = (v: number, dec = 0) => {
  const [int, frac] = v.toFixed(dec).split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + (frac ? `,${frac}` : "");
};

function Kicker({ n, children, r }: { n: string; children: React.ReactNode; r: number }) {
  return (
    <p data-r={r} className="mb-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-ember">
      <span className="tabular-nums">{n}</span>
      <span className="h-px w-6 bg-ember/50" aria-hidden />
      <span className="text-bone/70">{children}</span>
    </p>
  );
}

/** Línea de titular que sube desde una máscara. */
function Line({ r, children }: { r: number; children: React.ReactNode }) {
  return (
    <span className="line">
      <span data-r={r} data-line="">
        {children}
      </span>
    </span>
  );
}

function Stat({ to, dec = 0, unit, label }: { to: number; dec?: number; unit?: string; label: string }) {
  return (
    <div className="border-t border-bone/10 pt-3">
      <p className="font-display text-3xl leading-none md:text-5xl">
        <span data-count={to} data-dec={dec} className="tabular-nums">
          {fmt(to, dec)}
        </span>
        {unit && <span className="ml-0.5 text-base text-bone/60 md:ml-1 md:text-2xl">{unit}</span>}
      </p>
      <p className="mt-2 text-xs leading-snug text-mute">{label}</p>
    </div>
  );
}

export default function Experience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AscuaEngine | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const tRef = useRef(0);
  const introRef = useRef({ start: Infinity, played: false });
  const userSound = useRef<boolean | null>(null);
  const tiltOn = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sound, setSound] = useState(false);
  const [blueprint, setBlueprint] = useState(false);
  const [lit, setLit] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [finish, setFinish] = useState<Finish>(FINISHES[0]);

  // Motor 3D.
  useEffect(() => {
    let cancelled = false;
    let engine: AscuaEngine | null = null;
    (async () => {
      try {
        const { AscuaEngine } = await import("@/lib/ascua/engine");
        if (cancelled || !canvasRef.current) return;
        const mobile = window.matchMedia("(max-width: 767px), (pointer: coarse)").matches;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const lock = new URLSearchParams(window.location.search).get("t");
        engine = new AscuaEngine(canvasRef.current, {
          mobile,
          reducedMotion,
          labelLayer: labelsRef.current,
          lockTimeline: lock ? parseFloat(lock) : null,
          initialTimeline: tRef.current,
          displayFont: getComputedStyle(document.documentElement).getPropertyValue("--font-serif").trim(),
        });
        engine.onLitChange = setLit;
        await engine.init();
        if (cancelled) return;
        engineRef.current = engine;
        (window as unknown as { __ascua?: AscuaEngine }).__ascua = engine;
        introRef.current = { start: performance.now(), played: !engine.introSkipped };
        setReady(true);
      } catch (err) {
        console.error("ASCUA: WebGL no disponible", err);
        if (!cancelled) {
          introRef.current = { start: performance.now(), played: false };
          setFailed(true);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Scroll suave + línea de tiempo + revelados, todo en un único rAF.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = reduced ? null : new Lenis({ lerp: 0.075, wheelMultiplier: 0.8, smoothWheel: true, autoRaf: false });
    lenisRef.current = lenis;

    const sections = ACTS.map((a) => document.getElementById(a.id)!);
    const reveals = sections.map((s) => Array.from(s.querySelectorAll<HTMLElement>("[data-r]")));
    const counters = Array.from(document.querySelectorAll<HTMLElement>("[data-count]"));
    const rail = Array.from(document.querySelectorAll<HTMLElement>("[data-rail]"));
    const bar = document.querySelector<HTMLElement>("[data-progress]");
    const cache = new Map<HTMLElement, number>();
    let tops: number[] = [];
    let heights: number[] = [];
    let vh = window.innerHeight;
    let max = 1;
    let activeAct = -1;
    const measure = () => {
      vh = window.innerHeight;
      tops = sections.map((s) => s.offsetTop);
      heights = sections.map((s) => s.offsetHeight);
      max = Math.max(1, document.documentElement.scrollHeight - vh);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);

    const apply = (el: HTMLElement, a: number) => {
      const q = Math.round(a * 1000) / 1000;
      if (cache.get(el) === q) return;
      cache.set(el, q);
      if ("line" in el.dataset) {
        el.style.transform = q >= 1 ? "" : `translate3d(0, ${((1 - q) * 105).toFixed(1)}%, 0)`;
        el.style.opacity = String(Math.min(1, q * 2.5));
      } else {
        el.style.opacity = String(q);
        if (!reduced) el.style.transform = q >= 1 ? "" : `translate3d(0, ${((1 - q) * 18).toFixed(1)}px, 0)`;
      }
      el.style.pointerEvents = q > 0.5 ? "" : "none";
      el.style.visibility = q <= 0 ? "hidden" : "";
    };

    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      lenis?.raf(now);
      const y = window.scrollY;
      let t = 0;
      for (let i = 0; i < sections.length; i++) if (y >= tops[i]) t = i + Math.min(1, (y - tops[i]) / heights[i]);
      tRef.current = t;
      engineRef.current?.setTimeline(t);

      const since = (now - introRef.current.start) / 1000;
      const delay = introRef.current.played ? 1.25 : 0.15;
      for (let i = 0; i < sections.length; i++) {
        const f = (y - tops[i]) / heights[i];
        const fu = 1 - vh / heights[i];
        const last = i === sections.length - 1;
        for (const el of reveals[i]) {
          const k = Number(el.dataset.r);
          const a =
            i === 0
              ? smooth(delay + k * 0.11, delay + k * 0.11 + 0.8, since) * (1 - smooth(0.14, 0.36, f))
              : smooth(0.08 + k * 0.035, 0.21 + k * 0.035, f) * (last ? 1 : 1 - smooth(fu - 0.12, fu - 0.03, f));
          apply(el, a);
        }
      }
      for (const c of counters) {
        const host = c.closest<HTMLElement>("[data-r]");
        const a = host ? (cache.get(host) ?? 0) : 1;
        const to = Number(c.dataset.count);
        const dec = Number(c.dataset.dec ?? 0);
        const v = to * (1 - Math.pow(1 - a, 3));
        const text = fmt(v, dec);
        if (c.textContent !== text) c.textContent = text;
      }
      const act = Math.min(ACTS.length - 1, Math.max(0, Math.floor(t + 0.05)));
      if (act !== activeAct) {
        activeAct = act;
        rail.forEach((el, i) => el.toggleAttribute("data-active", i === act));
      }
      if (bar) bar.style.transform = `scaleX(${(y / max).toFixed(4)})`;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, []);

  // Con la hoja o el menú abiertos, la página no se mueve.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (sheet || menu) lenis.stop();
    else lenis.start();
  }, [sheet, menu]);

  /** Actos vecinos: scroll suave. Lejanos: corte a negro y salto directo. */
  const jump = useCallback((i: number) => {
    const s = document.getElementById(ACTS[i].id);
    if (!s) return;
    const top = s.offsetTop + ACTS[i].anchor * s.offsetHeight;
    const t = i + ACTS[i].anchor;
    const lenis = lenisRef.current;
    if (!lenis) {
      window.scrollTo(0, top);
      engineRef.current?.snapTo(t);
      return;
    }
    if (Math.abs(t - tRef.current) <= 1.3) {
      lenis.scrollTo(top, { duration: 2.4, easing: easeInOutCubic, force: true });
      return;
    }
    const veil = veilRef.current;
    if (veil) veil.style.opacity = "1";
    window.setTimeout(() => {
      lenis.scrollTo(top, { immediate: true, force: true });
      engineRef.current?.snapTo(t);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (veil) veil.style.opacity = "0";
        }),
      );
    }, 280);
  }, []);

  const go = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu(false);
    jump(i);
  };

  const toggleSound = () => {
    const next = !sound;
    userSound.current = next;
    setSound(next);
    engineRef.current?.setSound(next);
  };

  const enableTilt = useCallback(async () => {
    if (tiltOn.current || !window.matchMedia("(pointer: coarse)").matches) return;
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
    if (!DOE) return;
    try {
      if (typeof DOE.requestPermission === "function" && (await DOE.requestPermission()) !== "granted") return;
    } catch {
      return;
    }
    tiltOn.current = true;
    window.addEventListener("deviceorientation", (e) => engineRef.current?.setTilt((e.gamma ?? 0) / 35));
  }, []);

  const onHoldStart = useCallback(() => {
    // El gesto desbloquea audio y giroscopio (salvo que el usuario haya silenciado).
    if (userSound.current !== false) {
      setSound(true);
      engineRef.current?.setSound(true);
    }
    void enableTilt();
  }, [enableTilt]);

  const onStrike = useCallback(() => engineRef.current?.strike(), []);
  const onExtinguish = useCallback(() => engineRef.current?.extinguish(), []);
  const openSheet = () => {
    setMenu(false);
    setSheet(true);
  };
  const closeSheet = useCallback(() => setSheet(false), []);
  const pickFinish = (f: Finish) => {
    setFinish(f);
    engineRef.current?.setFinish(f.id);
  };

  return (
    <div className="relative [overflow-x:clip]">
      <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-0 block h-lvh w-full" />
      {failed && (
        <div
          aria-hidden
          className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_40%_35%_at_62%_55%,rgba(255,154,60,0.16),transparent_70%)]"
        />
      )}
      <div aria-hidden className="edge-shade pointer-events-none fixed inset-0 z-[2]" />
      <div ref={labelsRef} aria-hidden className="pointer-events-none fixed inset-0 z-[5] transition-opacity" />
      <div
        ref={veilRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[65] bg-ink opacity-0 transition-opacity duration-300 ease-out"
      />

      {/* Cargador */}
      <div
        aria-hidden={ready}
        className={`fixed inset-0 z-[70] grid place-items-center bg-ink transition-opacity duration-700 ease-out ${
          ready ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div className="flex flex-col items-center gap-5">
          <span className="font-display text-3xl tracking-[0.3em]">ASCUA</span>
          <span className="relative h-px w-28 overflow-hidden bg-bone/10">
            <span className="loader-bar absolute inset-0 bg-ember" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-mute">Edición 01</span>
          <span className="sr-only">Cargando</span>
        </div>
      </div>

      {/* Progreso de lectura */}
      <div aria-hidden className="fixed inset-x-0 top-0 z-[45] h-[2px] bg-bone/5">
        <div data-progress="" className="h-full origin-left scale-x-0 bg-ember" />
      </div>

      {/* Navegación */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(4rem+env(safe-area-inset-top,0px))] items-center justify-between bg-gradient-to-b from-ink/85 via-ink/40 to-transparent px-5 pt-[env(safe-area-inset-top,0px)] md:h-[calc(5rem+env(safe-area-inset-top,0px))] md:px-12">
        <a href="#inicio" onClick={go(0)} className="font-display text-2xl tracking-[0.28em]" aria-label="ASCUA, inicio">
          ASCUA
        </a>
        <nav className="hidden items-center gap-8 text-sm text-bone/60 lg:flex" aria-label="Escenas">
          {ACTS.slice(1).map((a, i) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              onClick={go(i + 1)}
              className="transition-colors duration-200 hover:text-bone"
            >
              {a.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={sound}
            aria-label={sound ? "Silenciar" : "Activar sonido"}
            className="grid h-10 w-10 place-items-center rounded-full text-bone/70 transition-colors hover:text-bone"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M4 10v4h3l4 3.5v-11L7 10H4Z" />
              {sound ? (
                <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.5 7a7 7 0 0 1 0 10" />
              ) : (
                <path d="M15.5 10l4 4M19.5 10l-4 4" />
              )}
            </svg>
          </button>
          <button
            type="button"
            onClick={openSheet}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-bone px-4 text-[13px] font-medium text-ink transition-[scale,background-color] duration-150 ease-out hover:bg-white active:scale-[0.97] md:h-10 md:text-sm"
          >
            Comprar <span className="hidden text-ink/40 sm:inline">·</span>{" "}
            <span className="hidden tabular-nums sm:inline">{formatEur(finish.price)}</span>
          </button>
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Abrir menú"
            aria-expanded={menu}
            className="grid h-10 w-10 place-items-center rounded-full lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M4 9h16M4 15h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Raíl de escenas */}
      <nav aria-label="Escenas" className="fixed top-1/2 right-3 z-30 hidden -translate-y-1/2 flex-col items-end lg:flex">
        {ACTS.map((a, i) => (
          <a
            key={a.id}
            href={`#${a.id}`}
            onClick={go(i)}
            data-rail=""
            aria-label={`Escena 0${i}: ${a.label}`}
            className="group relative flex h-6 w-10 items-center justify-end"
          >
            <span className="pointer-events-none absolute right-full mr-2 translate-x-1 whitespace-nowrap text-[11px] uppercase tracking-[0.18em] text-bone opacity-0 transition-[opacity,translate] duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100">
              <span className="tabular-nums text-ember">0{i}</span> {a.label}
            </span>
            <span className="h-px w-3 bg-bone/35 transition-[width,background-color] duration-300 ease-out group-hover:bg-bone group-data-[active]:w-7 group-data-[active]:bg-ember" />
          </a>
        ))}
      </nav>

      {/* Menú móvil */}
      <div
        className={`fixed inset-0 z-50 bg-ink/95 backdrop-blur-md transition-opacity duration-300 ease-out lg:hidden ${
          menu ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        inert={!menu}
      >
        <div className="flex h-[calc(4rem+env(safe-area-inset-top,0px))] items-center justify-between px-5 pt-[env(safe-area-inset-top,0px)]">
          <span className="font-display text-2xl tracking-[0.28em]">ASCUA</span>
          <button
            type="button"
            onClick={() => setMenu(false)}
            aria-label="Cerrar menú"
            className="grid h-10 w-10 place-items-center rounded-full"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col px-5 pt-6" aria-label="Escenas">
          {ACTS.slice(1).map((a, i) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              onClick={go(i + 1)}
              className="flex items-baseline gap-4 border-b border-bone/10 py-4 font-display text-4xl"
            >
              <span className="font-sans text-xs tabular-nums text-ember">0{i + 1}</span>
              {a.label}
            </a>
          ))}
        </nav>
        <div className="px-5 pt-8">
          <button
            type="button"
            onClick={openSheet}
            className="h-12 w-full rounded-full bg-ember text-sm font-medium text-ink active:scale-[0.98]"
          >
            Comprar ASCUA {finish.name} · {formatEur(finish.price)}
          </button>
        </div>
      </div>

      <main className="relative z-10">
        {/* 00 · Hero */}
        <section id={ACTS[0].id} style={{ height: `${ACTS[0].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col justify-end px-5 pb-[max(2.25rem,env(safe-area-inset-bottom))] md:px-12 md:pb-14">
            <div className="scrim max-w-2xl">
              <p
                data-r={0}
                className="mb-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-bone/70"
              >
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-ember" aria-hidden />
                Nuevo · Edición 01
              </p>
              <h1 className="font-display text-[3.6rem] leading-[0.88] tracking-[-0.015em] md:text-8xl lg:text-[9.25rem]">
                <Line r={1}>Fuego de</Line>
                <Line r={2}>
                  <em className="text-ember/95">bolsillo.</em>
                </Line>
              </h1>
              <p data-r={3} className="mt-6 max-w-md text-[15px] leading-relaxed text-bone/70 md:text-lg">
                ASCUA Negro. Acero inoxidable con acabado negro mate, cortavientos de 16 respiraderos y una rueda de
                36 dientes que enciende a la primera.
              </p>
              <div data-r={4} className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={openSheet}
                  className="h-12 rounded-full bg-ember px-6 text-sm font-medium text-ink shadow-[0_8px_30px_-8px_rgba(255,154,60,0.6)] transition-[scale,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.97]"
                >
                  Comprar · {formatEur(finish.price)}
                </button>
                <a
                  href={`#${ACTS[1].id}`}
                  onClick={go(1)}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-bone/20 px-5 text-sm transition-[border-color,scale] duration-200 hover:border-bone/50 active:scale-[0.97]"
                >
                  Ver por dentro
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </a>
              </div>
              <ul data-r={5} className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-xs text-mute">
                {TRUST.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ember" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                      <path d="M3.5 8.5l3 3 6-7" />
                    </svg>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div
              data-r={6}
              className="absolute right-12 bottom-14 hidden items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-mute md:flex"
            >
              Desliza
              <span className="relative h-9 w-px overflow-hidden bg-bone/10">
                <span className="scroll-cue absolute inset-0 bg-bone/70" />
              </span>
            </div>
          </div>
        </section>

        {/* 01 · Despiece */}
        <section id={ACTS[1].id} style={{ height: `${ACTS[1].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col justify-between px-5 pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-10 md:px-12 md:pt-28 md:pb-14">
            <div className="max-w-xs md:max-w-sm">
              <Kicker n="01" r={0}>
                Despiece
              </Kicker>
              <h2 className="font-display text-4xl leading-[0.95] md:text-6xl">
                <Line r={1}>Ocho piezas.</Line>
                <Line r={2}>Ninguna de sobra.</Line>
              </h2>
              <p data-r={3} className="mt-4 hidden max-w-[20rem] text-[15px] leading-relaxed text-bone/65 md:block">
                Sin plásticos ni pegamentos: todo se remacha, se atornilla o encaja. Cada pieza se cambia por separado.
              </p>
              <ul className="sr-only">
                {LABELS.map((l) => (
                  <li key={l.title}>
                    {l.title}: {l.spec}
                  </li>
                ))}
              </ul>
            </div>
            <div data-r={4}>
              <button
                type="button"
                aria-pressed={blueprint}
                onClick={() => {
                  const next = !blueprint;
                  setBlueprint(next);
                  engineRef.current?.setBlueprint(next);
                }}
                className="inline-flex h-10 items-center gap-3 rounded-full border border-bone/20 bg-ink/40 px-4 text-sm backdrop-blur-sm transition-[border-color,scale] duration-200 hover:border-bone/50 active:scale-[0.97]"
              >
                <span
                  className={`relative h-4 w-7 rounded-full transition-colors duration-200 ${blueprint ? "bg-ember" : "bg-bone/20"}`}
                  aria-hidden
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-ink transition-transform duration-200 ease-out ${
                      blueprint ? "translate-x-3" : ""
                    }`}
                  />
                </span>
                Ver plano
              </button>
            </div>
          </div>
        </section>

        {/* 02 · Material */}
        <section id={ACTS[2].id} style={{ height: `${ACTS[2].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col items-start justify-end px-5 pb-10 md:items-end md:justify-center md:px-12 md:pb-0 lg:pr-32">
            <div className="scrim max-w-md">
              <Kicker n="02" r={0}>
                Material
              </Kicker>
              <h2 className="font-display text-5xl leading-[0.95] md:text-7xl">
                <Line r={1}>Negro mate,</Line>
                <Line r={2}>cantos pulidos.</Line>
              </h2>
              <p data-r={3} className="mt-5 text-[15px] leading-relaxed text-bone/65 md:text-base">
                Un recubrimiento DLC negro que se traga la luz y un chaflán pulido a espejo que dibuja el contorno cuando
                la luz lo roza.
              </p>
              <div data-r={4} className="mt-7 grid grid-cols-4 gap-4 md:grid-cols-2 md:gap-x-8 md:gap-y-6">
                <Stat to={0.6} dec={1} unit="mm" label="Chaflán pulido" />
                <Stat to={304} label="Acero inoxidable" />
                <Stat to={16} label="Respiraderos" />
                <Stat to={58} unit="g" label="En tu mano" />
              </div>
            </div>
          </div>
        </section>

        {/* 03 · Detalle */}
        <section id={ACTS[3].id} style={{ height: `${ACTS[3].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col justify-end px-5 pb-10 md:px-12 md:pb-16">
            <div className="scrim flex max-w-3xl flex-col gap-8 md:flex-row md:items-end md:gap-14">
              <div className="max-w-md">
                <Kicker n="03" r={0}>
                  Detalle
                </Kicker>
                <h2 className="font-display text-5xl leading-[0.95] md:text-7xl">
                  <Line r={1}>Treinta y</Line>
                  <Line r={2}>seis dientes.</Line>
                </h2>
                <p data-r={3} className="mt-5 text-[15px] leading-relaxed text-bone/65 md:text-base">
                  Rueda de acero templado contra piedra de ferrocerio. Un giro basta.
                </p>
              </div>
              <div data-r={4} className="hidden md:block">
                <p className="font-display text-7xl leading-none text-ember">
                  <span data-count={3000} className="tabular-nums">
                    3.000
                  </span>
                  <span className="text-3xl"> °C</span>
                </p>
                <p className="mt-2 text-xs text-mute">Temperatura de cada chispa</p>
              </div>
            </div>
          </div>
        </section>

        {/* 04 · Encender */}
        <section id={ACTS[4].id} style={{ height: `${ACTS[4].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col justify-end px-5 pb-10 md:justify-center md:px-12 md:pb-0">
            <div className="scrim max-w-md">
              <Kicker n="04" r={0}>
                Encender
              </Kicker>
              <h2 className="font-display text-5xl leading-[0.95] md:text-8xl">
                <Line r={1}>Tu turno.</Line>
              </h2>
              <p data-r={2} className="mt-5 text-[15px] leading-relaxed text-bone/65 md:text-base">
                Dieciséis respiraderos protegen la llama del viento.{" "}
                <span className="md:hidden">Inclina el móvil: la llama te sigue.</span>
                <span className="hidden md:inline">Mueve el cursor: la luz del estudio gira con él.</span>
              </p>
              <div data-r={3} className="mt-8">
                <HoldButton lit={lit} onStart={onHoldStart} onComplete={onStrike} onExtinguish={onExtinguish} />
              </div>
            </div>
          </div>
        </section>

        {/* 05 · Acabados y compra */}
        <section id={ACTS[5].id} style={{ height: `${ACTS[5].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col items-start justify-end px-5 pb-[max(2rem,env(safe-area-inset-bottom))] md:items-end md:justify-center md:px-12 md:pb-0 lg:pr-32">
            <div className="scrim w-full max-w-sm">
              <Kicker n="05" r={0}>
                Tu ASCUA
              </Kicker>
              <h2 className="font-display text-6xl leading-[0.9] md:text-8xl">
                <Line r={1}>ASCUA</Line>
                <Line r={2}>
                  <em key={finish.id} className="swap-in text-ember/95">
                    {finish.name}.
                  </em>
                </Line>
              </h2>
              <div data-r={3} className="mt-6">
                <FinishPicker value={finish.id} onChange={pickFinish} />
              </div>
              <div data-r={4} className="mt-5 flex items-center gap-4">
                <p className="font-display text-4xl leading-none tabular-nums">
                  <span key={finish.id} className="swap-in">
                    {formatEur(finish.price)}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={openSheet}
                  className="h-12 flex-1 rounded-full bg-ember text-sm font-medium text-ink shadow-[0_8px_30px_-8px_rgba(255,154,60,0.6)] transition-[scale,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.98]"
                >
                  Comprar
                </button>
              </div>
              <ul data-r={5} className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-mute">
                {TRUST.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p data-r={6} className="mt-3 text-[11px] text-mute/80">
                Producto conceptual: la compra es una demostración y no se cobra nada.
              </p>
            </div>
          </div>
        </section>

        <Credits onTop={go(0)} />
      </main>

      <BuySheet open={sheet} finish={finish} onClose={closeSheet} />
    </div>
  );
}
