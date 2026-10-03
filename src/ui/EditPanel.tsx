import { useEffect, useRef, useState } from 'react';
import type { TrafficLight } from '../types';
import type { Draft } from './MapView';

interface Props {
  draft: Draft | null;
  selected: TrafficLight | null;
  message: string | null;
  onSaveDraft(name: string): void;
  onCancelDraft(): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onCloseSelected(): void;
  onExport(): void;
  onImport(file: File): void;
  onExit(): void;
}

export function EditPanel(p: Props) {
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedId = p.selected?.id ?? null;

  useEffect(() => {
    setName(p.selected?.name ?? '');
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  let body;
  if (p.selected) {
    const sel = p.selected;
    body = (
      <>
        <div className="edit-title">Semáforo selecionado ({Math.round(sel.approachBearing)}°)</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (opcional)" />
        <div className="row">
          <button className="primary" onClick={() => p.onRename(sel.id, name)}>Salvar nome</button>
          <button className="danger" onClick={() => p.onDelete(sel.id)}>Excluir</button>
          <button onClick={p.onCloseSelected}>Fechar</button>
        </div>
      </>
    );
  } else if (!p.draft) {
    body = <div className="edit-hint">1. Toque no cruzamento onde fica o semáforo.</div>;
  } else if (p.draft.bearing === null) {
    body = (
      <div className="edit-hint">
        2. Toque num ponto <b>depois</b> do semáforo, na direção em que seguem os carros que ele controla.
      </div>
    );
  } else {
    body = (
      <>
        <div className="edit-hint">Sentido: {Math.round(p.draft.bearing)}°. Toque de novo no mapa para recomeçar.</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome (opcional), ex.: Av. X × R. Y" />
        <div className="row">
          <button className="primary" onClick={() => { p.onSaveDraft(name); setName(''); }}>Salvar</button>
          <button onClick={p.onCancelDraft}>Cancelar</button>
        </div>
      </>
    );
  }

  return (
    <div className="edit-panel">
      <div className="edit-warning">✏️ Modo cadastro — use parado</div>
      {body}
      {p.message && <div className="edit-message">{p.message}</div>}
      <div className="row">
        <button onClick={p.onExport}>Exportar</button>
        <button onClick={() => fileRef.current?.click()}>Importar</button>
        <input
          ref={fileRef}
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) p.onImport(f);
            e.target.value = '';
          }}
        />
        <button onClick={p.onExit}>Sair</button>
      </div>
    </div>
  );
}
