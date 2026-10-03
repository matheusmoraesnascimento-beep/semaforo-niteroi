import type { LatLon } from '../types';
import { pointToSegment } from '../geo/geo';

export const OFF_ROUTE_DEFAULTS = { maxM: 50, holdMs: 5000 };

/** Menor distância (m) da posição até a linha da rota. */
export function distanceToRoute(pos: LatLon, line: LatLon[]): number {
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const { distance } = pointToSegment(pos, [line[i].lon, line[i].lat], [line[i + 1].lon, line[i + 1].lat]);
    if (distance < min) min = distance;
  }
  return min;
}

/** Dispara quando a distância fica acima de `maxM` por `holdMs` seguidos. */
export class OffRouteDetector {
  private since: number | null = null;
  private maxM: number;
  private holdMs: number;

  constructor(maxM = OFF_ROUTE_DEFAULTS.maxM, holdMs = OFF_ROUTE_DEFAULTS.holdMs) {
    this.maxM = maxM;
    this.holdMs = holdMs;
  }

  update(distanceM: number, nowMs: number): boolean {
    if (distanceM <= this.maxM) {
      this.since = null;
      return false;
    }
    if (this.since === null) {
      this.since = nowMs;
      return false;
    }
    if (nowMs - this.since >= this.holdMs) {
      this.since = null;
      return true;
    }
    return false;
  }

  reset(): void {
    this.since = null;
  }
}
