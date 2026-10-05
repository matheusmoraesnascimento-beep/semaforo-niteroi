import type { Fix, LocationSource } from '../types';
import { positionToFix } from './positionToFix';

export class BrowserGpsSource implements LocationSource {
  private watchId: number | null = null;

  start(onFix: (f: Fix) => void, onError: (msg: string) => void): void {
    if (!('geolocation' in navigator)) {
      onError('GPS indisponível neste navegador');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (p) => onFix(positionToFix(p)),
      (e) =>
        onError(
          e.code === e.PERMISSION_DENIED
            ? 'Sem permissão de localização. Libere a localização para este site nas configurações do navegador.'
            : 'GPS indisponível',
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
  }

  stop(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }
}
