// Map geometry helpers. All coordinates come from data/lebanon-map.json (real geoBoundaries
// outline and GeoNames city positions); nothing here invents a location.
import map from "../data/lebanon-map.json";

export const view = { x: -20, y: 16, width: 640, height: 650 };
const { scale, translate } = map.projection;
const rad = Math.PI / 180;

export function project(longitude: number, latitude: number): [number, number] {
  return [
    translate[0] + scale * longitude * rad,
    translate[1] - scale * Math.log(Math.tan(Math.PI / 4 + (latitude * rad) / 2)),
  ];
}

export function unproject(x: number, y: number): [number, number] {
  const longitude = (x - translate[0]) / scale / rad;
  const latitude =
    (2 * Math.atan(Math.exp((translate[1] - y) / scale)) - Math.PI / 2) / rad;
  return [longitude, latitude];
}

export function formatCoordinate(longitude: number, latitude: number) {
  return `${latitude.toFixed(2)}°N ${longitude.toFixed(2)}°E`;
}

// Rounded so server and browser (different Math.log/tan implementations) render identical markup.
const round = (value: number) => Math.round(value * 100) / 100;
export const graticule = (() => {
  const meridians = [35, 35.5, 36, 36.5].map((longitude) => ({
    label: `${longitude}°E`,
    x: round(project(longitude, 34)[0]),
  }));
  const parallels = [33, 33.5, 34, 34.5].map((latitude) => ({
    label: `${latitude}°N`,
    y: round(project(35.5, latitude)[1]),
  }));
  return { meridians, parallels };
})();

export type Point = { x: number; y: number };
export type Link = { id: string; from: string; to: string; d: string; length: number };

const byName = new Map(map.cities.map((city) => [city.name, city]));
export const cityPoint = (name: string): Point | null => {
  const city = byName.get(name);
  return city ? { x: city.x, y: city.y } : null;
};

/**
 * Connects each newly selected city to its nearest already-selected city. The result is a tree
 * (n - 1 gentle curves) rather than a web, so it stays tidy however many cities are chosen.
 */
export function buildLinks(selected: string[]): Link[] {
  const links: Link[] = [];
  selected.forEach((name, index) => {
    const here = cityPoint(name);
    if (!here || index === 0) return;
    let best: { name: string; point: Point; distance: number } | null = null;
    for (const other of selected.slice(0, index)) {
      const point = cityPoint(other);
      if (!point) continue;
      const distance = Math.hypot(point.x - here.x, point.y - here.y);
      if (!best || distance < best.distance) best = { name: other, point, distance };
    }
    if (!best) return;
    const mx = (best.point.x + here.x) / 2;
    const my = (best.point.y + here.y) / 2;
    const dx = here.x - best.point.x;
    const dy = here.y - best.point.y;
    // Bend toward the east so curves read as a deliberate arc, never a straight ruler line.
    let nx = -dy;
    let ny = dx;
    if (nx < 0) {
      nx = -nx;
      ny = -ny;
    }
    const length = Math.hypot(dx, dy) || 1;
    const bend = Math.min(34, length * 0.2);
    const cx = mx + (nx / length) * bend;
    const cy = my + (ny / length) * bend;
    links.push({
      id: `${best.name}>${name}`,
      from: best.name,
      to: name,
      d: `M${best.point.x} ${best.point.y}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${here.x} ${here.y}`,
      length,
    });
  });
  return links;
}

/**
 * A deliberately gentle camera: a small zoom that drifts only halfway toward the selection, so
 * every other city stays on screen and easy to add. Users can still zoom and pan freely.
 */
export function frameCities(selected: string[]) {
  const home = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
  const points = selected.map(cityPoint).filter(Boolean) as Point[];
  if (!points.length) return { scale: 1, ...home };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const drift = { x: home.x + (centre.x - home.x) * 0.5, y: home.y + (centre.y - home.y) * 0.5 };
  if (points.length === 1) return { scale: 1.18, ...drift };
  const spread = Math.max(maxX - minX, maxY - minY);
  // The tighter the selection, the closer we look, but never past 1.3x.
  const scale = spread < 120 ? 1.3 : spread < 240 ? 1.15 : 1;
  return { scale, ...drift };
}
