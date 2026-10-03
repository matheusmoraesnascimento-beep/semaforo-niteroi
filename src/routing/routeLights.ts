import type { LatLon, TrafficLight } from '../types';
import { angleDiff, distanceM, pointToSegment } from '../geo/geo';

export const ROUTE_LIGHT_DEFAULTS = {
  maxOffsetM: 25,
  bearingToleranceDeg: 45,
};

// pré-filtro barato por caixa (~55 m): evita a trigonometria em segmentos distantes
const BBOX_MARGIN_DEG = 0.0005;

export interface RouteLight {
  light: TrafficLight;
  alongM: number;
}

/**
 * Semáforos que pertencem à rota: a no máximo `maxOffsetM` da linha e com o sentido
 * da rota (no segmento) próximo do `approachBearing`. Ordenados pelo percurso.
 */
export function lightsOnRoute(
  line: LatLon[],
  lights: TrafficLight[],
  opts = ROUTE_LIGHT_DEFAULTS,
): RouteLight[] {
  if (line.length < 2) return [];

  const cum: number[] = [0];
  for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + distanceM(line[i - 1], line[i]));

  const result: RouteLight[] = [];
  for (const light of lights) {
    let best: { distance: number; alongM: number } | null = null;
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      if (
        light.lat < Math.min(a.lat, b.lat) - BBOX_MARGIN_DEG ||
        light.lat > Math.max(a.lat, b.lat) + BBOX_MARGIN_DEG ||
        light.lon < Math.min(a.lon, b.lon) - BBOX_MARGIN_DEG ||
        light.lon > Math.max(a.lon, b.lon) + BBOX_MARGIN_DEG
      ) {
        continue;
      }
      const { distance, bearing } = pointToSegment(light, [a.lon, a.lat], [b.lon, b.lat]);
      if (distance > opts.maxOffsetM) continue;
      if (angleDiff(bearing, light.approachBearing) > opts.bearingToleranceDeg) continue;
      if (!best || distance < best.distance) {
        best = { distance, alongM: cum[i] + Math.min(distanceM(a, b), distanceM(a, light)) };
      }
    }
    if (best) result.push({ light, alongM: best.alongM });
  }
  return result.sort((x, y) => x.alongM - y.alongM);
}
