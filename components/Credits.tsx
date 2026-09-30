const PILLARS = [
  {
    n: "01",
    title: "Modelo procedural",
    body: "Ocho piezas modeladas en código a partir de medidas reales en milímetros: perfiles barridos, torno y extrusiones con chaflán. Sin archivos 3D.",
  },
  {
    n: "02",
    title: "Estudio de luz",
    body: "Softbox, tiras laterales y un rim ámbar horneados en un mapa de entorno. Suelo reflectante, bloom HDR, tono ACES y grano de película.",
  },
  {
    n: "03",
    title: "Sonido sintetizado",
    body: "El clic de la tapa, la rueda contra la piedra y el rumor de la llama se generan en el navegador con Web Audio. Nada se descarga.",
  },
];

const STACK = ["Next.js", "React", "three.js", "Tailwind CSS", "Web Audio", "Lenis"];

const FIGURES = [
  { v: "0", l: "imágenes" },
  { v: "0", l: "vídeos" },
  { v: "1", l: "canvas" },
];

/** Detrás de la escena: cómo está hecha la pieza (para el portfolio). */
export default function Credits({ onTop }: { onTop: (e: React.MouseEvent) => void }) {
  return (
    <section
      id="como-esta-hecho"
      aria-labelledby="credits-title"
      className="relative z-10 bg-gradient-to-b from-transparent via-ink/95 to-ink pt-40 md:pt-56"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-12">
        <p className="mb-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-ember">
          Detrás de la escena
          <span className="h-px w-6 bg-ember/50" aria-hidden />
        </p>
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-end">
          <h2 id="credits-title" className="font-display text-5xl leading-[0.95] md:text-7xl">
            Un producto que no existe, <em className="text-bone/70">hecho solo con código.</em>
          </h2>
          <dl className="grid grid-cols-3 gap-4 border-t border-bone/10 pt-5">
            {FIGURES.map((f) => (
              <div key={f.l}>
                <dt className="sr-only">{f.l}</dt>
                <dd>
                  <span className="block font-display text-5xl leading-none md:text-6xl">{f.v}</span>
                  <span className="mt-2 block text-xs text-mute">{f.l}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-bone/10 bg-bone/10 md:grid-cols-3">
          {PILLARS.map((p) => (
            <article key={p.n} className="bg-[#0b0b0d] p-6 md:p-8">
              <p className="text-xs tabular-nums text-ember">{p.n}</p>
              <h3 className="mt-6 font-display text-3xl">{p.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-bone/60">{p.body}</p>
            </article>
          ))}
        </div>

        <ul className="mt-8 flex flex-wrap gap-2" aria-label="Tecnologías">
          {STACK.map((s) => (
            <li key={s} className="rounded-full border border-bone/15 px-3 py-1.5 text-xs text-bone/70">
              {s}
            </li>
          ))}
        </ul>
      </div>

      <footer className="mx-auto mt-24 flex max-w-6xl flex-col gap-6 border-t border-bone/10 px-5 py-10 text-xs text-mute md:flex-row md:items-center md:justify-between md:px-12">
        <div className="flex items-center gap-4">
          <span className="font-display text-lg tracking-[0.28em] text-bone">ASCUA</span>
          <span>Concepto, diseño 3D y desarrollo · Alejandro Lobaco · 2026</span>
        </div>
        <div className="flex items-center gap-6">
          <span>Producto conceptual. La compra es una demostración.</span>
          <a href="#inicio" onClick={onTop} className="text-bone/80 transition-colors hover:text-bone">
            Volver arriba ↑
          </a>
        </div>
      </footer>
    </section>
  );
}
