import type { Fix, LocationSource } from '../types';

export class BrowserGpsSource implements LocationSource {
  private watchId: number | null = null;

  start(onFix: (f: Fix) => void, onError: (msg: string) => void): void {
    if (!('geolocation' in navigator)) {
      onError('GPS indisponível neste navegador');
      return;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (p) =>
        onFix({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy: p.coords.accuracy,
          speed: p.coords.speed,
          heading: p.coords.heading === null || Number.isNaN(p.coords.heading) ? null : p.coords.heading,
          timestamp: p.timestamp,
        }),
      (e) =>
        onError(
          e.code === e.PERMISSION_DENIED
            ? 'Sem permissão de localização. Libere a localização para este site nas configurações do navegador.'
            : 'GPS indisponível',
        ),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
  }

  stop(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
  }
}
