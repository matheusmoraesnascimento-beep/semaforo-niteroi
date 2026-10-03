import { describe, it, expect } from 'vitest';
import { positionToFix } from './positionToFix';

const pos = (heading: number | null, speed: number | null) => ({
  timestamp: 1000,
  coords: { latitude: -22.9, longitude: -43.1, accuracy: 8, heading, speed },
});

describe('positionToFix', () => {
  it('converte campos', () => {
    expect(positionToFix(pos(90, 10))).toEqual({ lat: -22.9, lon: -43.1, accuracy: 8, heading: 90, speed: 10, timestamp: 1000 });
  });
  it('heading NaN ou null → null', () => {
    expect(positionToFix(pos(Number.NaN, 10)).heading).toBeNull();
    expect(positionToFix(pos(null, 10)).heading).toBeNull();
  });
  it('speed NaN ou undefined → null', () => {
    expect(positionToFix(pos(90, Number.NaN)).speed).toBeNull();
    expect(positionToFix({ timestamp: 1, coords: { latitude: 0, longitude: 0, accuracy: 1 } }).speed).toBeNull();
  });
});
