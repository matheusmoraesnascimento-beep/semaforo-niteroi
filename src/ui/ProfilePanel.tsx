import { useRef, useState } from 'react';
import type { Place } from '../routing/types';
import {
  addFavorite, clearRecents, removeFavorite, renameFavorite, setName, setSetting, setSlot,
  type Profile, type Settings,
} from '../profile/profile';

interface Props {
  profile: Profile;
  lightCount: number;
  notice: string | null;
  onClose(): void;
  onGo(place: Place): void;
  onChange(f: (p: Profile) => Profile): void;
  onExportLights(): void;
  onImportLights(file: File): void;
  onEditLights(): void;
  onExportProfile(): void;
  onImportProfile(file: File): void;
}

type Editing = { kind: 'name' } | { kind: 'fav'; id: string } | null;

const SETTING_LABELS: Record<keyof Settings, string> = {
  keepAwake: 'Manter tela ligada',
  showTraffic: 'Mostrar trânsito na rota',
};

export const initialOf = (name: string): string => name.trim().charAt(0).toUpperCase() || '?';

function FileButton({ label, onFile }: { label: string; onFile(f: File): void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="pill" onClick={() => ref.current?.click()}>{label}</button>
      <input
        ref={ref}
        type="file"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </>
  );
}

export function ProfilePanel(p: Props) {
  const { profile } = p;
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState('');

  const startEdit = (e: Editing, current: string) => {
    setEditing(e);
    setDraft(current);
  };
  const commit = () => {
    if (editing?.kind === 'name') p.onChange((x) => setName(x, draft));
    if (editing?.kind === 'fav') {
      const { id } = editing;
      p.onChange((x) => renameFavorite(x, id, draft));
    }
    setEditing(null);
  };

  const editor = (
    <div className="pf-edit">
      <input value={draft} autoFocus onChange={(e) => setDraft(e.target.value)} />
      <button className="pill pill-start" onClick={commit}>Salvar</button>
    </div>
  );

  const slotRow = (slot: 'home' | 'work', icon: string, title: string) => {
    const place = profile[slot];
    return (
      <div className="pf-row">
        <button className="pf-main" disabled={!place} onClick={() => place && p.onGo(place)}>
          <span className="pf-icon">{icon}</span>
          <span>
            <div className="pf-title">{title}</div>
            <div className="pf-sub">{place ? place.name : 'Defina pela pré-visualização da rota'}</div>
          </span>
        </button>
        {place && <button className="pf-act" aria-label={`Remover ${title}`} onClick={() => p.onChange((x) => setSlot(x, slot, undefined))}>🗑</button>}
      </div>
    );
  };

  return (
    <div className="profile" role="dialog" aria-label="Perfil">
      <div className="pf-head">
        <button className="pf-back" onClick={p.onClose} aria-label="Voltar">←</button>
        <div className="avatar avatar-big">{initialOf(profile.name)}</div>
        {editing?.kind === 'name' ? editor : (
          <div className="pf-name">
            {profile.name}
            <button className="pf-act" aria-label="Editar nome" onClick={() => startEdit({ kind: 'name' }, profile.name)}>✏️</button>
          </div>
        )}
      </div>
      {p.notice && <div className="pf-notice">{p.notice}</div>}

      <h3>Favoritos</h3>
      {slotRow('home', '🏠', 'Casa')}
      {slotRow('work', '💼', 'Trabalho')}
      {profile.favorites.map((f) => (
        <div className="pf-row" key={f.id}>
          {editing?.kind === 'fav' && editing.id === f.id ? editor : (
            <>
              <button className="pf-main" onClick={() => p.onGo(f)}>
                <span className="pf-icon">⭐</span>
                <span className="pf-title">{f.name}</span>
              </button>
              <button className="pf-act" aria-label={`Renomear ${f.name}`} onClick={() => startEdit({ kind: 'fav', id: f.id }, f.name)}>✏️</button>
              <button className="pf-act" aria-label={`Remover ${f.name}`} onClick={() => p.onChange((x) => removeFavorite(x, f.id))}>🗑</button>
            </>
          )}
        </div>
      ))}
      {profile.favorites.length === 0 && <div className="pf-empty">Nenhum favorito ainda. Use ⭐ nos recentes ou na rota.</div>}

      <h3>Recentes</h3>
      {profile.recents.map((r, i) => (
        <div className="pf-row" key={`${r.lat},${r.lon},${i}`}>
          <button className="pf-main" onClick={() => p.onGo(r)}>
            <span className="pf-icon">🕘</span>
            <span className="pf-title">{r.name}</span>
          </button>
          <button className="pf-act" aria-label={`Favoritar ${r.name}`} onClick={() => p.onChange((x) => addFavorite(x, r, crypto.randomUUID(), new Date().toISOString()).profile)}>⭐</button>
          <button className="pf-act" aria-label={`Definir ${r.name} como Casa`} onClick={() => p.onChange((x) => setSlot(x, 'home', r))}>🏠</button>
          <button className="pf-act" aria-label={`Definir ${r.name} como Trabalho`} onClick={() => p.onChange((x) => setSlot(x, 'work', r))}>💼</button>
        </div>
      ))}
      {profile.recents.length === 0 && <div className="pf-empty">Os destinos aparecem aqui quando você toca em Iniciar.</div>}
      {profile.recents.length > 0 && (
        <div className="pf-actions"><button className="pill" onClick={() => p.onChange(clearRecents)}>Limpar histórico</button></div>
      )}

      <h3>Ajustes</h3>
      {(Object.keys(SETTING_LABELS) as (keyof Settings)[]).map((key) => (
        <label className="pf-toggle" key={key}>
          <span>{SETTING_LABELS[key]}</span>
          <input type="checkbox" checked={profile.settings[key]} onChange={(e) => p.onChange((x) => setSetting(x, key, e.target.checked))} />
        </label>
      ))}

      <h3>Meus semáforos</h3>
      <div className="pf-sub">{p.lightCount} cadastrado{p.lightCount === 1 ? '' : 's'} neste aparelho</div>
      <div className="pf-actions">
        <button className="pill" onClick={p.onExportLights}>Exportar</button>
        <FileButton label="Importar" onFile={p.onImportLights} />
        <button className="pill" onClick={p.onEditLights}>Modo cadastro</button>
      </div>

      <h3>Backup do perfil</h3>
      <div className="pf-sub">Sem conta, desinstalar o app apaga o perfil. Exporte para guardar.</div>
      <div className="pf-actions">
        <button className="pill" onClick={p.onExportProfile}>Exportar perfil</button>
        <FileButton label="Importar perfil" onFile={p.onImportProfile} />
      </div>
    </div>
  );
}
