import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LatLon, LocalState, TrafficLight } from './types';
import { MapView, type Draft } from './ui/MapView';
import { DriverPanel } from './ui/DriverPanel';
import { StreetBanner } from './ui/StreetBanner';
import { WrongWayAlert } from './ui/WrongWayAlert';
import { SearchBar } from './ui/SearchBar';
import { RouteCard } from './ui/RouteCard';
import { PreviewHeader } from './ui/PreviewHeader';
import { NavBanner } from './ui/NavBanner';
import { NavFooter } from './ui/NavFooter';
import { remainingOnRoute } from './routing/progress';
import { useNavigation } from './routing/useNavigation';
import type { Place, SlotName } from './routing/types';
import { useProfile } from './profile/useProfile';
import { addFavorite, addRecent, buildSuggestions, mergeImported, setSlot } from './profile/profile';
import { parseProfile, serializeProfile } from './profile/profileStore';
import { ProfilePanel, initialOf } from './ui/ProfilePanel';
import { EditPanel } from './ui/EditPanel';
import { useWakeLock } from './ui/useWakeLock';
import { useDriving } from './driving/useDriving';
import { mergeLights, parseLightsGeoJSON } from './store/geojson';
import { loadBaseLights, loadLocal, saveLocal } from './store/localStore';
import { exportLights, shareTextFile } from './store/exportFile';
import { removeLight, upsertLight } from './store/localState';
import { bearingDeg } from './geo/geo';

const BASE_LIGHTS_URL = `${import.meta.env.BASE_URL}data/traffic_lights.geojson`;
const MAX_IMPORT_BYTES = 1024 * 1024;
const MESSAGE_MS = 6000;

