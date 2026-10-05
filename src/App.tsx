import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MbMap } from 'mapbox-gl';
import type { Fix, LatLon, LocalState, NextResult, RoadSource, TrafficLight } from './types';
import { MapView, type Draft } from './ui/MapView';
import { DriverPanel } from './ui/DriverPanel';
import { StreetBanner, type RoadInfo } from './ui/StreetBanner';
import { WrongWayAlert } from './ui/WrongWayAlert';
import { SearchBar } from './ui/SearchBar';
import { RouteCard } from './ui/RouteCard';
import { useNavigation } from './routing/useNavigation';
import { loadPlaces, savePlaces, withPlace } from './places/savedPlaces';
import type { SavedPlaces, SlotName } from './routing/types';
import { EditPanel } from './ui/EditPanel';
import { useWakeLock } from './ui/useWakeLock';
import { HeadingTracker } from './nearest/heading';
import { findNextTrafficLight } from './nearest/nearest';
import { allowedBearing, matchRoad, nearestName, type RoadMatch } from './roads/match';
import { WrongWayDetector } from './roads/wrongWay';
import { createTileRoadSource } from './roads/tileRoads';
import { createLocationSource } from './location/factory';
import { isNative } from './platform';
import { SimulatedSource } from './location/simulated';
import { mergeLights, parseLightsGeoJSON } from './store/geojson';
import { loadBaseLights, loadLocal, saveLocal } from './store/localStore';
import { exportLights } from './store/exportFile';
import { removeLight, upsertLight } from './store/localState';
import { angleDiff, bearingDeg, snapToLine } from './geo/geo';
import { FixFilter } from './location/fixFilter';

const BASE_LIGHTS_URL = `${import.meta.env.BASE_URL}data/traffic_lights.geojson`;
const ROAD_SEARCH_RADIUS_M = 40;
const SNAP_MAX_M = 30;
const SNAP_MAX_ANGLE = 60;
const MOVING_MPS = 1.5;

