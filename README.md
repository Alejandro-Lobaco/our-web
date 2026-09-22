# NeWeb

Web propia de NeWeb (venta de webs hechas con IA).

## Estado actual

Este repo arrancó reconstruyendo, a partir de capturas de pantalla, la demo de presentación que hizo el equipo (`web-negocios-presentacion.vercel.app`), ya que esa URL no era accesible desde el entorno de desarrollo. Es HTML/CSS/JS estático, sin build, para poder iterar rápido en UX/UI.

Si se dispone del código fuente original (zip/repo del proyecto real), debería sustituir a esta reconstrucción para no mantener dos versiones divergentes.

Desde la reconstrucción inicial se ha añadido:
- Rebrand a **NeWeb**.
- Animaciones de entrada (hero) y de aparición al hacer scroll (`data-reveal` + `IntersectionObserver`) en el resto de secciones, con `prefers-reduced-motion` respetado.
- Sección **Portfolio** con ejemplos de webs ya diseñadas por sector (peluquería, fisioterapia, clínica veterinaria).

## Estructura

- `index.html` — toda la landing (header, hero, qué incluye, portfolio, planes, equipo, contacto)
- `css/styles.css` — estilos y animaciones
- `js/main.js` — reveal on scroll + shadow del header al hacer scroll

## Desarrollo local

Al ser estático, basta con abrir `index.html` en el navegador o servirlo con cualquier servidor estático (por ejemplo `npx serve .`).

## Despliegue

Compatible con Vercel sin configuración adicional (proyecto estático).
