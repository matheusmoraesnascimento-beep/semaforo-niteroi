import type { Fix, LocationSource } from '../types';
import { bearingDeg, distanceM } from '../geo/geo';

export const SIM_MIN_SPEED = 5; // m/s — cliques lentos ainda simulam um carro andando

export function makeSimFix(prev: Fix | null, lat: number, lon: number, now: number): Fix {
  if (!prev) return { lat, lon, accuracy: 5, speed: null, heading: null, timestamp: now };
  const pos = { lat, lon };
  const d = distanceM(prev, pos);
  const dt = (now - prev.timestamp) / 1000;
  return {
    lat,
    lon,
    accuracy: 5,
    speed: d >= 1 ? Math.max(dt > 0 ? d / dt : 0, SIM_MIN_SPEED) : 0,
    heading: d >= 1 ? bearingDeg(prev, pos) : null,
    timestamp: now,
  };
}

export class SimulatedSource implements LocationSource {
  private onFix: ((f: Fix) => void) | null = null;
  private last: Fix | null = null;

  start(onFix: (f: Fix) => void, _onError?: (msg: string) => void): void {
    this.onFix = onFix;
  }

  stop(): void {
    this.onFix = null;
  }

  moveTo(lat: number, lon: number, now: number = Date.now()): void {
    if (!this.onFix) return;
    const f = makeSimFix(this.last, lat, lon, now);
    this.last = f;
    this.onFix(f);
  }
}
