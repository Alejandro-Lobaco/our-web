import type { Label } from "./lighter";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Etiquetas del despiece: se proyectan a pantalla y se ordenan en dos
 * columnas con líneas guía. Todo el DOM se toca aquí, sin React por frame.
 */
export class LabelLayer {
  private svg: SVGSVGElement;
  private lines: SVGLineElement[] = [];
  private dots: SVGCircleElement[] = [];
  private boxes: HTMLDivElement[] = [];
  private visible = false;

  constructor(
    private root: HTMLElement,
    labels: Label[],
  ) {
    root.replaceChildren();
    this.svg = document.createElementNS(SVG_NS, "svg");
    this.svg.setAttribute("class", "absolute inset-0 h-full w-full overflow-visible");
    root.appendChild(this.svg);
    for (const l of labels) {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("stroke", "rgba(236,232,225,0.35)");
      line.setAttribute("stroke-width", "1");
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("r", "2.5");
      dot.setAttribute("fill", "#ff9a3c");
      this.svg.append(line, dot);
      this.lines.push(line);
      this.dots.push(dot);
      const box = document.createElement("div");
      box.className = "ascua-label";
      const t = document.createElement("span");
      t.className = "ascua-label-title";
      t.textContent = l.title;
      const s = document.createElement("span");
      s.className = "ascua-label-spec";
      s.textContent = l.spec;
      box.append(t, s);
      root.appendChild(box);
      this.boxes.push(box);
    }
    root.style.opacity = "0";
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.root.style.opacity = "0";
  }

  update(points: ScreenPoint[], centerX: number, w: number, h: number, opacity: number, mobile: boolean) {
    if (opacity < 0.01) {
      this.hide();
      return;
    }
    this.visible = true;
    this.root.style.opacity = opacity.toFixed(3);

    const gap = mobile ? Math.min(w * 0.25, 120) : Math.min(290, w * 0.19);
    const minSpace = mobile ? 26 : 46;
    const margin = mobile ? 90 : 80;
    const cols: { i: number; y: number }[][] = [[], []];
    points.forEach((p, i) => cols[p.x < centerX ? 0 : 1].push({ i, y: p.y }));

    cols.forEach((col, side) => {
      col.sort((a, b) => a.y - b.y);
      for (let k = 0; k < col.length; k++) {
        col[k].y = Math.max(col[k].y, margin);
        if (k > 0) col[k].y = Math.max(col[k].y, col[k - 1].y + minSpace);
      }
      const overflow = col.length ? col[col.length - 1].y - (h - margin) : 0;
      if (overflow > 0) for (const c of col) c.y -= overflow;

      for (const { i, y } of col) {
        const p = points[i];
        const left = side === 0;
        const lx = Math.round(left ? Math.max(12, centerX - gap) : Math.min(w - 12, centerX + gap));
        const box = this.boxes[i];
        box.style.transform = `translate3d(${lx}px, ${Math.round(y)}px, 0) translate(${left ? "-100%" : "0"}, -50%)`;
        box.style.textAlign = left ? "right" : "left";
        const ex = lx + (left ? 8 : -8);
        this.lines[i].setAttribute("x1", p.x.toFixed(1));
        this.lines[i].setAttribute("y1", p.y.toFixed(1));
        this.lines[i].setAttribute("x2", ex.toFixed(1));
        this.lines[i].setAttribute("y2", y.toFixed(1));
        this.dots[i].setAttribute("cx", p.x.toFixed(1));
        this.dots[i].setAttribute("cy", p.y.toFixed(1));
      }
    });
  }
}
