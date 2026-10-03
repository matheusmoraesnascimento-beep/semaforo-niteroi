import type { LocationSource } from '../types';
import { BrowserGpsSource } from './browserGps';
import { CapacitorGpsSource } from './capacitorGps';
import { SimulatedSource } from './simulated';

export function createLocationSource(opts: { simulation: boolean; native: boolean }): LocationSource {
  if (opts.simulation) return new SimulatedSource();
  return opts.native ? new CapacitorGpsSource() : new BrowserGpsSource();
}
