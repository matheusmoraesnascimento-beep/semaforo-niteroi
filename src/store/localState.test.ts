import { describe, it, expect } from 'vitest';
import { removeLight, upsertLight } from './localState';
import type { TrafficLight } from '../types';

const L = (id: string, name?: string): TrafficLight => ({
  id, lat: 0, lon: 0, approachBearing: 0, createdAt: 'T', source: 'manual', ...(name ? { name } : {}),
});

describe('localState', () => {
  it('upsert adiciona e substitui pelo id', () => {
    let s = upsertLight({ lights: [], deleted: [] }, L('a', 'v1'));
    s = upsertLight(s, L('a', 'v2'));
    expect(s.lights).toEqual([L('a', 'v2')]);
  });
  it('upsert tira o id da lista de excluídos', () => {
    expect(upsertLight({ lights: [], deleted: ['a'] }, L('a')).deleted).toEqual([]);
  });
  it('remove tira dos locais e marca como excluído, sem duplicar', () => {
    let s = removeLight({ lights: [L('a'), L('b')], deleted: [] }, 'a');
    s = removeLight(s, 'a');
    expect(s).toEqual({ lights: [L('b')], deleted: ['a'] });
  });
});
