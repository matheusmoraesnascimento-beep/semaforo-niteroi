import type { Fix } from '../types';

export interface PositionLike {
  timestamp: number;
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    heading?: number | null;
    speed?: number | null;
  };
}

const finiteOrNull = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function positionToFix(p: PositionLike): Fix {
  return {
    lat: p.coords.latitude,
    lon: p.coords.longitude,
    accuracy: p.coords.accuracy,
    heading: finiteOrNull(p.coords.heading),
    speed: finiteOrNull(p.coords.speed),
    timestamp: p.timestamp,
  };
}
