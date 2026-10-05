import type { Fix } from '../types';
import { destination, distanceM } from '../geo/geo';

export const FIX_FILTER_DEFAULTS = {
  maxAccuracy: 50, // fixes piores que isso são descartados
  maxSpeed: 70, // m/s (~250 km/h): acima disso o salto é erro de GPS
  staleMs: 8000, // após esse tempo sem fix bom, aceita qualquer coisa
  minAccuracy: 3,
  processNoise: 3, // m/s de incerteza de movimento do carro
  minPredictSpeed: 2, // m/s: acima disso a posição é prevista pelo avanço
};

/** Descarta fixes ruins e suaviza a posição (Kalman 1D ponderado pela precisão). */
export class FixFilter {
  private last: Fix | null = null;
  private variance = 0;
  private readonly opts: typeof FIX_FILTER_DEFAULTS;

  constructor(opts: typeof FIX_FILTER_DEFAULTS = FIX_FILTER_DEFAULTS) {
    this.opts = opts;
  }

  update(raw: Fix): Fix | null {
    const o = this.opts;
    const acc = Math.max(raw.accuracy, o.minAccuracy);
    const prev = this.last;
    if (!prev) {
      this.last = raw;
      this.variance = acc * acc;
      return raw;
    }
    const dt = Math.max((raw.timestamp - prev.timestamp) / 1000, 0.001);
    const stale = raw.timestamp - prev.timestamp > o.staleMs;
    if (!stale) {
      if (raw.accuracy > o.maxAccuracy) return null;
      if ((distanceM(prev, raw) - prev.accuracy - raw.accuracy) / dt > o.maxSpeed) return null;
    }
    if (stale) {
      this.last = raw;
      this.variance = acc * acc;
      return raw;
    }
    const speed = raw.speed ?? prev.speed ?? 0;
    const moving = prev.heading !== null && speed >= o.minPredictSpeed;
    const base = moving ? destination(prev, prev.heading!, speed * dt) : prev;
    const variance = this.variance + (dt * (o.processNoise + speed)) ** 2;
    const k = variance / (variance + acc * acc);
    const out: Fix = {
      ...raw,
      lat: base.lat + k * (raw.lat - base.lat),
      lon: base.lon + k * (raw.lon - base.lon),
      accuracy: Math.sqrt((1 - k) * variance),
    };
    this.variance = (1 - k) * variance;
    this.last = out;
    return out;
  }
}
