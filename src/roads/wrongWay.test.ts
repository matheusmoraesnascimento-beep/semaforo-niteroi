import { describe, it, expect } from 'vitest';
import { WrongWayDetector } from './wrongWay';
import type { RoadMatch } from './match';
import type { Fix } from '../types';

const match = (oneway: 0 | 1 | -1, distance = 3): RoadMatch => ({
  segment: { id: 'a', name: null, oneway, coords: [[0, 0], [0, 1]] },
  distance,
  segmentBearing: 0,
  cost: distance,
});
const fix = (accuracy = 5, speed: number | null = 10): Fix => ({
  lat: 0, lon: 0, accuracy, speed, heading: null, timestamp: 0,
});

function run(d: WrongWayDetector, n: number, input: Parameters<WrongWayDetector['update']>[0]): boolean[] {
  return Array.from({ length: n }, () => d.update(input));
}

describe('WrongWayDetector', () => {
  it('dispara só na 3ª leitura consecutiva na contramão', () => {
    expect(run(new WrongWayDetector(), 3, { match: match(1), fix: fix(), heading: 180 })).toEqual([false, false, true]);
  });

  it('não dispara com GPS impreciso', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(1), fix: fix(20), heading: 180 })).not.toContain(true);
  });

  it('não dispara em velocidade baixa ou desconhecida', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(1), fix: fix(5, 2), heading: 180 })).not.toContain(true);
    expect(run(new WrongWayDetector(), 5, { match: match(1), fix: fix(5, null), heading: 180 })).not.toContain(true);
  });

  it('não dispara em mão dupla', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(0), fix: fix(), heading: 180 })).not.toContain(true);
  });

  it('não dispara com ângulo ≤ 135°', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(1), fix: fix(), heading: 130 })).not.toContain(true);
  });

  it('não dispara longe da via (> 12 m) nem sem via', () => {
    expect(run(new WrongWayDetector(), 5, { match: match(1, 15), fix: fix(), heading: 180 })).not.toContain(true);
    expect(run(new WrongWayDetector(), 5, { match: null, fix: fix(), heading: 180 })).not.toContain(true);
  });

  it('oneway -1: rumo igual à geometria é contramão', () => {
    expect(run(new WrongWayDetector(), 3, { match: match(-1), fix: fix(), heading: 0 })).toEqual([false, false, true]);
  });

  it('desliga após 3 leituras normais', () => {
    const d = new WrongWayDetector();
    run(d, 3, { match: match(1), fix: fix(), heading: 180 });
    expect(run(d, 3, { match: match(1), fix: fix(), heading: 0 })).toEqual([true, true, false]);
  });

  it('leitura normal no meio zera a contagem', () => {
    const d = new WrongWayDetector();
    run(d, 2, { match: match(1), fix: fix(), heading: 180 });
    d.update({ match: match(1), fix: fix(), heading: 0 });
    expect(run(d, 2, { match: match(1), fix: fix(), heading: 180 })).toEqual([false, false]);
  });
});
