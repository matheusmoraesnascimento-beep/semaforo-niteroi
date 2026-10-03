import type { Fix, NextResult } from '../types';
import { formatDistance } from './format';

export const MAX_ACCURACY_M = 30;

interface Props {
  fix: Fix | null;
  error: string | null;
  next: NextResult | null;
}

export function DriverPanel({ fix, error, next }: Props) {
  let main: string;
  let sub: string | null = null;
  let cls = 'panel';

  if (error) {
    main = error;
    cls += ' panel-error';
  } else if (!fix) {
    main = 'Procurando GPS…';
  } else if (fix.accuracy > MAX_ACCURACY_M) {
    main = `GPS impreciso (±${Math.round(fix.accuracy)} m)`;
  } else if (!next || next.kind === 'no-heading') {
    main = 'Aguardando movimento';
  } else if (next.kind === 'none') {
    main = 'Nenhum semáforo à frente';
  } else {
    main = `🚦 ${formatDistance(next.distance)}`;
    sub = next.light.name ?? null;
  }

  return (
    <div className={cls}>
      <div className={next?.kind === 'found' && !error ? 'panel-main panel-big' : 'panel-main'}>{main}</div>
      {sub && <div className="panel-sub">{sub}</div>}
    </div>
  );
}
