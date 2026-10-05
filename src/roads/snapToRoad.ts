import type { Fix } from '../types';
import { snapToLine } from '../geo/geo';

const MIN_RADIUS_M = 25;
const MAX_RADIUS_M = 40;

/** Raio de casamento para exibição: acompanha a imprecisão do GPS, limitado ao raio de busca de vias. */
export function looseRadius(accuracy: number): number {
  return Math.min(Math.max(accuracy, MIN_RADIUS_M), MAX_RADIUS_M);
}

/** Projeta o fix sobre a via casada ([lon, lat]); só para exibição. */
export function snapFixToSegment(fix: Fix, coords: [number, number][]): Fix {
  const snap = snapToLine(fix, coords.map(([lon, lat]) => ({ lat, lon })));
  return snap ? { ...fix, lat: snap.point.lat, lon: snap.point.lon } : fix;
}
