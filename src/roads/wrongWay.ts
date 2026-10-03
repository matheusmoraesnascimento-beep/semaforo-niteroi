import type { Fix } from '../types';
import { angleDiff } from '../geo/geo';
import { allowedBearing, type RoadMatch } from './match';

export const WRONG_WAY_DEFAULTS = {
  maxAccuracy: 15,
  maxDistance: 12,
  minSpeed: 2.8,
  minAngle: 135,
  triggerCount: 3,
  clearCount: 3,
};

export interface WrongWayInput {
  match: RoadMatch | null;
  fix: Fix;
  heading: number | null;
}

export class WrongWayDetector {
  private bad = 0;
  private good = 0;
  private active = false;
  private readonly opts: typeof WRONG_WAY_DEFAULTS;

  constructor(opts: typeof WRONG_WAY_DEFAULTS = WRONG_WAY_DEFAULTS) {
    this.opts = opts;
  }

  private isWrongWay({ match, fix, heading }: WrongWayInput): boolean {
    if (!match || heading === null || fix.speed === null) return false;
    const allowed = allowedBearing(match);
    if (allowed === null) return false;
    return (
      fix.accuracy <= this.opts.maxAccuracy &&
      match.distance <= this.opts.maxDistance &&
      fix.speed >= this.opts.minSpeed &&
      angleDiff(heading, allowed) > this.opts.minAngle
    );
  }

  update(input: WrongWayInput): boolean {
    if (this.isWrongWay(input)) {
      this.bad++;
      this.good = 0;
      if (this.bad >= this.opts.triggerCount) this.active = true;
    } else {
      this.good++;
      this.bad = 0;
      if (this.good >= this.opts.clearCount) this.active = false;
    }
    return this.active;
  }
}
