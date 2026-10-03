import { useEffect } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { isNative } from '../platform';

/** Mantém a tela ligada enquanto `enabled`; reaplica ao voltar para a aba. Ignora se não houver suporte. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (isNative()) {
      if (!enabled) return;
      void KeepAwake.keepAwake().catch(() => {});
      return () => {
        void KeepAwake.allowSleep().catch(() => {});
      };
    }
    if (!enabled || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) void s.release();
        else sentinel = s;
      } catch {
        // negado ou sem suporte: segue sem wake lock
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [enabled]);
}
