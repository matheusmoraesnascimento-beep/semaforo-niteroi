import { describe, it, expect } from 'vitest';
import { createLocationSource } from './factory';
import { SimulatedSource } from './simulated';
import { CapacitorGpsSource } from './capacitorGps';
import { BrowserGpsSource } from './browserGps';

describe('createLocationSource', () => {
  it('simulação tem prioridade', () => {
    expect(createLocationSource({ simulation: true, native: true })).toBeInstanceOf(SimulatedSource);
  });
  it('nativo → Capacitor', () => {
    expect(createLocationSource({ simulation: false, native: true })).toBeInstanceOf(CapacitorGpsSource);
  });
  it('web → navegador', () => {
    expect(createLocationSource({ simulation: false, native: false })).toBeInstanceOf(BrowserGpsSource);
  });
});
