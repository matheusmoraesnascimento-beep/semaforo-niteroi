import { describe, it, expect } from 'vitest';
import {
  angleDiff, bearingDeg, circlePolygon, destination, distanceM, normalizeBearing, pointToSegment,
} from './geo';

const O = { lat: -22.9, lon: -43.1 };

describe('distanceM', () => {
  it('1 grau de latitude ≈ 111.195 m', () => {
    expect(distanceM(O, { lat: -21.9, lon: -43.1 })).toBeCloseTo(111195, -2);
  });
  it('mesmo ponto = 0', () => {
    expect(distanceM(O, O)).toBe(0);
  });
});

describe('bearingDeg', () => {
  it('norte = 0', () => expect(bearingDeg(O, { lat: -22.8, lon: -43.1 })).toBeCloseTo(0, 6));
  it('sul = 180', () => expect(bearingDeg(O, { lat: -23.0, lon: -43.1 })).toBeCloseTo(180, 6));
  it('leste ≈ 90', () => expect(Math.abs(bearingDeg(O, { lat: -22.9, lon: -43.0 }) - 90)).toBeLessThan(0.1));
  it('oeste ≈ 270', () => expect(Math.abs(bearingDeg(O, { lat: -22.9, lon: -43.2 }) - 270)).toBeLessThan(0.1));
});

describe('normalizeBearing / angleDiff', () => {
  it('normaliza negativos e > 360', () => {
    expect(normalizeBearing(-90)).toBe(270);
    expect(normalizeBearing(370)).toBe(10);
  });
  it('diferença com wrap', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(0, 180)).toBe(180);
    expect(angleDiff(-90, 270)).toBe(0);
  });
});

describe('destination', () => {
  it('ida e volta: 100 m a 45°', () => {
    const p = destination(O, 45, 100);
    expect(distanceM(O, p)).toBeCloseTo(100, 2);
    expect(bearingDeg(O, p)).toBeCloseTo(45, 2);
  });
});

describe('pointToSegment', () => {
  const A = destination(O, 180, 50);
  const B = destination(O, 0, 50);
  const a: [number, number] = [A.lon, A.lat];
  const b: [number, number] = [B.lon, B.lat];

  it('ponto 10 m ao lado do meio do segmento', () => {
    const r = pointToSegment(destination(O, 90, 10), a, b);
    expect(Math.abs(r.distance - 10)).toBeLessThan(0.1);
    expect(angleDiff(r.bearing, 0)).toBeLessThan(0.1);
  });
  it('ponto além da ponta mede até a ponta', () => {
    const r = pointToSegment(destination(B, 0, 20), a, b);
    expect(Math.abs(r.distance - 20)).toBeLessThan(0.1);
  });
});

describe('circlePolygon', () => {
  it('anel fechado com raio correto', () => {
    const ring = circlePolygon(O, 30, 16);
    expect(ring).toHaveLength(17);
    expect(ring[16]).toEqual(ring[0]);
    for (const [lon, lat] of ring) {
      expect(Math.abs(distanceM(O, { lat, lon }) - 30)).toBeLessThan(0.01);
    }
  });
});
