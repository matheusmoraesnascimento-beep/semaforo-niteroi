import { describe, it, expect } from 'vitest';
import { snapFixToSegment, looseRadius } from './snapToRoad';
import type { Fix } from '../types';

const COORDS: [number, number][] = [[0, 0], [0.002, 0]]; // [lon, lat], leste
const fix = (over: Partial<Fix>): Fix => ({ lat: 0.00015, lon: 0.001, accuracy: 30, speed: 5, heading: 90, timestamp: 0, ...over });

describe('snapFixToSegment', () => {
  it('projeta o fix sobre a via e mantém o resto do fix', () => {
    const r = snapFixToSegment(fix({}), COORDS);
    expect(r.lat).toBeCloseTo(0, 6);
    expect(r.lon).toBeCloseTo(0.001, 6);
    expect(r.accuracy).toBe(30);
  });
});

describe('looseRadius', () => {
  it('fica entre 25 e 40 m, seguindo a precisão', () => {
    expect(looseRadius(5)).toBe(25);
    expect(looseRadius(32)).toBe(32);
    expect(looseRadius(200)).toBe(40);
  });
});
