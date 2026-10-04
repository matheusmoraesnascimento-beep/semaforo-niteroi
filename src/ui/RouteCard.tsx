import type { Place, RouteResult, SlotName } from '../routing/types';
import { formatDistance, formatDuration } from './format';

interface Props {
  phase: 'loading' | 'preview' | 'active';
  dest: Place | null;
  route: RouteResult | null;
  lightCount: number;
  onStart(): void;
  onCancel(): void;
  onSave(slot: SlotName): void;
}

export function RouteCard({ phase, dest, route, lightCount, onStart, onCancel, onSave }: Props) {
  if (phase === 'loading') {
    return (
      <div className="panel route-card">
        <div className="panel-main">Traçando rota…</div>
        <div className="row">
          <button onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    );
  }

  const summary = route
    ? `${formatDuration(route.durationS)} · ${formatDistance(route.distanceM)} · ${lightCount} semáforo${lightCount === 1 ? '' : 's'}`
    : '';

  if (phase === 'active') {
    return (
      <div className="panel route-card">
        <div className="panel-sub">{dest?.name}</div>
        <div className="panel-sub">{summary}</div>
        <div className="row">
          <button className="danger" onClick={onCancel}>Encerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel route-card">
      <div className="panel-main">{dest?.name}</div>
      <div className="panel-sub">{summary}</div>
      <div className="row">
        <button className="primary" onClick={onStart}>Iniciar</button>
        <button onClick={onCancel}>Cancelar</button>
      </div>
      <div className="row">
        <button onClick={() => onSave('home')}>🏠 Salvar como Casa</button>
        <button onClick={() => onSave('work')}>💼 Salvar como Trabalho</button>
      </div>
    </div>
  );
}
