import type { NextResult } from '../types';
import type { RoadInfo } from './StreetBanner';
import { formatDistance } from './format';

interface Props {
  road: RoadInfo | null;
  next: NextResult | null;
}

export function NavBanner({ road, next }: Props) {
  const street = road?.name ?? null;
  return (
    <div className="nav-banner-wrap">
      <div className="nav-banner">
        <span className="nav-arrow">⬆</span>
        <div className="nav-text">
          <div className="nav-small">{street ? 'seguindo pela' : 'seguindo em frente'}</div>
          {street && <div className="nav-street">{street}</div>}
        </div>
      </div>
      {next?.kind === 'found' && (
        <div className="nav-chip nav-light">🚦 Semáforo em {formatDistance(next.distance)}{next.light.name ? ` · ${next.light.name}` : ''}</div>
      )}
    </div>
  );
}
