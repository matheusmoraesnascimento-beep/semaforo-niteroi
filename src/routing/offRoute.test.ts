import { describe, it, expect } from 'vitest';
import { OffRouteDetector, distanceToRoute } from './offRoute';
import type { LatLon } from '../types';

const line: LatLon[] = [
  { lat: -22.9, lon: -43.1 },
  { lat: -22.89, lon: -43.1 },
];

describe('distanceToRoute', () => {
  it('sobre a rota é ~0', () => {
    expect(distanceToRoute({ lat: -22.895, lon: -43.1 }, line)).toBeLessThan(1);
  });
  it('0,0005° ao lado é ~51 m', () => {
    const d = distanceToRoute({ lat: -22.895, lon: -43.0995 }, line);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(60);
  });
});

describe('OffRouteDetector', () => {
  it('desvio curto não dispara', () => {
    const d = new OffRouteDetector();
    expect(d.update(80, 0)).toBe(false);
    expect(d.update(80, 3000)).toBe(false);
    expect(d.update(10, 4000)).toBe(false);
    expect(d.update(80, 6000)).toBe(false); // contagem recomeçou em 6000
  });
  it('desvio de 5 s dispara uma vez e exige novos 5 s para disparar de novo', () => {
    const d = new OffRouteDetector();
    expect(d.update(80, 0)).toBe(false);
    expect(d.update(80, 5000)).toBe(true);
    expect(d.update(80, 5001)).toBe(false);
    expect(d.update(80, 10001)).toBe(true);
  });
  it('dentro do limite (50 m) nunca dispara', () => {
    const d = new OffRouteDetector();
    expect(d.update(50, 0)).toBe(false);
    expect(d.update(50, 60000)).toBe(false);
  });
  it('reset zera a contagem', () => {
    const d = new OffRouteDetector();
    d.update(80, 0);
    d.reset();
    expect(d.update(80, 5000)).toBe(false);
  });
});
