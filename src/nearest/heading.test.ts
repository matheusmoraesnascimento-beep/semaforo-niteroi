import { describe, it, expect } from 'vitest';
import { HeadingTracker } from './heading';
import { destination } from '../geo/geo';
import type { Fix, LatLon } from '../types';

const O = { lat: -22.9, lon: -43.1 };
const fix = (p: LatLon, heading: number | null, speed: number | null): Fix => ({
  lat: p.lat, lon: p.lon, accuracy: 5, heading, speed, timestamp: 0,
});

describe('HeadingTracker', () => {
  it('usa o heading do GPS quando a velocidade ≥ 1,5 m/s', () => {
    const t = new HeadingTracker();
    expect(t.update(fix(O, 123, 5))).toBe(123);
  });

  it('ignora o heading do GPS em velocidade baixa', () => {
    const t = new HeadingTracker();
    expect(t.update(fix(O, 123, 0.5))).toBeNull();
  });

  it('calcula pelo deslocamento ≥ 10 m quando não há heading do GPS', () => {
    const t = new HeadingTracker();
    t.update(fix(O, null, null));
    const P = destination(O, 90, 15);
    expect(Math.abs(t.update(fix(P, null, null))! - 90)).toBeLessThan(0.5);
  });

  it('mantém o último heading em deslocamento pequeno', () => {
    const t = new HeadingTracker();
    t.update(fix(O, null, null));
    const P = destination(O, 90, 15);
    t.update(fix(P, null, null));
    const Q = destination(P, 0, 3);
    expect(Math.abs(t.update(fix(Q, null, null))! - 90)).toBeLessThan(0.5);
  });

  it('parado mantém o último heading do GPS', () => {
    const t = new HeadingTracker();
    t.update(fix(O, 45, 5));
    expect(t.update(fix(O, null, 0))).toBe(45);
  });
});
