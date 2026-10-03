import type { LatLon, RoadSegment } from '../types';
import { angleDiff, normalizeBearing, pointToSegment } from '../geo/geo';

export const MATCH_DEFAULTS = { maxDistance: 25, anglePenalty: 0.5, hysteresis: 5 };

export interface RoadMatch {
  segment: RoadSegment;
  distance: number;
  segmentBearing: number; // bearing do sub-trecho na ordem da geometria
  cost: number;
}

function bestForSegment(
  pos: LatLon,
  heading: number | null,
  seg: RoadSegment,
  opts: typeof MATCH_DEFAULTS,
): RoadMatch | null {
  let best: RoadMatch | null = null;
  for (let i = 0; i < seg.coords.length - 1; i++) {
    const r = pointToSegment(pos, seg.coords[i], seg.coords[i + 1]);
    if (r.distance > opts.maxDistance) continue;
    const align = heading === null ? 0 : Math.min(angleDiff(heading, r.bearing), angleDiff(heading, r.bearing + 180));
    const cost = r.distance + opts.anglePenalty * align;
    if (!best || cost < best.cost) best = { segment: seg, distance: r.distance, segmentBearing: r.bearing, cost };
  }
  return best;
}

export function matchRoad(
  pos: LatLon,
  heading: number | null,
  segments: RoadSegment[],
  prevId: string | null = null,
  opts = MATCH_DEFAULTS,
): RoadMatch | null {
  let best: RoadMatch | null = null;
  let prev: RoadMatch | null = null;
  for (const seg of segments) {
    const m = bestForSegment(pos, heading, seg, opts);
    if (!m) continue;
    if (!best || m.cost < best.cost) best = m;
    if (prevId !== null && seg.id === prevId && (!prev || m.cost < prev.cost)) prev = m;
  }
  if (prev && best && best !== prev && best.cost > prev.cost - opts.hysteresis) return prev;
  return best;
}

/** Sentido permitido (graus) numa via de mão única; null se mão dupla. */
export function allowedBearing(m: RoadMatch): number | null {
  if (m.segment.oneway === 1) return m.segmentBearing;
  if (m.segment.oneway === -1) return normalizeBearing(m.segmentBearing + 180);
  return null;
}

export function nearestName(pos: LatLon, segments: RoadSegment[], maxDistance = 15): string | null {
  let best: { d: number; name: string } | null = null;
  for (const seg of segments) {
    if (!seg.name) continue;
    for (let i = 0; i < seg.coords.length - 1; i++) {
      const d = pointToSegment(pos, seg.coords[i], seg.coords[i + 1]).distance;
      if (d <= maxDistance && (!best || d < best.d)) best = { d, name: seg.name };
    }
  }
  return best?.name ?? null;
}
