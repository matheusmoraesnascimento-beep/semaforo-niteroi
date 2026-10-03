import { describe, it, expect } from 'vitest';
import { featuresToSegments, filterNear } from './tileRoads';
import { destination } from '../geo/geo';
import type { RoadSegment } from '../types';

const feat = (props: Record<string, unknown>, geometry: { type: string; coordinates?: unknown }, id?: number) => ({
  id, properties: props, geometry,
});
const LINE = { type: 'LineString', coordinates: [[-43.1, -22.9], [-43.1, -22.899]] };

describe('featuresToSegments', () => {
  it('LineString de via primária com oneway 1', () => {
    const [s] = featuresToSegments([feat({ class: 'primary', oneway: 1 }, LINE, 7)]);
    expect(s).toEqual({ id: '7:0', name: null, oneway: 1, coords: [[-43.1, -22.9], [-43.1, -22.899]] });
  });

  it('MultiLineString vira um segmento por linha', () => {
    const multi = { type: 'MultiLineString', coordinates: [LINE.coordinates, LINE.coordinates] };
    expect(featuresToSegments([feat({ class: 'minor' }, multi, 1)]).map((s) => s.id)).toEqual(['1:0', '1:1']);
  });

  it('oneway ausente ou diferente de ±1 → 0', () => {
    expect(featuresToSegments([feat({ class: 'minor', oneway: 0 }, LINE)])[0].oneway).toBe(0);
    expect(featuresToSegments([feat({ class: 'minor' }, LINE)])[0].oneway).toBe(0);
  });

  it('ignora path, ferrovia e service de estacionamento', () => {
    const r = featuresToSegments([
      feat({ class: 'path' }, LINE),
      feat({ class: 'rail' }, LINE),
      feat({ class: 'service', service: 'parking_aisle' }, LINE),
      feat({ class: 'service' }, LINE),
    ]);
    expect(r).toHaveLength(1);
  });

  it('sem exigir classe (camada de nomes) mantém o nome', () => {
    const [s] = featuresToSegments([feat({ name: 'Rua da Conceição' }, LINE)], false);
    expect(s.name).toBe('Rua da Conceição');
  });

  it('ignora geometrias inválidas', () => {
    expect(featuresToSegments([
      feat({ class: 'minor' }, { type: 'LineString', coordinates: [[-43.1, -22.9]] }),
      feat({ class: 'minor' }, { type: 'Point', coordinates: [-43.1, -22.9] }),
      feat({ class: 'minor' }, { type: 'LineString', coordinates: [['x', 1], [2, 3]] }),
    ])).toEqual([]);
  });
});

describe('filterNear', () => {
  const O = { lat: -22.9, lon: -43.1 };
  const seg = (id: string, a: { lat: number; lon: number }, b: { lat: number; lon: number }): RoadSegment => ({
    id, name: null, oneway: 0, coords: [[a.lon, a.lat], [b.lon, b.lat]],
  });

  it('mantém perto, descarta longe e mantém segmento longo que cruza a área', () => {
    const near = seg('near', destination(O, 0, 10), destination(O, 0, 30));
    const far = seg('far', destination(O, 0, 1000), destination(O, 0, 1100));
    const crossing = seg('cross', destination(O, 270, 500), destination(O, 90, 500));
    expect(filterNear([near, far, crossing], O, 40).map((s) => s.id)).toEqual(['near', 'cross']);
  });
});
