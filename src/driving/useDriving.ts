import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Map as MbMap } from 'mapbox-gl';
import type { Fix, LatLon, NextResult, RoadSource, TrafficLight } from '../types';
import type { RoadInfo } from '../ui/StreetBanner';
import { HeadingTracker } from '../nearest/heading';
import { findNextTrafficLight } from '../nearest/nearest';
import { allowedBearing, MATCH_DEFAULTS, matchRoad, nearestName, type RoadMatch } from '../roads/match';
import { looseRadius, snapFixToSegment } from '../roads/snapToRoad';
import { WrongWayDetector } from '../roads/wrongWay';
import { createTileRoadSource } from '../roads/tileRoads';
import { createLocationSource } from '../location/factory';
import { SimulatedSource } from '../location/simulated';
import { FixFilter } from '../location/fixFilter';
import { snapToRoute } from '../routing/snapToRoute';
import { isNative } from '../platform';

const ROAD_SEARCH_RADIUS_M = 40;

interface Inputs {
  simulation: boolean;
  routeLineRef: MutableRefObject<LatLon[] | null>;
  alertLightsRef: MutableRefObject<TrafficLight[]>;
}

export function useDriving({ simulation, routeLineRef, alertLightsRef }: Inputs) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [navFix, setNavFix] = useState<Fix | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [next, setNext] = useState<NextResult | null>(null);
  const [road, setRoad] = useState<RoadInfo | null>(null);
  const [wrongWay, setWrongWay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixFilter = useRef(new FixFilter());
  const headingTracker = useRef(new HeadingTracker());
  const wrongWayDetector = useRef(new WrongWayDetector());
  const prevNextId = useRef<string | null>(null);
  const prevRoadId = useRef<string | null>(null);
  const prevLooseRoadId = useRef<string | null>(null);
  const roadSource = useRef<RoadSource | null>(null);
  const simSource = useRef<SimulatedSource | null>(null);

  const handleFix = useCallback(
    (raw: Fix) => {
      const filtered = fixFilter.current.update(raw);
      if (!filtered) return;
      setError(null);
      let f = filtered;
      let h = headingTracker.current.update(f);

      const snapped = snapToRoute(f, h, routeLineRef.current);
      const routeSnapped = snapped.fix !== f;
      f = snapped.fix;
      h = snapped.heading;
      const pos = { lat: f.lat, lon: f.lon };

      const n = findNextTrafficLight(pos, h, alertLightsRef.current, prevNextId.current);
      prevNextId.current = n.kind === 'found' ? n.light.id : null;

      let shown = f;
      let match: RoadMatch | null = null;
      let info: RoadInfo | null = null;
      const rs = roadSource.current;
      if (rs) {
        const near = rs.segmentsNear(f.lat, f.lon, ROAD_SEARCH_RADIUS_M);
        match = matchRoad(pos, h, near, prevRoadId.current);
        prevRoadId.current = match?.segment.id ?? null;
        if (!routeSnapped) {
          const loose = matchRoad(pos, h, near, prevLooseRoadId.current, { ...MATCH_DEFAULTS, maxDistance: looseRadius(f.accuracy) });
          prevLooseRoadId.current = loose?.segment.id ?? null;
          if (loose) shown = snapFixToSegment(f, loose.segment.coords);
        }
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
      setFix(shown);
      setHeading(h);
      setNext(n);
      setRoad(info);
    },
    [routeLineRef, alertLightsRef],
  );

  useEffect(() => {
    fixFilter.current = new FixFilter();
    headingTracker.current = new HeadingTracker();
    wrongWayDetector.current = new WrongWayDetector();
    prevNextId.current = null;
    prevRoadId.current = null;
    prevLooseRoadId.current = null;
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

  const moveSimulation = useCallback((lat: number, lon: number) => simSource.current?.moveTo(lat, lon), []);

  return { fix, navFix, heading, next, road, wrongWay, error, onReady, moveSimulation };
}
