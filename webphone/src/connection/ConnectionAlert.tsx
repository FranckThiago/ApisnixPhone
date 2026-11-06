import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useApp, usePhone } from '../app/AppContext';
import { useI18n } from '../i18n';
import { startConnectionMonitor, type ConnectionQuality } from './connection-monitor.mjs';

/** One passive monitor across sign-in, workspace and internal navigation. */
export function ConnectionAlert() {
  const { phone } = useApp();
  const { demo } = usePhone();
  const { t } = useI18n();
  const [quality, setQuality] = useState<ConnectionQuality>({ level: 'unknown', source: 'http' });
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (demo) return; // Demonstration never probes production.
    const domain = String(import.meta.env.VITE_SIP_DOMAIN).trim();
    return startConnectionMonitor({ url: `https://${domain}/agc/apisnix/connection-check.php`,
      readMedia: () => phone.readConnectionQuality?.() ?? Promise.resolve(null), onChange: setQuality });
  }, [demo, phone]);
  const visible = quality.level === 'slow' || quality.level === 'lost';
  useLayoutEffect(() => {
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--connection-space', visible ? `${bar.current?.offsetHeight ?? 0}px` : '0px');
    const observer = new ResizeObserver(measure);
    if (bar.current) observer.observe(bar.current);
    measure();
    return () => { observer.disconnect(); root.style.removeProperty('--connection-space'); };
  }, [visible]);
  const lost = quality.level === 'lost';
  return <aside ref={bar} className={`connection-alert${lost ? ' is-lost' : ''}`} hidden={!visible}
    role="status" aria-live="polite" aria-atomic="true">
    {lost ? <WifiOff size={20} aria-hidden="true" /> : <Wifi size={20} aria-hidden="true" />}
    <span><strong>{t(lost ? quality.source === 'media' ? 'quality.audioLost' : 'quality.lost' : 'quality.slow')}</strong>
      <span>{t(lost ? 'quality.checkNetwork' : 'quality.impact')}</span></span>
  </aside>;
}
