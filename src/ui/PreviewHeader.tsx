import type { Place } from '../routing/types';

interface Props {
  dest: Place | null;
  onCancel(): void;
}

export function PreviewHeader({ dest, onCancel }: Props) {
  return (
    <div className="preview-header">
      <div className="ph-row">
        <span className="ph-dot ph-from" />
        <span className="ph-from-text">Seu local</span>
      </div>
      <div className="ph-row">
        <span className="ph-dot ph-to">📍</span>
        <span className="ph-to-text">{dest?.name ?? ''}</span>
        <button className="ph-close" onClick={onCancel} aria-label="Cancelar rota">✕</button>
      </div>
    </div>
  );
}
