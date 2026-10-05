import { describe, expect, it } from 'vitest';
import { FixFilter } from './fixFilter';
import type { Fix } from '../types';

const fix = (over: Partial<Fix>): Fix => ({
  lat: -22.88, lon: -43.1, accuracy: 5, speed: 10, heading: 90, timestamp: 0, ...over,
});

describe('FixFilter', () => {
  it('aceita o primeiro fix', () => {
    expect(new FixFilter().update(fix({ accuracy: 200 }))).not.toBeNull();
  });
  it('descarta fix impreciso', () => {
    const f = new FixFilter();
    f.update(fix({}));
    expect(f.update(fix({ accuracy: 120, timestamp: 1000 }))).toBeNull();
  });
  it('descarta salto impossível', () => {
    const f = new FixFilter();
    f.update(fix({}));
    expect(f.update(fix({ lat: -22.8, timestamp: 1000 }))).toBeNull();
  });
  it('aceita qualquer fix após ficar obsoleto', () => {
    const f = new FixFilter();
    f.update(fix({}));
    expect(f.update(fix({ accuracy: 120, timestamp: 20000 }))).not.toBeNull();
  });
  it('suaviza ruído lateral', () => {
    const f = new FixFilter();
    f.update(fix({ speed: 0 }));
    const out = f.update(fix({ lat: -22.8799, accuracy: 20, speed: 0, timestamp: 1000 }))!;
    expect(out.lat).toBeGreaterThan(-22.88);
    expect(out.lat).toBeLessThan(-22.8799);
  });

  it('primeiro fix grosseiro não bloqueia o GPS real seguinte', () => {
    const f = new FixFilter();
    f.update(fix({ lat: -22.877, accuracy: 300 }));
    expect(f.update(fix({ accuracy: 5, timestamp: 1000 }))).not.toBeNull();
  });

  it('prevê o avanço do carro em movimento (não fica atrás)', () => {
    const f = new FixFilter();
    f.update(fix({ speed: 15, heading: 90, accuracy: 30 }));
    const out = f.update(fix({ lon: -43.1 + 0.000135, speed: 15, heading: 90, accuracy: 30, timestamp: 1000 }))!;
    expect(out.lon).toBeGreaterThan(-43.1 + 0.0001);
  });
});
