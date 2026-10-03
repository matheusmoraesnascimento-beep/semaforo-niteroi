import type { LatLon, NextResult, TrafficLight } from '../types';
import { angleDiff, bearingDeg, distanceM } from '../geo/geo';

export const NEAREST_DEFAULTS = {
  maxDistance: 500,
  aheadTolerance: 35,
  approachTolerance: 45,
  closeRange: 25,
  hysteresis: 20,
};

export function findNextTrafficLight(
  pos: LatLon,
  heading: number | null,
  lights: TrafficLight[],
  prevId: string | null = null,
  opts = NEAREST_DEFAULTS,
): NextResult {
  if (heading === null) return { kind: 'no-heading' };

  const candidates = lights
    .map((light) => ({ light, distance: distanceM(pos, light) }))
    .filter(({ light, distance }) => {
      if (distance > opts.maxDistance) return false;
      if (angleDiff(heading, light.approachBearing) > opts.approachTolerance) return false;
      if (distance < opts.closeRange) return true;
      return angleDiff(heading, bearingDeg(pos, light)) <= opts.aheadTolerance;
    })
    .sort((a, b) => a.distance - b.distance);

  if (candidates.length === 0) return { kind: 'none' };

  const best = candidates[0];
  const prev = prevId === null ? undefined : candidates.find((c) => c.light.id === prevId);
  if (prev && prev !== best && best.distance > prev.distance - opts.hysteresis) {
    return { kind: 'found', light: prev.light, distance: prev.distance };
  }
  return { kind: 'found', light: best.light, distance: best.distance };
}