export default function App() {
  const [base, setBase] = useState<TrafficLight[]>([]);
  const [local, setLocal] = useState<LocalState>(() => loadLocal());
  const lights = useMemo(() => mergeLights(base, local.lights, local.deleted), [base, local]);
  // lista que o motor de alertas enxerga: todos os semáforos, ou só os da rota quando há rota ativa
  const alertLightsRef = useRef<TrafficLight[]>(lights);

  const [simulation, setSimulation] = useState(() => new URLSearchParams(window.location.search).has('sim'));
  const [mode, setMode] = useState<'drive' | 'edit'>('drive');
  const [fix, setFix] = useState<Fix | null>(null);
  const [navFix, setNavFix] = useState<Fix | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [next, setNext] = useState<NextResult | null>(null);
  const [road, setRoad] = useState<RoadInfo | null>(null);
  const [wrongWay, setWrongWay] = useState(false);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPlaces>(() => loadPlaces());
  const nav = useNavigation(navFix, lights);
  const routeLineRef = useRef<LatLon[] | null>(null);
  routeLineRef.current = nav.phase === 'active' ? (nav.route?.line ?? null) : null;
  alertLightsRef.current = nav.phase === 'active' ? nav.routeLights : lights;

  useEffect(() => {
    savePlaces(saved);
  }, [saved]);

  // pré-visualização mostra a rota inteira; sem rota, volta a seguir o carro
  useEffect(() => {
    if (nav.phase === 'preview') setFollow(false);
    if (nav.phase === 'idle') setFollow(true);
  }, [nav.phase]);

  const startRoute = () => {
    nav.start();
    setFollow(true);
  };

  const saveDestination = (slot: SlotName) => {
    if (!nav.dest) return;
    setSaved((s) => withPlace(s, slot, nav.dest!));
    nav.report(slot === 'home' ? 'Salvo como Casa.' : 'Salvo como Trabalho.');
  };

  const fixFilter = useRef(new FixFilter());
  const headingTracker = useRef(new HeadingTracker());
  const wrongWayDetector = useRef(new WrongWayDetector());
  const prevNextId = useRef<string | null>(null);
  const prevRoadId = useRef<string | null>(null);
  const roadSource = useRef<RoadSource | null>(null);
  const simSource = useRef<SimulatedSource | null>(null);

  useWakeLock(mode === 'drive');

  useEffect(() => {
    void loadBaseLights(BASE_LIGHTS_URL).then((r) => {
      setBase(r.lights);
      if (r.warning) setMessage(r.warning);
    });
  }, []);

  useEffect(() => {
    saveLocal(local);
  }, [local]);

  const handleFix = useCallback((raw: Fix) => {
    const filtered = fixFilter.current.update(raw);
    if (!filtered) return;
    setError(null);
    let f = filtered;
    let h = headingTracker.current.update(f);

    const line = routeLineRef.current;
    const snap = line ? snapToLine(f, line) : null;
    if (snap && snap.distance <= SNAP_MAX_M) {
      f = { ...f, lat: snap.point.lat, lon: snap.point.lon };
      const moving = f.speed === null || f.speed >= MOVING_MPS;
      if (moving && (h === null || angleDiff(h, snap.bearing) < SNAP_MAX_ANGLE)) h = snap.bearing;
    }
    const pos = { lat: f.lat, lon: f.lon };

    const n = findNextTrafficLight(pos, h, alertLightsRef.current, prevNextId.current);
    prevNextId.current = n.kind === 'found' ? n.light.id : null;

    let match: RoadMatch | null = null;
    let info: RoadInfo | null = null;
    const rs = roadSource.current;
    if (rs) {
      match = matchRoad(pos, h, rs.segmentsNear(f.lat, f.lon, ROAD_SEARCH_RADIUS_M), prevRoadId.current);
      prevRoadId.current = match?.segment.id ?? null;
      if (match) {
        info = {
          name: match.segment.name ?? nearestName(pos, rs.namedSegmentsNear(f.lat, f.lon, ROAD_SEARCH_RADIUS_M)),
          oneway: match.segment.oneway,
          allowed: allowedBearing(match),
        };
      }
    }

    setWrongWay(wrongWayDetector.current.update({ match, fix: f, heading: h }));
    setNavFix(filtered);
    setFix(f);
    setHeading(h);
    setNext(n);
    setRoad(info);
  }, []);

  useEffect(() => {
    fixFilter.current = new FixFilter();
    headingTracker.current = new HeadingTracker();
    wrongWayDetector.current = new WrongWayDetector();
    prevNextId.current = null;
    prevRoadId.current = null;
    setFix(null);
    setNavFix(null);
    setHeading(null);
    setNext(null);
    setRoad(null);
    setWrongWay(false);
    setError(null);

    const src = createLocationSource({ simulation, native: isNative() });
    simSource.current = src instanceof SimulatedSource ? src : null;
    src.start(handleFix, setError);
    return () => src.stop();
  }, [simulation, handleFix]);

  const onReady = useCallback((map: MbMap) => {
    roadSource.current = createTileRoadSource(map);
  }, []);

  const onMapClick = useCallback(
    (lat: number, lon: number) => {
      if (mode === 'edit') {
        setSelectedId(null);
        setDraft((d) => (!d || d.bearing !== null ? { lat, lon, bearing: null } : { ...d, bearing: bearingDeg(d, { lat, lon }) }));
        return;
      }
      simSource.current?.moveTo(lat, lon);
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
      simSource.current?.moveTo(lat, lon);
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
    <div className="app">
      <MapView
        fix={fix}
        heading={heading}
        lights={lights}
        nextId={next?.kind === 'found' ? next.light.id : null}
        follow={follow && mode === 'drive'}
        navigating={nav.phase === 'active'}
        draft={mode === 'edit' ? draft : null}
        routeLine={nav.route?.line ?? null}
        routeIds={nav.phase === 'preview' || nav.phase === 'active' ? nav.routeIds : null}
        fitRoute={nav.phase === 'preview'}
        onUserPan={() => setFollow(false)}
        onMapClick={onMapClick}
        onLightClick={onLightClick}
        onReady={onReady}
      />

      {mode === 'drive' && (
        <div className="top">
          {nav.phase !== 'active' && (
            <SearchBar saved={saved} busy={nav.phase === 'loading'} onChoose={nav.choose} onError={nav.report} />
          )}
          <StreetBanner road={road} heading={heading} />
          <WrongWayAlert active={wrongWay} />
        </div>
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
        {mode === 'drive' && message && <div className="toast">{message}</div>}
        {mode === 'drive' && nav.message && <div className="toast">{nav.message}</div>}
        {mode === 'drive' && nav.phase !== 'idle' && (
          <RouteCard
            phase={nav.phase}
            dest={nav.dest}
            route={nav.route}
            lightCount={nav.routeLights.length}
            onStart={startRoute}
            onCancel={nav.cancel}
            onSave={saveDestination}
          />
        )}
        {mode === 'drive' ? (
          <DriverPanel fix={fix} error={error} next={next} />
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
            onExport={() => {
              void exportLights(lights).catch((e: unknown) => {
                // cancelar o Compartilhar não é erro para o usuário
                if (!(e instanceof Error && /cancel/i.test(e.message))) setMessage('Erro ao exportar.');
              });
            }}
            onImport={(f) => void importFile(f)}
            onExit={toggleEdit}
          />
        )}
        <div className="disclaimer">
          Protótipo. Informação apenas indicativa. Dados © OpenStreetMap contributors, OpenFreeMap.
        </div>
      </div>
    </div>
  );
}
