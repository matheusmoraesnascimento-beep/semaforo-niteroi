import { describe, it, expect } from 'vitest';
import { findNextTrafficLight } from './nearest';
import { destination } from '../geo/geo';
import type { TrafficLight } from '../types';

const O = { lat: -22.9, lon: -43.1 };
function light(id: string, bearingFromO: number, dist: number, approach: number): TrafficLight {
  const p = destination(O, bearingFromO, dist);
  return { id, lat: p.lat, lon: p.lon, approachBearing: approach, createdAt: '2026-10-03T00:00:00Z', source: 'manual' };
}

describe('findNextTrafficLight', () => {
  it('sem heading → no-heading', () => {
    expect(findNextTrafficLight(O, null, [light('a', 0, 100, 0)]).kind).toBe('no-heading');
  });

  it('à frente e no meu sentido → found', () => {
    const r = findNextTrafficLight(O, 0, [light('a', 0, 100, 0)]);
    expect(r.kind).toBe('found');
    if (r.kind === 'found') {
      expect(r.light.id).toBe('a');
      expect(Math.abs(r.distance - 100)).toBeLessThan(0.5);
    }
  });

  it('à frente mas controla o sentido oposto → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 0, 100, 180)]).kind).toBe('none');
  });

  it('atrás → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 180, 100, 0)]).kind).toBe('none');
  });

  it('transversal (controla 90°) → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 0, 100, 90)]).kind).toBe('none');
  });

  it('ao lado (bearing 90°) → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 90, 100, 0)]).kind).toBe('none');
  });

  it('além de 500 m → none', () => {
    expect(findNextTrafficLight(O, 0, [light('a', 0, 600, 0)]).kind).toBe('none');
  });

  it('dois candidatos → o mais perto', () => {
    const r = findNextTrafficLight(O, 0, [light('far', 0, 200, 0), light('near', 0, 100, 0)]);
    expect(r.kind === 'found' && r.light.id).toBe('near');
  });

  it('histerese: mantém o anterior se o novo não for ≥ 20 m mais perto', () => {
    const lights = [light('prev', 0, 110, 0), light('new', 5, 100, 0)];
    const r = findNextTrafficLight(O, 0, lights, 'prev');
    expect(r.kind === 'found' && r.light.id).toBe('prev');
  });

  it('histerese: troca se o novo for ≥ 20 m mais perto', () => {
    const lights = [light('prev', 0, 110, 0), light('new', 5, 85, 0)];
    const r = findNextTrafficLight(O, 0, lights, 'prev');
    expect(r.kind === 'found' && r.light.id).toBe('new');
  });

  it('a menos de 25 m ignora a regra de estar à frente', () => {
    const r = findNextTrafficLight(O, 0, [light('a', 90, 10, 0)]);
    expect(r.kind === 'found' && r.light.id).toBe('a');
  });
});
