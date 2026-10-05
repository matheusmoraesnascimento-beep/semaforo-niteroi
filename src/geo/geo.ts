import type { LatLon } from '../types';

export const EARTH_RADIUS_M = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function normalizeBearing(b: number): number {
  return ((b % 360) + 360) % 360;
}

export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: LatLon, b: LatLon): number {
  const p1 = toRad(a.lat);
  const p2 = toRad(b.lat);
  const dl = toRad(b.lon - a.lon);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return normalizeBearing(toDeg(Math.atan2(y, x)));
}

/** Menor diferença entre dois ângulos, 0–180. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(normalizeBearing(a) - normalizeBearing(b));
  return d > 180 ? 360 - d : d;
}

export function destination(from: LatLon, bearing: number, distM: number): LatLon {
  const d = distM / EARTH_RADIUS_M;
  const t = toRad(bearing);
  const p1 = toRad(from.lat);
  const l1 = toRad(from.lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { lat: toDeg(p2), lon: toDeg(l2) };
}

/** Anel fechado [lon, lat] aproximando um círculo. */
export function circlePolygon(center: LatLon, radiusM: number, steps = 32): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const p = destination(center, (i * 360) / steps, radiusM);
    ring.push([p.lon, p.lat]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

/**
 * Distância (m) do ponto p ao segmento a→b ([lon, lat]) e bearing do segmento a→b.
 * Projeção equirretangular local — precisa para distâncias de dezenas/centenas de metros.
 */
export function pointToSegment(
  p: LatLon,
  a: [number, number],
  b: [number, number],
): { distance: number; bearing: number } {
  const cosLat = Math.cos(toRad(p.lat));
  const proj = (c: [number, number]) => ({
    x: toRad(c[0] - p.lon) * cosLat * EARTH_RADIUS_M,
    y: toRad(c[1] - p.lat) * EARTH_RADIUS_M,
  });
  const A = proj(a);
  const B = proj(b);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : -(A.x * dx + A.y * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const distance = Math.hypot(A.x + t * dx, A.y + t * dy);
  const bearing = bearingDeg({ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] });
  return { distance, bearing };
}

export interface LineSnap {
  point: LatLon;
  distance: number;
  bearing: number;
}

/** Ponto mais próximo de `p` sobre a polilinha, com distância (m) e bearing do trecho. */
export function snapToLine(p: LatLon, line: LatLon[]): LineSnap | null {
  const cosLat = Math.cos(toRad(p.lat));
  let best: LineSnap | null = null;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const ax = toRad(a.lon - p.lon) * cosLat * EARTH_RADIUS_M;
    const ay = toRad(a.lat - p.lat) * EARTH_RADIUS_M;
    const dx = toRad(b.lon - a.lon) * cosLat * EARTH_RADIUS_M;
    const dy = toRad(b.lat - a.lat) * EARTH_RADIUS_M;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const distance = Math.hypot(ax + t * dx, ay + t * dy);
    if (!best || distance < best.distance) {
      best = {
        point: { lat: a.lat + t * (b.lat - a.lat), lon: a.lon + t * (b.lon - a.lon) },
        distance,
        bearing: bearingDeg(a, b),
      };
    }
  }
  return best;
}

/** Aproxima `from` de `to` pelo caminho mais curto, `k` entre 0 e 1. */
export function lerpAngle(from: number, to: number, k: number): number {
  const d = ((to - from + 540) % 360) - 180;
  return normalizeBearing(from + d * k);
}
