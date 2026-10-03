import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Fix, TrafficLight } from '../types';
import type { Place, RouteResult } from './types';
import { fetchRoute } from './route';
import { lightsOnRoute } from './routeLights';
import { OffRouteDetector, distanceToRoute } from './offRoute';
import { errorMessage } from './errors';
import { distanceM } from '../geo/geo';

export type NavPhase = 'idle' | 'loading' | 'preview' | 'active';

const ARRIVAL_M = 30;
const REROUTE_MIN_INTERVAL_MS = 15000;
const MESSAGE_MS = 6000;

export function useNavigation(fix: Fix | null, lights: TrafficLight[]) {
  const [phase, setPhase] = useState<NavPhase>('idle');
  const [dest, setDest] = useState<Place | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fixRef = useRef(fix);
  fixRef.current = fix;
  const requestId = useRef(0);
  const detector = useRef(new OffRouteDetector());
  const lastReroute = useRef(0);
  const rerouting = useRef(false);

  const routeLights = useMemo(
    () => (route ? lightsOnRoute(route.line, lights).map((r) => r.light) : []),
    [route, lights],
  );
  const routeIds = useMemo(() => new Set(routeLights.map((l) => l.id)), [routeLights]);

  const reset = useCallback(() => {
    requestId.current++;
    rerouting.current = false;
    detector.current.reset();
    setPhase('idle');
    setDest(null);
    setRoute(null);
  }, []);

  const choose = useCallback(
    (place: Place) => {
      const from = fixRef.current;
      if (!from) {
        setMessage('Aguarde o GPS para traçar a rota.');
        return;
      }
      const id = ++requestId.current;
      setMessage(null);
      setDest(place);
      setRoute(null);
      setPhase('loading');
      fetchRoute(from, place)
        .then((r) => {
          if (id !== requestId.current) return;
          setRoute(r);
          setPhase('preview');
        })
        .catch((e: unknown) => {
          if (id !== requestId.current) return;
          reset();
          setMessage(errorMessage(e));
        });
    },
    [reset],
  );

  const start = useCallback(() => {
    detector.current.reset();
    lastReroute.current = 0;
    setPhase((p) => (p === 'preview' ? 'active' : p));
  }, []);

  const cancel = useCallback(() => {
    reset();
    setMessage(null);
  }, [reset]);

  const report = useCallback((msg: string) => setMessage(msg), []);

  // rota ativa: chegada e desvio
  useEffect(() => {
    if (phase !== 'active' || !route || !dest || !fix) return;
    if (distanceM(fix, dest) < ARRIVAL_M) {
      reset();
      setMessage('Você chegou ao destino.');
      return;
    }
    const off = detector.current.update(distanceToRoute(fix, route.line), fix.timestamp);
    if (!off || rerouting.current || fix.timestamp - lastReroute.current < REROUTE_MIN_INTERVAL_MS) return;

    rerouting.current = true;
    lastReroute.current = fix.timestamp;
    const id = requestId.current;
    fetchRoute(fix, dest)
      .then((r) => {
        if (id === requestId.current) setRoute(r);
      })
      .catch(() => {
        if (id === requestId.current) setMessage('Não consegui recalcular a rota.');
      })
      .finally(() => {
        rerouting.current = false;
      });
  }, [fix, phase, route, dest, reset]);

  // mensagens somem sozinhas
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(t);
  }, [message]);

  return { phase, dest, route, routeLights, routeIds, message, choose, start, cancel, report };
}
