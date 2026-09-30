# ASCUA — Fuego de bolsillo

Landing _scroll-cinema_ de un producto conceptual: **ASCUA Negro**, un mechero de acero con acabado negro mate.
El producto nunca sale de pantalla y se mueve con el scroll (hacia abajo avanza, hacia arriba rebobina).

Todo está hecho en código, sin imágenes ni vídeos: el mechero es geometría procedural en three.js y el sonido se sintetiza con Web Audio.

## Guion

| Escena | Qué pasa |
| --- | --- |
| 00 · Hero | Intro al cargar: la tapa salta, la rueda chispea y prende la llama. Rótulo gigante en 3D detrás y brasas en el aire. |
| 01 · Despiece | Ocho piezas se separan con etiquetas y líneas guía; botón «Ver plano». |
| 02 · Material | Remontaje y órbita lenta; cifras que cuentan al aparecer. |
| 03 · Detalle | La órbita sigue hasta la macro de la rueda: chispas a cámara lenta. |
| 04 · Encender | Mantén pulsado: gira la rueda, saltan chispas y prende la llama. En móvil, la llama sigue la inclinación. |
| 05 · Tu ASCUA | La tapa se cierra; eliges acabado (Negro, Acero, Latón) y el 3D cambia en vivo. Compra de demostración. |
| Detrás de la escena | Cómo está hecho: modelo procedural, estudio de luz, sonido sintetizado. |

La compra es una demostración: no pide datos de pago ni cobra nada.

**Ritmo del scroll.** Lenis suaviza la rueda del ratón; cada acto se asienta hacia el 20 % de su sección, aguanta mientras
se lee y sale a partir del 60 %, y ninguna transición ocupa menos de ~1,5 pantallas. La cámara sigue al scroll con
amortiguación y un tope de velocidad; los saltos del menú a actos lejanos hacen un corte a negro.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de producción
npm run typecheck
```

Para depurar un plano concreto, `/?t=2.7` congela la línea de tiempo (parte entera = escena, decimal = avance) y
`window.__ascua` expone el motor en la consola.

## Estructura

- `app/` — layout, fuentes (Instrument Serif + Inter) y estilos globales (Tailwind 4).
- `components/Experience.tsx` — página: secciones, revelados guiados por scroll, navegación y conexión con el motor.
- `components/HoldButton.tsx`, `components/BuySheet.tsx`, `components/FinishPicker.tsx` — mantener para encender, hoja de compra y selector de acabado.
- `components/Credits.tsx` — «Detrás de la escena» y pie.
- `lib/content.ts` — actos, acabados y precios.
- `lib/ascua/spec.ts` — medidas reales en mm.
- `lib/ascua/geometry.ts`, `lighter.ts` — geometría procedural (barrido de perfiles, torno, extrusión con chaflán) y despiece.
- `lib/ascua/materials.ts` — texturas generadas en código (granallado, grabado láser, cepillado, mecha).
- `lib/ascua/effects.ts` — estudio de luz horneado con PMREM, suelo reflectante, llama, chispas, brasas, rótulo 3D y grano.
- `lib/ascua/cues.ts` — guion de cámara anclado a las secciones.
- `lib/ascua/engine.ts` — motor: un solo reloj, cámara amortiguada, post-proceso y calidad adaptativa.
- `lib/ascua/sound.ts` — sonido sintetizado (tapa, rueda, ignición y llama).

## Rendimiento

MSAA HDR → bloom → ACES → grano. En móvil el DPR se limita a 1,75; si no llega a 40 fps, baja resolución, luego quita el
bloom y por último el reflejo del suelo. Con `prefers-reduced-motion` se desactivan el balanceo y la cámara lenta.