export default function App() {
  const [base, setBase] = useState<TrafficLight[]>([]);
  const [local, setLocal] = useState<LocalState>(() => loadLocal());
  const lights = useMemo(() => mergeLights(base, local.lights, local.deleted), [base, local]);
  // lista que o motor de alertas enxerga: todos os semáforos, ou só os da rota quando há rota ativa
  const alertLightsRef = useRef<TrafficLight[]>(lights);

  const [simulation, setSimulation] = useState(() => new URLSearchParams(window.location.search).has('sim'));
  const [mode, setMode] = useState<'drive' | 'edit'>('drive');
  const [follow, setFollow] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { profile, update } = useProfile();
  const [profileOpen, setProfileOpen] = useState(false);
  const routeLineRef = useRef<LatLon[] | null>(null);
  const { fix, navFix, heading, next, road, wrongWay, error, onReady, moveSimulation } = useDriving({ simulation, routeLineRef, alertLightsRef });
  const nav = useNavigation(navFix, lights);
  routeLineRef.current = nav.phase === 'active' ? (nav.route?.line ?? null) : null;
  alertLightsRef.current = nav.phase === 'active' ? nav.routeLights : lights;
  const remaining = useMemo(
    () => (nav.phase === 'active' && nav.route && fix ? remainingOnRoute(nav.route.line, fix, nav.route.distanceM, nav.route.durationS) : null),
    [nav.phase, nav.route, fix],
  );

  // pré-visualização mostra a rota inteira; sem rota, volta a seguir o carro
  useEffect(() => {
    if (nav.phase === 'preview') setFollow(false);
    if (nav.phase === 'idle') setFollow(true);
  }, [nav.phase]);

  const startRoute = () => {
    if (nav.dest) {
      const dest = nav.dest;
      update((p) => addRecent(p, dest));
    }
    nav.start();
    setFollow(true);
  };

  const saveDestination = (slot: SlotName) => {
    if (!nav.dest) return;
    const dest = nav.dest;
    update((p) => setSlot(p, slot, dest));
    nav.report(slot === 'home' ? 'Salvo como Casa.' : 'Salvo como Trabalho.');
  };

  const favoriteDestination = () => {
    if (!nav.dest) return;
    const r = addFavorite(profile, nav.dest, crypto.randomUUID(), new Date().toISOString());
    if (!r.added) {
      nav.report('Já está nos favoritos.');
      return;
    }
    update(() => r.profile);
    nav.report('Adicionado aos favoritos.');
  };

  const openProfile = () => {
    setMessage(null);
    setProfileOpen(true);
  };

  const closeProfile = () => {
    setProfileOpen(false);
    setMessage(null);
  };

  const goTo = (place: Place) => {
    closeProfile();
    nav.choose(place);
  };

  // cancelar o Compartilhar não é erro para o usuário
  const share = (task: Promise<void>) => {
    void task.catch((e: unknown) => {
      if (!(e instanceof Error && /cancel/i.test(e.message))) setMessage('Erro ao exportar.');
    });
  };

  const exportProfile = () =>
    share(shareTextFile('perfil-semaforo.json', serializeProfile(profile), 'application/json', 'Perfil NitRotas'));

  const importProfile = async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage('Arquivo inválido.');
      return;
    }
    try {
      const parsed = parseProfile(JSON.parse(await file.text()));
      if (!parsed) throw new Error('inválido');
      update((cur) => mergeImported(cur, parsed));
      setMessage('Perfil importado.');
    } catch {
      setMessage('Arquivo inválido.');
    }
  };

  useWakeLock(mode === 'drive' && profile.settings.keepAwake);

  useEffect(() => {
    void loadBaseLights(BASE_LIGHTS_URL).then((r) => {
      setBase(r.lights);
      if (r.warning) setMessage(r.warning);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(t);
  }, [message]);

  useEffect(() => {
    saveLocal(local);
  }, [local]);

  const onMapClick = useCallback(
    (lat: number, lon: number) => {
      if (mode === 'edit') {
        setSelectedId(null);
        setDraft((d) => (!d || d.bearing !== null ? { lat, lon, bearing: null } : { ...d, bearing: bearingDeg(d, { lat, lon }) }));
        return;
      }
      moveSimulation(lat, lon);
    },
    [mode],
  );

  const onLightClick = useCallback(
    (id: string, lat: number, lon: number) => {
      if (mode === 'edit') {
        setDraft(null);
        setSelectedId(id);
        return;
      }
      moveSimulation(lat, lon);
    },
    [mode],
  );

  const selected = lights.find((l) => l.id === selectedId) ?? null;

  const saveDraft = (name: string) => {
    if (!draft || draft.bearing === null) return;
    const trimmed = name.trim();
    const light: TrafficLight = {
      id: crypto.randomUUID(),
      lat: draft.lat,
      lon: draft.lon,
      approachBearing: draft.bearing,
      createdAt: new Date().toISOString(),
      source: 'manual',
      ...(trimmed ? { name: trimmed } : {}),
    };
    setLocal((s) => upsertLight(s, light));
    setDraft(null);
    setMessage('Semáforo salvo.');
  };

  const rename = (id: string, name: string) => {
    const l = lights.find((x) => x.id === id);
    if (!l) return;
    const { name: _previous, ...rest } = l;
    const trimmed = name.trim();
    setLocal((s) => upsertLight(s, trimmed ? { ...rest, name: trimmed } : rest));
    setMessage('Nome salvo.');
  };

  const remove = (id: string) => {
    setLocal((s) => removeLight(s, id));
    setSelectedId(null);
    setMessage('Semáforo excluído.');
  };

  const importFile = async (file: File) => {
    if (file.size > MAX_IMPORT_BYTES) {
      setMessage('Arquivo muito grande.');
      return;
    }
    try {
      const { lights: imported, rejected } = parseLightsGeoJSON(JSON.parse(await file.text()));
      setLocal((s) => imported.reduce(upsertLight, s));
      setMessage(`${imported.length} importado(s)${rejected ? `, ${rejected} rejeitado(s)` : ''}.`);
    } catch (e) {
      setMessage(`Erro ao importar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const toggleEdit = () => {
    setMode((m) => (m === 'edit' ? 'drive' : 'edit'));
    setDraft(null);
    setSelectedId(null);
    setMessage(null);
  };

  return (
    <div className={nav.phase === 'active' ? 'app nav-active' : 'app'}>
      <MapView
        fix={fix}
        heading={heading}
        lights={lights}
        nextId={next?.kind === 'found' ? next.light.id : null}
        follow={follow && mode === 'drive'}
        navigating={nav.phase === 'active'}
        draft={mode === 'edit' ? draft : null}
        routeLine={nav.route?.line ?? null}
        routeCongestion={profile.settings.showTraffic ? (nav.route?.congestion ?? null) : null}
        routeIds={nav.phase === 'preview' || nav.phase === 'active' ? nav.routeIds : null}
        fitRoute={nav.phase === 'preview'}
        onUserPan={() => setFollow(false)}
        onMapClick={onMapClick}
        onLightClick={onLightClick}
        onReady={onReady}
      />

      {mode === 'drive' && (
        <div className="top">
          {nav.phase === 'idle' && (
            <>
              <div className="search-row">
                <SearchBar suggestions={buildSuggestions(profile)} busy={false} onChoose={nav.choose} onError={nav.report} />
                <button className="avatar" onClick={openProfile} aria-label="Perfil">{initialOf(profile.name)}</button>
              </div>
              <StreetBanner road={road} heading={heading} />
            </>
          )}
          {(nav.phase === 'loading' || nav.phase === 'preview') && <PreviewHeader dest={nav.dest} onCancel={nav.cancel} />}
          {nav.phase === 'active' && <NavBanner road={road} next={next} />}
          <WrongWayAlert active={wrongWay} />
        </div>
      )}

      {profileOpen && (
        <ProfilePanel
          profile={profile}
          lightCount={local.lights.length}
          notice={message}
          onClose={closeProfile}
          onGo={goTo}
          onChange={update}
          onExportLights={() => share(exportLights(lights))}
          onImportLights={(f) => void importFile(f)}
          onEditLights={() => { closeProfile(); setMode('edit'); }}
          onExportProfile={exportProfile}
          onImportProfile={(f) => void importProfile(f)}
        />
      )}

      <div className="toolbar">
        {!follow && mode === 'drive' && (
          <button onClick={() => setFollow(true)} title="Seguir posição">🎯</button>
        )}
        <button className={mode === 'edit' ? 'active' : ''} onClick={toggleEdit} title="Modo cadastro">✏️</button>
        <button className={simulation ? 'active' : ''} onClick={() => setSimulation((s) => !s)} title="Simulação">🧪</button>
      </div>

      {simulation && mode === 'drive' && <div className="sim-hint">Simulação: clique no mapa para mover</div>}

      <div className="bottom">
        {mode === 'drive' && (message ?? nav.message) && <div className="toast">{message ?? nav.message}</div>}
        {mode === 'drive' && (nav.phase === 'loading' || nav.phase === 'preview') && (
          <RouteCard
            phase={nav.phase}
            route={nav.route}
            lightCount={nav.routeLights.length}
            onStart={startRoute}
            onFavorite={favoriteDestination}
            onCancel={nav.cancel}
            onSave={saveDestination}
          />
        )}
        {mode === 'drive' && nav.phase === 'active' && remaining && (
          <NavFooter remainingS={remaining.durationS} remainingM={remaining.distanceM} speed={fix?.speed ?? null} onStop={nav.cancel} />
        )}
        {mode === 'drive' ? (
          nav.phase === 'idle' && <DriverPanel fix={fix} error={error} next={next} />
        ) : (
          <EditPanel
            draft={draft}
            selected={selected}
            message={message}
            onSaveDraft={saveDraft}
            onCancelDraft={() => setDraft(null)}
            onRename={rename}
            onDelete={remove}
            onCloseSelected={() => setSelectedId(null)}
            onExport={() => share(exportLights(lights))}
            onImport={(f) => void importFile(f)}
            onExit={toggleEdit}
          />
        )}
        <div className="disclaimer" hidden={nav.phase !== 'idle'}>
          Protótipo. Informação apenas indicativa. Dados © OpenStreetMap contributors, OpenFreeMap.
        </div>
      </div>
    </div>
  );
}
