import type { Fix, LatLon } from '../types';
import { angleDiff, snapToLine } from '../geo/geo';

const SNAP_MAX_M = 30;
const SNAP_MAX_ANGLE = 60;
const MOVING_MPS = 1.5;

/** Gruda o fix na rota só quando o sentido de marcha concorda com ela; senão devolve o fix intacto. */
export function snapToRoute(
  fix: Fix,
  heading: number | null,
  line: LatLon[] | null,
): { fix: Fix; heading: number | null } {
  const snap = line ? snapToLine(fix, line) : null;
  if (!snap || snap.distance > SNAP_MAX_M) return { fix, heading };
  if (heading !== null && angleDiff(heading, snap.bearing) >= SNAP_MAX_ANGLE) return { fix, heading };
  const moving = fix.speed === null || fix.speed >= MOVING_MPS;
  return {
    fix: { ...fix, lat: snap.point.lat, lon: snap.point.lon },
    heading: moving ? snap.bearing : heading,
  };
}
