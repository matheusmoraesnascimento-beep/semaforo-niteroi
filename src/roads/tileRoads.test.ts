import { describe, it, expect } from 'vitest';
import { featuresToSegments, filterNear } from './tileRoads';
import { destination } from '../geo/geo';
import type { RoadSegment } from '../types';

const feat = (props: Record<string, unknown>, geometry: { type: string; coordinates?: unknown }, id?: number) => ({
  id, properties: props, geometry,
});
const LINE = { type: 'LineString', coordinates: [[-43.1, -22.9], [-43.1, -22.899]] };

describe('featuresToSegments', () => {
  it('LineString de via primária com oneway "true"', () => {
    const [s] = featuresToSegments([feat({ class: 'primary', oneway: 'true' }, LINE, 7)]);
    expect(s).toEqual({ id: '7:0', name: null, oneway: 1, coords: [[-43.1, -22.9], [-43.1, -22.899]] });
  });

  it('MultiLineString vira um segmento por linha', () => {
    const multi = { type: 'MultiLineString', coordinates: [LINE.coordinates, LINE.coordinates] };
    expect(featuresToSegments([feat({ class: 'street' }, multi, 1)]).map((s) => s.id)).toEqual(['1:0', '1:1']);
  });

  it('oneway "false" ou ausente → 0 (mão dupla)', () => {
    expect(featuresToSegments([feat({ class: 'street', oneway: 'false' }, LINE)])[0].oneway).toBe(0);
    expect(featuresToSegments([feat({ class: 'street' }, LINE)])[0].oneway).toBe(0);
  });

  it('aceita classes de ligação e street_limited', () => {
    const r = featuresToSegments([
      feat({ class: 'motorway_link' }, LINE),
      feat({ class: 'street_limited' }, LINE, 2),
    ]);
    expect(r).toHaveLength(2);
  });

  it('ignora path, pedestrian, ferrovia e service de estacionamento', () => {
    const r = featuresToSegments([
      feat({ class: 'path' }, LINE, 1),
      feat({ class: 'pedestrian' }, LINE, 2),
      feat({ class: 'major_rail' }, LINE, 3),
      feat({ class: 'service', type: 'service:parking_aisle' }, LINE, 4),
      feat({ class: 'service' }, LINE, 5),
    ]);
    expect(r).toHaveLength(1);
  });

  it('sem exigir classe mantém o nome; sem nome fica null', () => {
    const [named] = featuresToSegments([feat({ name: 'Rua da Conceição' }, LINE)], false);
    expect(named.name).toBe('Rua da Conceição');
    const [unnamed] = featuresToSegments([feat({ class: 'street' }, LINE)]);
    expect(unnamed.name).toBeNull();
  });

  it('ids de features sem id independem da ordem do array', () => {
    const B = { type: 'LineString', coordinates: [[-43.2, -22.8], [-43.2, -22.799]] };
    const a = feat({ class: 'street', name: 'A' }, LINE);
    const b = feat({ class: 'street', name: 'B', oneway: 'true' }, B);
    const ids1 = featuresToSegments([a, b]).map((s) => s.id).sort();
    const ids2 = featuresToSegments([b, a]).map((s) => s.id).sort();
    expect(ids1).toEqual(ids2);
    expect(new Set(ids1).size).toBe(2);
  });

  it('features idênticas sem id (tiles vizinhos) viram um só segmento', () => {
    expect(featuresToSegments([feat({ class: 'street' }, LINE), feat({ class: 'street' }, LINE)])).toHaveLength(1);
  });

  it('ignora geometrias inválidas', () => {
    expect(featuresToSegments([
      feat({ class: 'street' }, { type: 'LineString', coordinates: [[-43.1, -22.9]] }),
      feat({ class: 'street' }, { type: 'Point', coordinates: [-43.1, -22.9] }),
      feat({ class: 'street' }, { type: 'LineString', coordinates: [['x', 1], [2, 3]] }),
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
