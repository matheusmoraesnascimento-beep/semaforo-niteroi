import { describe, it, expect } from 'vitest';
import { lightsToGeoJSON, mergeLights, parseLightsGeoJSON } from './geojson';
import type { TrafficLight } from '../types';

const L = (id: string, extra: Partial<TrafficLight> = {}): TrafficLight => ({
  id, lat: -22.9, lon: -43.1, approachBearing: 90, createdAt: '2026-10-03T00:00:00Z', source: 'manual', ...extra,
});

describe('GeoJSON ida e volta', () => {
  it('preserva os campos', () => {
    const lights = [L('a', { name: 'Av. X × R. Y' }), L('b')];
    expect(parseLightsGeoJSON(lightsToGeoJSON(lights))).toEqual({ lights, rejected: 0 });
  });
  it('usa [lon, lat] nas coordenadas', () => {
    expect(lightsToGeoJSON([L('a')]).features[0].geometry.coordinates).toEqual([-43.1, -22.9]);
  });
});

describe('parseLightsGeoJSON', () => {
  it('lança erro se não for FeatureCollection', () => {
    expect(() => parseLightsGeoJSON({ type: 'Feature' })).toThrow('FeatureCollection');
  });

  it('rejeita features inválidas e conta', () => {
    const data = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { id: 'ok', approachBearing: 10 } },
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { id: 'x', approachBearing: 10 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { approachBearing: 10 } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { id: 'y', approachBearing: 400 } },
      ],
    };
    const r = parseLightsGeoJSON(data, () => 'NOW');
    expect(r.rejected).toBe(3);
    expect(r.lights).toEqual([
      { id: 'ok', lat: -22.9, lon: -43.1, approachBearing: 10, createdAt: 'NOW', source: 'manual' },
    ]);
  });

  it('remove espaços do nome e ignora nome vazio', () => {
    const data = {
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { id: 'a', approachBearing: 0, name: '  Rua A  ', createdAt: 'T' } },
        { type: 'Feature', geometry: { type: 'Point', coordinates: [-43.1, -22.9] }, properties: { id: 'b', approachBearing: 360, name: '   ', createdAt: 'T' } },
      ],
    };
    const r = parseLightsGeoJSON(data);
    expect(r.lights[0].name).toBe('Rua A');
    expect(r.lights[1].name).toBeUndefined();
    expect(r.lights[1].approachBearing).toBe(0);
  });
});

describe('mergeLights', () => {
  it('o local vence a base no mesmo id', () => {
    const r = mergeLights([L('a', { name: 'base' }), L('b')], [L('a', { name: 'local' }), L('c')]);
    expect(r.map((l) => [l.id, l.name])).toEqual([['a', 'local'], ['b', undefined], ['c', undefined]]);
  });
  it('remove os ids excluídos', () => {
    expect(mergeLights([L('a'), L('b')], [], ['a']).map((l) => l.id)).toEqual(['b']);
  });
});
