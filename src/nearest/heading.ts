import type { Fix, LatLon } from '../types';
import { bearingDeg, distanceM, normalizeBearing } from '../geo/geo';

export const HEADING_DEFAULTS = { minSpeed: 1.5, minMove: 10 };

export class HeadingTracker {
  private anchor: LatLon | null = null;
  private current: number | null = null;
  private readonly opts: typeof HEADING_DEFAULTS;

  constructor(opts: typeof HEADING_DEFAULTS = HEADING_DEFAULTS) {
    this.opts = opts;
  }

  update(fix: Fix): number | null {
    const pos = { lat: fix.lat, lon: fix.lon };
    if (
      fix.heading !== null &&
      Number.isFinite(fix.heading) &&
      fix.speed !== null &&
      fix.speed >= this.opts.minSpeed
    ) {
      this.current = normalizeBearing(fix.heading);
      this.anchor = pos;
      return this.current;
    }
    if (this.anchor === null) {
      this.anchor = pos;
      return this.current;
    }
    if (distanceM(this.anchor, pos) >= this.opts.minMove) {
      this.current = bearingDeg(this.anchor, pos);
      this.anchor = pos;
    }
    return this.current;
  }
}
