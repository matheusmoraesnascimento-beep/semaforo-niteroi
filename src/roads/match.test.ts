import { describe, it, expect } from 'vitest';
import { allowedBearing, matchRoad, nearestName } from './match';
import { angleDiff, destination } from '../geo/geo';
import type { LatLon, RoadSegment } from '../types';

const O = { lat: -22.9, lon: -43.1 };

/** Segmento reto de 100 m centrado em `center`, com a geometria apontando para `bearing`. */
function line(id: string, center: LatLon, bearing: number, oneway: 0 | 1 | -1 = 0, name: string | null = null): RoadSegment {
  const a = destination(center, bearing + 180, 50);
  const b = destination(center, bearing, 50);
  return { id, name, oneway, coords: [[a.lon, a.lat], [b.lon, b.lat]] };
}

const NS_EAST5 = line('ns', destination(O, 90, 5), 0); // norte-sul, 5 m a leste
const EW_NORTH15 = line('ew', destination(O, 0, 15), 90); // leste-oeste, 15 m ao norte

describe('matchRoad', () => {
  it('rumo norte → via norte-sul', () => {
    expect(matchRoad(O, 0, [NS_EAST5, EW_NORTH15])?.segment.id).toBe('ns');
  });

  it('rumo leste → via leste-oeste (alinhamento pesa mais que 10 m)', () => {
    expect(matchRoad(O, 90, [NS_EAST5, EW_NORTH15])?.segment.id).toBe('ew');
  });

  it('sem heading → a mais próxima', () => {
    expect(matchRoad(O, null, [NS_EAST5, EW_NORTH15])?.segment.id).toBe('ns');
  });

  it('nada a menos de 25 m → null', () => {
    expect(matchRoad(O, 0, [line('far', destination(O, 90, 30), 0)])).toBeNull();
  });

  it('rumo sul também casa com a via norte-sul (alinhamento ignora sentido)', () => {
    expect(matchRoad(O, 180, [NS_EAST5, EW_NORTH15])?.segment.id).toBe('ns');
  });

  it('histerese: mantém a anterior se a nova não for ≥ 5 melhor', () => {
    const east = line('east', destination(O, 90, 5), 0);
    const west = line('west', destination(O, 270, 8), 0);
    expect(matchRoad(O, 0, [east, west])?.segment.id).toBe('east');
    expect(matchRoad(O, 0, [east, west], 'west')?.segment.id).toBe('west');
  });

  it('histerese: troca se a nova for ≥ 5 melhor', () => {
    const east = line('east', destination(O, 90, 2), 0);
    const west = line('west', destination(O, 270, 8), 0);
    expect(matchRoad(O, 0, [east, west], 'west')?.segment.id).toBe('east');
  });
});

describe('allowedBearing', () => {
  it('oneway 1 → sentido da geometria; -1 → oposto; 0 → null', () => {
    const m1 = matchRoad(O, 0, [line('a', destination(O, 90, 5), 0, 1)])!;
    const m2 = matchRoad(O, 0, [line('a', destination(O, 90, 5), 0, -1)])!;
    const m0 = matchRoad(O, 0, [line('a', destination(O, 90, 5), 0, 0)])!;
    expect(angleDiff(allowedBearing(m1)!, 0)).toBeLessThan(0.5);
    expect(angleDiff(allowedBearing(m2)!, 180)).toBeLessThan(0.5);
    expect(allowedBearing(m0)).toBeNull();
  });
});

describe('nearestName', () => {
  it('retorna o nome mais próximo até 15 m', () => {
    const segs = [line('n1', destination(O, 90, 10), 0, 0, 'Rua A'), line('n2', destination(O, 90, 4), 0, 0, 'Rua B')];
    expect(nearestName(O, segs)).toBe('Rua B');
  });
  it('null se não houver nome perto', () => {
    expect(nearestName(O, [line('n1', destination(O, 90, 20), 0, 0, 'Rua A')])).toBeNull();
  });
});
