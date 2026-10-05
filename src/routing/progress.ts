import type { LatLon } from '../types';
import { distanceM, snapToLine } from '../geo/geo';

function lineLength(line: LatLon[], from = 0): number {
  let sum = 0;
  for (let i = from; i < line.length - 1; i++) sum += distanceM(line[i], line[i + 1]);
  return sum;
}

/** Distância e tempo que faltam, proporcionais ao trecho restante da linha da rota. */
export function remainingOnRoute(
  line: LatLon[],
  pos: LatLon,
  totalDistanceM: number,
  totalDurationS: number,
): { distanceM: number; durationS: number } {
  const total = lineLength(line);
  const snap = snapToLine(pos, line);
  if (!snap || total === 0) return { distanceM: totalDistanceM, durationS: totalDurationS };
  const left = distanceM(snap.point, line[snap.segment + 1]) + lineLength(line, snap.segment + 1);
  const fraction = Math.min(1, left / total);
  return { distanceM: totalDistanceM * fraction, durationS: totalDurationS * fraction };
}
