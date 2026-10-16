import { useCallback, useEffect, useRef, useState } from 'react';
import { usePhone } from '../../app/AppContext';

interface Devices { inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }

/** Read again after capture starts: mobile browsers may expose routes only then. */
export function useDevices(enabled: boolean): [Devices, () => void] {
  const { call } = usePhone();
  const [devices, setDevices] = useState<Devices>({ inputs: [], outputs: [] });
  const refresh = useRef(() => undefined as void);
  useEffect(() => {
    if (!enabled || !navigator.mediaDevices?.enumerateDevices) return;
    let alive = true;
    let generation = 0;
    const read = () => {
      const current = ++generation;
      void navigator.mediaDevices.enumerateDevices().then(all => {
        if (!alive || current !== generation) return;
        setDevices({
          inputs: all.filter(d => d.kind === 'audioinput' && d.label && d.deviceId !== 'default'),
          outputs: all.filter(d => d.kind === 'audiooutput' && d.deviceId),
        });
      }).catch(() => undefined);
    };
    const visible = () => { if (document.visibilityState === 'visible') read(); };
    refresh.current = read;
    read();
    navigator.mediaDevices.addEventListener('devicechange', read);
    window.addEventListener('focus', read);
    document.addEventListener('visibilitychange', visible);
    return () => {
      alive = false;
      refresh.current = () => undefined;
      navigator.mediaDevices.removeEventListener('devicechange', read);
      window.removeEventListener('focus', read);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [enabled, call?.phase]);
  return [devices, useCallback(() => refresh.current(), [])];
}
