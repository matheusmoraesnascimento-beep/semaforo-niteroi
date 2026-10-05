import { describe, it, expect } from 'vitest';
import { congestionRuns } from './congestion';
import type { LatLon } from '../types';

const LINE: LatLon[] = [
  { lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }, { lat: 0, lon: 3 },
];

describe('congestionRuns', () => {
  it('agrupa trechos consecutivos do mesmo nível e compartilha o ponto de emenda', () => {
    const runs = congestionRuns(LINE, ['low', 'low', 'heavy']);
    expect(runs).toEqual([
      { level: 'low', coords: [[0, 0], [1, 0], [2, 0]] },
      { level: 'heavy', coords: [[2, 0], [3, 0]] },
    ]);
  });

  it('sem informação (tamanho diferente) pinta tudo como low', () => {
    expect(congestionRuns(LINE, [])).toEqual([{ level: 'low', coords: [[0, 0], [1, 0], [2, 0], [3, 0]] }]);
  });

  it('unknown é tratado como low (cor normal)', () => {
    expect(congestionRuns(LINE, ['unknown', 'unknown', 'unknown'])).toEqual([
      { level: 'low', coords: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    ]);
  });

  it('linha com menos de 2 pontos → sem trechos', () => {
    expect(congestionRuns([{ lat: 0, lon: 0 }], [])).toEqual([]);
  });
});
