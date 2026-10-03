import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { TrafficLight } from '../types';
import { isNative } from '../platform';
import { lightsToGeoJSON } from './geojson';
import { downloadGeoJSON } from './localStore';

const FILENAME = 'traffic_lights.geojson';

/** Web: baixa o arquivo. Android: grava no cache e abre o Compartilhar do sistema. */
export async function exportLights(lights: TrafficLight[]): Promise<void> {
  if (!isNative()) {
    downloadGeoJSON(lights, FILENAME);
    return;
  }
  const { uri } = await Filesystem.writeFile({
    path: FILENAME,
    data: JSON.stringify(lightsToGeoJSON(lights), null, 2),
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: 'Semáforos cadastrados', files: [uri] });
}
