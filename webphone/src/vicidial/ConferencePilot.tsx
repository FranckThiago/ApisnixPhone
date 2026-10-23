import { useEffect, useState, useSyncExternalStore } from 'react';
import { Headphones, Mic, MicOff } from 'lucide-react';
import { useI18n } from '../i18n';
import { bridgeState, ConferenceSimulation, PILOT_PROTOCOL, pilotOrigins } from './pilot';
import './pilot.css';

export function ConferencePilot() {
  const [simulation] = useState(() => new ConferenceSimulation());
  const [parent, setParent] = useState<{ origin: string; channel: string } | null>(null);
  const snapshot = useSyncExternalStore(simulation.phone.subscribe, simulation.phone.getSnapshot);
  const { t } = useI18n();
  const state = bridgeState(simulation.phone);
  const joining = snapshot.connection === 'connecting' || snapshot.connection === 'registering';
  useEffect(() => {
    const origins = pilotOrigins();
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || window.parent === window || !origins.has(event.origin)
        || event.data?.protocol !== PILOT_PROTOCOL || event.data?.type !== 'hello'
        || typeof event.data.channel !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(event.data.channel)) return;
      if (parent && (parent.origin !== event.origin || parent.channel !== event.data.channel)) return;
      setParent(current => current ?? { origin: event.origin, channel: event.data.channel });
      window.parent.postMessage({ protocol: PILOT_PROTOCOL, channel: event.data.channel, type: 'bridge', state: bridgeState(simulation.phone) }, event.origin);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [simulation, parent]);
  useEffect(() => {
    if (parent) window.parent.postMessage({ protocol: PILOT_PROTOCOL, channel: parent.channel, type: 'bridge', state: bridgeState(simulation.phone) }, parent.origin);
  }, [snapshot, parent, simulation]);
  if (!parent) return <main className="conference-pilot"><p>{t('embed.waitText')}</p></main>;
  return <main className="conference-pilot">
    <header><img src="/apisnix-mark.png" alt="" /><strong>ApisnixPhone API</strong><small>{t('pilot.demo')}</small></header>
    <Headphones size={29} className={state.connected ? 'connected' : ''} />
    <h2>{t(state.connected ? 'pilot.connected' : 'pilot.disconnected')}</h2>
    <p>{t(state.connected ? 'pilot.keep' : 'pilot.explain')}</p>
    {!state.connected ? <button disabled={joining} onClick={() => void simulation.join()}>{t(joining ? 'pilot.joining' : 'pilot.join')}</button>
      : <button onClick={() => simulation.phone.setMuted(!state.muted)}>{state.muted ? <MicOff size={17} /> : <Mic size={17} />}{t(state.muted ? 'pilot.unmute' : 'pilot.mute')}</button>}
    {state.connected && <button className="failure" onClick={() => void simulation.leave()}>{t('pilot.failure')}</button>}
    <footer>{t('pilot.noAudio')}</footer>
  </main>;
}
