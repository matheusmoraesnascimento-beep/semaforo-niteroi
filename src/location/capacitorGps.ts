import { Geolocation } from '@capacitor/geolocation';
import type { Fix, LocationSource } from '../types';
import { positionToFix } from './positionToFix';

const DENIED = 'Sem permissão de localização. Libere em Configurações › Apps › Semáforo Niterói › Permissões.';

export class CapacitorGpsSource implements LocationSource {
  private watchId: string | null = null;
  private stopped = false;

  start(onFix: (f: Fix) => void, onError: (msg: string) => void): void {
    this.stopped = false;
    void this.run(onFix, onError);
  }

  private async run(onFix: (f: Fix) => void, onError: (msg: string) => void): Promise<void> {
    try {
      let perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') perm = await Geolocation.requestPermissions({ permissions: ['location'] });
      if (perm.location !== 'granted') {
        onError(DENIED);
        return;
      }
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0, interval: 1000, minimumUpdateInterval: 500 },
        (position, err) => {
          if (err || !position) onError('GPS indisponível');
          else onFix(positionToFix(position));
        },
      );
      if (this.stopped) void Geolocation.clearWatch({ id });
      else this.watchId = id;
    } catch {
      onError('GPS indisponível. Verifique se a localização do aparelho está ligada.');
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.watchId !== null) void Geolocation.clearWatch({ id: this.watchId });
    this.watchId = null;
  }
}
