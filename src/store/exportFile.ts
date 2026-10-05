import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { TrafficLight } from '../types';
import { isNative } from '../platform';
import { lightsToGeoJSON } from './geojson';
import { downloadTextFile } from './localStore';

/** Web: baixa o arquivo. Android: grava no cache e abre o Compartilhar do sistema. */
export async function shareTextFile(filename: string, text: string, mime: string, title: string): Promise<void> {
  if (!isNative()) {
    downloadTextFile(text, filename, mime);
    return;
  }
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title, files: [uri] });
}

export const exportLights = (lights: TrafficLight[]): Promise<void> =>
  shareTextFile(
    'traffic_lights.geojson',
    JSON.stringify(lightsToGeoJSON(lights), null, 2),
    'application/geo+json',
    'Semáforos cadastrados',
  );
