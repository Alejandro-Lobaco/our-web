# our-web

Web propia de "Webs para negocios" (venta de webs hechas con IA).

## Estado actual

Este repo arrancó reconstruyendo, a partir de capturas de pantalla, la demo de presentación que hizo el equipo (`web-negocios-presentacion.vercel.app`), ya que esa URL no era accesible desde el entorno de desarrollo. Es HTML/CSS/JS estático, sin build, para poder iterar rápido en UX/UI.

Si se dispone del código fuente original (zip/repo del proyecto real), debería sustituir a esta reconstrucción para no mantener dos versiones divergentes.

## Estructura

- `index.html` — toda la landing (header, hero, qué incluye, planes, equipo, contacto)
- `css/styles.css` — estilos
- `js/main.js` — JS mínimo

## Desarrollo local

Al ser estático, basta con abrir `index.html` en el navegador o servirlo con cualquier servidor estático (por ejemplo `npx serve .`).

## Despliegue

Compatible con Vercel sin configuración adicional (proyecto estático).
