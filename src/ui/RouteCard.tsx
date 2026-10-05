import type { RouteResult, SlotName } from '../routing/types';
import { formatDistance, formatDuration } from './format';

interface Props {
  phase: 'loading' | 'preview';
  route: RouteResult | null;
  lightCount: number;
  onStart(): void;
  onFavorite(): void;
  onCancel(): void;
  onSave(slot: SlotName): void;
}

export function RouteCard({ phase, route, lightCount, onStart, onFavorite, onCancel, onSave }: Props) {
  if (phase === 'loading' || !route) {
    return (
      <div className="sheet">
        <div className="sheet-title">Traçando rota…</div>
        <div className="sheet-actions">
          <button className="pill" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet">
      <div className="sheet-mode">🚗 Carro</div>
      <div className="sheet-time">
        <span className="time-big">{formatDuration(route.durationS)}</span>
        <span className="time-dist">({formatDistance(route.distanceM)})</span>
      </div>
      <div className="sheet-note">Rota mais rápida agora, com o trânsito atual</div>
      <div className="sheet-lights">🚦 {lightCount} semáforo{lightCount === 1 ? '' : 's'} no caminho</div>
      <div className="sheet-actions">
        <button className="pill pill-start" onClick={onStart}>▲ Iniciar</button>
        <button className="pill" onClick={onFavorite}>⭐ Favoritar</button>
        <button className="pill" onClick={() => onSave('home')}>🏠 Casa</button>
        <button className="pill" onClick={() => onSave('work')}>💼 Trabalho</button>
      </div>
    </div>
  );
}
