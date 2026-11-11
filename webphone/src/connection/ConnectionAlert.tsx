import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, CheckCircle2 } from 'lucide-react';
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
  // After an interruption, a green confirmation stays three seconds then disappears.
  const [restored, setRestored] = useState(false);
  const previous = useRef<ConnectionQuality['level']>('unknown');
  useEffect(() => {
    const was = previous.current; previous.current = quality.level;
    if (quality.level !== 'good') { setRestored(false); return; }
    if (was !== 'lost') return;
    setRestored(true);
    const timer = window.setTimeout(() => setRestored(false), 3000);
    return () => window.clearTimeout(timer);
  }, [quality.level]);
  const visible = quality.level === 'slow' || quality.level === 'lost' || restored;
  useLayoutEffect(() => {
    const root = document.documentElement;
    const measure = () => root.style.setProperty('--connection-space', visible ? `${bar.current?.offsetHeight ?? 0}px` : '0px');
    const observer = new ResizeObserver(measure);
    if (bar.current) observer.observe(bar.current);
    measure();
    return () => { observer.disconnect(); root.style.removeProperty('--connection-space'); };
  }, [visible]);
  const lost = quality.level === 'lost';
  const ok = restored && quality.level === 'good';
  return <aside ref={bar} className={`connection-alert${lost ? ' is-lost' : ok ? ' is-restored' : ''}`} hidden={!visible}
    role="status" aria-live="polite" aria-atomic="true">
    {ok ? <CheckCircle2 size={20} aria-hidden="true" /> : lost ? <WifiOff size={20} aria-hidden="true" /> : <Wifi size={20} aria-hidden="true" />}
    <span><strong>{t(ok ? 'quality.restored' : lost ? quality.source === 'media' ? 'quality.audioLost' : 'quality.lost' : 'quality.slow')}</strong>
      <span>{t(ok ? 'quality.restoredDetail' : lost ? 'quality.checkNetwork' : 'quality.impact')}</span></span>
  </aside>;
}
