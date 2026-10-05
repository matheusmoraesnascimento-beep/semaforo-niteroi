import { describe, it, expect } from 'vitest';
import { remainingOnRoute } from './progress';
import type { LatLon } from '../types';

// ~222 m por trecho em direção ao leste, na linha do equador
const LINE: LatLon[] = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.002 }, { lat: 0, lon: 0.004 }];
const TOTAL = { distanceM: 1000, durationS: 600 };

describe('remainingOnRoute', () => {
  it('no início sobra tudo', () => {
    const r = remainingOnRoute(LINE, { lat: 0, lon: 0 }, TOTAL.distanceM, TOTAL.durationS);
    expect(r.distanceM).toBeCloseTo(1000, 0);
    expect(r.durationS).toBeCloseTo(600, 0);
  });

  it('no meio sobra metade, proporcional em distância e tempo', () => {
    const r = remainingOnRoute(LINE, { lat: 0, lon: 0.002 }, TOTAL.distanceM, TOTAL.durationS);
    expect(r.distanceM).toBeCloseTo(500, 0);
    expect(r.durationS).toBeCloseTo(300, 0);
  });

  it('no fim sobra zero', () => {
    const r = remainingOnRoute(LINE, { lat: 0, lon: 0.004 }, TOTAL.distanceM, TOTAL.durationS);
    expect(r.distanceM).toBeCloseTo(0, 0);
  });

  it('linha degenerada não quebra', () => {
    const r = remainingOnRoute([{ lat: 0, lon: 0 }], { lat: 0, lon: 0 }, 100, 60);
    expect(r).toEqual({ distanceM: 100, durationS: 60 });
  });
});
