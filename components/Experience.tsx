"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AscuaEngine } from "@/lib/ascua/engine";
import { LABELS } from "@/lib/ascua/labels-data";
import BuySheet, { formatEur, PRICE } from "./BuySheet";
import HoldButton from "./HoldButton";

const ACTS = [
  { id: "inicio", label: "Inicio", vh: 150 },
  { id: "apertura", label: "Apertura", vh: 200 },
  { id: "despiece", label: "Despiece", vh: 260 },
  { id: "orbita", label: "Órbita", vh: 230 },
  { id: "detalle", label: "Detalle", vh: 200 },
  { id: "encender", label: "Encender", vh: 220 },
  { id: "comprar", label: "Comprar", vh: 170 },
] as const;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function Kicker({ n, children, r }: { n: string; children: React.ReactNode; r: number }) {
  return (
    <p data-r={r} className="mb-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-ember">
      <span className="tabular-nums">Escena {n}</span>
      <span className="h-px w-6 bg-ember/50" aria-hidden />
      <span className="text-bone/70">{children}</span>
    </p>
  );
}

export default function Experience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<AscuaEngine | null>(null);
  const userSound = useRef<boolean | null>(null);
  const tiltOn = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sound, setSound] = useState(false);
  const [blueprint, setBlueprint] = useState(false);
  const [lit, setLit] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [menu, setMenu] = useState(false);

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
        });
        engine.onLitChange = setLit;
        await engine.init();
        if (cancelled) return;
        engineRef.current = engine;
        (window as unknown as { __ascua?: AscuaEngine }).__ascua = engine;
        setReady(true);
      } catch (err) {
        console.error("ASCUA: WebGL no disponible", err);
        if (!cancelled) {
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

  // Scroll → línea de tiempo del motor + revelados de texto guiados por posición.
  useEffect(() => {
    const sections = ACTS.map((a) => document.getElementById(a.id)!);
    const reveals = sections.map((s) => Array.from(s.querySelectorAll<HTMLElement>("[data-r]")));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cache = new Map<HTMLElement, number>();
    let tops: number[] = [];
    let heights: number[] = [];
    let vh = window.innerHeight;
    const measure = () => {
      vh = window.innerHeight;
      tops = sections.map((s) => s.offsetTop);
      heights = sections.map((s) => s.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const y = window.scrollY;
      let t = 0;
      for (let i = 0; i < sections.length; i++) if (y >= tops[i]) t = i + Math.min(1, (y - tops[i]) / heights[i]);
      engineRef.current?.setTimeline(t);

      for (let i = 0; i < sections.length; i++) {
        const p = (y - tops[i]) / Math.max(1, heights[i] - vh);
        const lastAct = i === sections.length - 1;
        for (const el of reveals[i]) {
          const k = Number(el.dataset.r);
          const a =
            i === 0
              ? 1 - smooth(0.5, 0.92, p)
              : smooth(0.02 + k * 0.045, 0.16 + k * 0.045, p) * (lastAct ? 1 : 1 - smooth(0.84, 0.97, p));
          const q = Math.round(a * 1000) / 1000;
          if (cache.get(el) === q) continue;
          cache.set(el, q);
          el.style.opacity = String(q);
          if (!reduced) el.style.transform = q >= 1 ? "" : `translate3d(0, ${((1 - q) * 18).toFixed(1)}px, 0)`;
          el.style.pointerEvents = q > 0.5 ? "" : "none";
          el.style.visibility = q <= 0 ? "hidden" : "";
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

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
          <span className="sr-only">Cargando</span>
        </div>
      </div>

      {/* Navegación */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(4rem+env(safe-area-inset-top,0px))] items-center justify-between px-5 pt-[env(safe-area-inset-top,0px)] md:h-[calc(5rem+env(safe-area-inset-top,0px))] md:px-12">
        <a href="#inicio" className="font-display text-2xl tracking-[0.28em]" aria-label="ASCUA, inicio">
          ASCUA
        </a>
        <nav className="hidden items-center gap-8 text-sm text-bone/60 md:flex" aria-label="Escenas">
          {ACTS.slice(1, 6).map((a) => (
            <a key={a.id} href={`#${a.id}`} className="transition-colors duration-200 hover:text-bone">
              {a.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
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
            className="hidden h-10 items-center gap-2 rounded-full border border-bone/20 px-4 text-sm transition-[border-color,scale] duration-200 hover:border-bone/50 active:scale-[0.97] sm:inline-flex"
          >
            Comprar <span className="text-mute">·</span> <span className="tabular-nums">{formatEur(PRICE)}</span>
          </button>
          <button
            type="button"
            onClick={() => setMenu(true)}
            aria-label="Abrir menú"
            aria-expanded={menu}
            className="grid h-10 w-10 place-items-center rounded-full md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M4 9h16M4 15h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Menú móvil */}
      <div
        className={`fixed inset-0 z-50 bg-ink/95 backdrop-blur-md transition-opacity duration-300 ease-out md:hidden ${
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
        <nav className="flex flex-col px-5 pt-8" aria-label="Escenas">
          {ACTS.slice(1).map((a, i) => (
            <a
              key={a.id}
              href={`#${a.id}`}
              onClick={() => setMenu(false)}
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
            className="h-12 w-full rounded-full bg-bone text-sm font-medium text-ink active:scale-[0.98]"
          >
            Comprar · {formatEur(PRICE)}
          </button>
        </div>
      </div>

      <main className="relative z-10">
        {/* 00 · Hero */}
        <section id={ACTS[0].id} style={{ height: `${ACTS[0].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col justify-end px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:px-12 md:pb-14">
            <div className="scrim max-w-2xl">
              <Kicker n="00" r={0}>
                ASCUA Negro
              </Kicker>
              <h1 data-r={1} className="font-display text-6xl leading-[0.9] tracking-[-0.01em] md:text-8xl lg:text-[8.75rem]">
                Fuego de
                <br />
                <em className="text-bone/90">bolsillo.</em>
              </h1>
              <p data-r={2} className="mt-6 max-w-sm text-[15px] leading-relaxed text-bone/65 md:text-base">
                Un mechero de gasolina en acero inoxidable con acabado negro mate. Se abre con un clic y enciende a la
                primera.
              </p>
            </div>
            <div data-r={3} className="mt-9 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-mute">
              <span className="relative h-9 w-px overflow-hidden bg-bone/10">
                <span className="scroll-cue absolute inset-0 bg-bone/70" />
              </span>
              Desliza para abrirlo
            </div>
          </div>
        </section>

        {/* 01 · Apertura */}
        <section id={ACTS[1].id} style={{ height: `${ACTS[1].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col justify-end px-5 pb-12 md:justify-center md:px-12 md:pb-0">
            <div className="scrim max-w-md">
              <Kicker n="01" r={0}>
                Apertura
              </Kicker>
              <h2 data-r={1} className="font-display text-5xl leading-[0.95] md:text-7xl">
                Se abre con un clic.
              </h2>
              <p data-r={2} className="mt-5 text-[15px] leading-relaxed text-bone/65 md:text-base">
                Una bisagra de tres nudillos y una leva de acero sostienen la tapa. El pulgar la levanta; el sonido lo
                confirma.
              </p>
            </div>
          </div>
        </section>

        {/* 02 · Despiece */}
        <section id={ACTS[2].id} style={{ height: `${ACTS[2].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col justify-between px-5 pt-[calc(5rem+env(safe-area-inset-top,0px))] pb-10 md:px-12 md:pt-28 md:pb-14">
            <div className="max-w-xs md:max-w-sm">
              <Kicker n="02" r={0}>
                Despiece
              </Kicker>
              <h2 data-r={1} className="font-display text-4xl leading-[0.95] md:text-6xl">
                Ocho piezas. Ninguna de sobra.
              </h2>
              <p data-r={2} className="mt-4 hidden max-w-[20rem] text-[15px] leading-relaxed text-bone/65 md:block">
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
            <div data-r={3}>
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

        {/* 03 · Órbita */}
        <section id={ACTS[3].id} style={{ height: `${ACTS[3].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col items-start justify-end px-5 pb-12 md:items-end md:justify-center md:px-12 md:pb-0">
            <div className="scrim max-w-md">
              <Kicker n="03" r={0}>
                Órbita
              </Kicker>
              <h2 data-r={1} className="font-display text-5xl leading-[0.95] md:text-7xl">
                Negro mate, cantos pulidos.
              </h2>
              <p data-r={2} className="mt-5 text-[15px] leading-relaxed text-bone/65 md:text-base">
                La carcasa lleva un recubrimiento DLC negro que se traga la luz. Un chaflán de 0,6 mm pulido a espejo
                dibuja el contorno cuando la luz lo roza.
              </p>
            </div>
          </div>
        </section>

        {/* 04 · Detalle */}
        <section id={ACTS[4].id} style={{ height: `${ACTS[4].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col justify-end px-5 pb-12 md:px-12 md:pb-16">
            <div className="scrim max-w-md">
              <Kicker n="04" r={0}>
                Detalle
              </Kicker>
              <h2 data-r={1} className="font-display text-5xl leading-[0.95] md:text-7xl">
                Treinta y seis dientes.
              </h2>
              <p data-r={2} className="mt-5 text-[15px] leading-relaxed text-bone/65 md:text-base">
                Rueda de acero templado contra piedra de ferrocerio. Cada giro arranca chispas a unos 3.000 °C.
              </p>
            </div>
          </div>
        </section>

        {/* 05 · Encender */}
        <section id={ACTS[5].id} style={{ height: `${ACTS[5].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col justify-end px-5 pb-12 md:justify-center md:px-12 md:pb-0">
            <div className="scrim max-w-md">
              <Kicker n="05" r={0}>
                Encender
              </Kicker>
              <h2 data-r={1} className="font-display text-5xl leading-[0.95] md:text-7xl">
                Tu turno.
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

        {/* 06 · Cierre y compra */}
        <section id={ACTS[6].id} style={{ height: `${ACTS[6].vh}vh` }}>
          <div className="sticky top-0 flex h-svh flex-col items-start justify-end px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] md:items-end md:justify-center md:px-12 md:pb-0">
            <div className="scrim w-full max-w-sm">
              <Kicker n="06" r={0}>
                Cierre
              </Kicker>
              <h2 data-r={1} className="font-display text-6xl leading-[0.92] md:text-8xl">
                ASCUA
                <br />
                <em>Negro.</em>
              </h2>
              <dl data-r={2} className="mt-6 grid grid-cols-3 gap-4 border-t border-bone/10 pt-4 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-mute">Medidas</dt>
                  <dd className="mt-1 tabular-nums">38×13×57 mm</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-mute">Peso</dt>
                  <dd className="mt-1 tabular-nums">58 g</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.18em] text-mute">Acabado</dt>
                  <dd className="mt-1">DLC mate</dd>
                </div>
              </dl>
              <div data-r={3} className="mt-7 flex items-center gap-4">
                <button
                  type="button"
                  onClick={openSheet}
                  className="h-12 flex-1 rounded-full bg-ember text-sm font-medium text-ink transition-[scale,filter] duration-150 ease-out hover:brightness-110 active:scale-[0.98]"
                >
                  Comprar · {formatEur(PRICE)}
                </button>
              </div>
              <p data-r={4} className="mt-3 text-xs text-mute">
                Producto conceptual: la compra es una demostración y no se cobra nada.
              </p>
            </div>
          </div>
        </section>

        <footer className="relative z-10 flex flex-col gap-2 border-t border-bone/10 bg-ink px-5 py-10 text-xs text-mute md:flex-row md:justify-between md:px-12">
          <span className="font-display text-base tracking-[0.28em] text-bone">ASCUA</span>
          <span>Producto conceptual creado como demostración. Modelo 3D y sonido generados en código.</span>
        </footer>
      </main>

      <BuySheet open={sheet} onClose={closeSheet} />
    </div>
  );
}
