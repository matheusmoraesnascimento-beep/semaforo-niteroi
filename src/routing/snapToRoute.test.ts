import { describe, it, expect } from 'vitest';
import { snapToRoute } from './snapToRoute';
import type { Fix, LatLon } from '../types';

const LINE: LatLon[] = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.002 }]; // leste
const fix = (over: Partial<Fix>): Fix => ({ lat: 0.00005, lon: 0.001, accuracy: 5, speed: 10, heading: 90, timestamp: 0, ...over });

describe('snapToRoute', () => {
  it('projeta na rota e usa o sentido do trecho quando o heading concorda', () => {
    const r = snapToRoute(fix({}), 85, LINE);
    expect(r.fix.lat).toBeCloseTo(0, 6);
    expect(r.heading).toBeCloseTo(90, 3);
  });

  it('heading contrário à rota (transversal/contramão): não mexe na posição nem no heading', () => {
    const f = fix({});
    const r = snapToRoute(f, 0, LINE);
    expect(r.fix).toBe(f);
    expect(r.heading).toBe(0);
  });

  it('longe da rota: não mexe', () => {
    const f = fix({ lat: 0.001 });
    expect(snapToRoute(f, 90, LINE).fix).toBe(f);
  });

  it('sem heading ainda: projeta e adota o sentido do trecho se em movimento', () => {
    const r = snapToRoute(fix({}), null, LINE);
    expect(r.fix.lat).toBeCloseTo(0, 6);
    expect(r.heading).toBeCloseTo(90, 3);
  });

  it('parado: projeta mas preserva o heading', () => {
    const r = snapToRoute(fix({ speed: 0 }), 200, LINE);
    expect(r.heading).toBe(200);
  });

  it('sem rota: devolve igual', () => {
    const f = fix({});
    expect(snapToRoute(f, 10, null)).toEqual({ fix: f, heading: 10 });
  });
});
