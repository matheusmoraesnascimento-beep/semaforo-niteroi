import { describe, it, expect } from 'vitest';
import { makeSimFix, SimulatedSource } from './simulated';
import { destination } from '../geo/geo';
import type { Fix } from '../types';

const O = { lat: -22.9, lon: -43.1 };

describe('makeSimFix', () => {
  it('primeiro fix sem heading e sem velocidade', () => {
    expect(makeSimFix(null, O.lat, O.lon, 1000)).toEqual({ lat: O.lat, lon: O.lon, accuracy: 5, speed: null, heading: null, timestamp: 1000 });
  });

  it('calcula heading e velocidade a partir do anterior', () => {
    const prev = makeSimFix(null, O.lat, O.lon, 0);
    const P = destination(O, 90, 40);
    const f = makeSimFix(prev, P.lat, P.lon, 2000);
    expect(Math.abs(f.heading! - 90)).toBeLessThan(0.5);
    expect(f.speed!).toBeCloseTo(20, 1);
  });

  it('clique lento: velocidade minima de 5 m/s', () => {
    const prev = makeSimFix(null, O.lat, O.lon, 0);
    const P = destination(O, 90, 40);
    const f = makeSimFix(prev, P.lat, P.lon, 60000);
    expect(f.speed!).toBeCloseTo(5, 5);
    expect(Math.abs(f.heading! - 90)).toBeLessThan(0.5);
  });

  it('mesmo ponto: velocidade 0 e heading null', () => {
    const prev = makeSimFix(null, O.lat, O.lon, 0);
    const f = makeSimFix(prev, O.lat, O.lon, 1000);
    expect(f.speed).toBe(0);
    expect(f.heading).toBeNull();
  });

  it('deslocamento < 1 m → heading null', () => {
    const prev = makeSimFix(null, O.lat, O.lon, 0);
    expect(makeSimFix(prev, O.lat, O.lon, 1000).heading).toBeNull();
  });
});

describe('SimulatedSource', () => {
  it('entrega fixes após start e para após stop', () => {
    const got: Fix[] = [];
    const s = new SimulatedSource();
    s.start((f) => got.push(f), () => {});
    s.moveTo(O.lat, O.lon, 0);
    s.stop();
    s.moveTo(O.lat, O.lon, 1000);
    expect(got).toHaveLength(1);
  });
});
