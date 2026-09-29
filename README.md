# ASCUA — Fuego de bolsillo

Landing _scroll-cinema_ de un producto conceptual: **ASCUA Negro**, un mechero de acero con acabado negro mate.
El producto nunca sale de pantalla y se mueve con el scroll (hacia abajo avanza, hacia arriba rebobina).

Todo está hecho en código, sin imágenes ni vídeos: el mechero es geometría procedural en three.js y el sonido se sintetiza con Web Audio.

## Guion

| Escena | Qué pasa |
| --- | --- |
| 00 · Hero | El mechero cerrado, pequeño, en un estudio negro. |
| 01 · Apertura | La tapa se abre sobre la bisagra con un _clinc_. |
| 02 · Despiece | Ocho piezas se separan con etiquetas y líneas guía; botón «Ver plano». |
| 03 · Órbita | Vuelta completa para enseñar el negro mate y los chaflanes pulidos. |
| 04 · Detalle | Macro de la rueda a cámara lenta, con chispas. |
| 05 · Encender | Mantén pulsado: gira la rueda, saltan chispas y prende la llama. En móvil, la llama sigue la inclinación. |
| 06 · Cierre | La tapa se cierra (apaga la llama) y aparece la compra de demostración. |

La compra es una demostración: no pide datos de pago ni cobra nada.

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
- `components/HoldButton.tsx`, `components/BuySheet.tsx` — mantener para encender y hoja de compra.
- `lib/ascua/spec.ts` — medidas reales en mm.
- `lib/ascua/geometry.ts`, `lighter.ts` — geometría procedural (barrido de perfiles, torno, extrusión con chaflán) y despiece.
- `lib/ascua/materials.ts` — texturas generadas en código (granallado, grabado láser, cepillado, mecha).
- `lib/ascua/effects.ts` — estudio de luz horneado con PMREM, suelo reflectante, llama, chispas y grano.
- `lib/ascua/cues.ts` — guion de cámara anclado a las secciones.
- `lib/ascua/engine.ts` — motor: un solo reloj, cámara amortiguada, post-proceso y calidad adaptativa.
- `lib/ascua/sound.ts` — sonido sintetizado (tapa, rueda, ignición y llama).

## Rendimiento

MSAA HDR → bloom → ACES → grano. En móvil el DPR se limita a 1,75; si no llega a 40 fps, baja resolución, luego quita el
bloom y por último el reflejo del suelo. Con `prefers-reduced-motion` se desactivan el balanceo y la cámara lenta.
