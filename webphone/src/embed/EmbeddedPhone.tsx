import { configureEmbeddedSession } from '../http/embeddedSession';
import { useEffect, useRef, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { App } from '../app/App';
import { AppProvider, useApp, usePhone } from '../app/AppContext';
import { useI18n } from '../i18n';
import { allowedOrigins, authorizedMessage, command, envelope, PROTOCOL, type PhoneEvent } from './protocol';
import { prepareResult, publicCall, publicState } from './state';

type Parent = { origin: string; channel: string };
const origins = allowedOrigins(import.meta.env.VITE_EMBED_ALLOWED_ORIGINS, location.origin, import.meta.env.VITE_APP_MODE !== 'live', import.meta.env.DEV);
function Phone({ parent }: { parent: Parent }) {
  const { phone, sessionOpen, setDial, setView, logout } = useApp();
  const snapshot = usePhone();
  const { t } = useI18n();
  const seenCalls = useRef(new Map<string, string>());
  useEffect(() => {
    const send = (event: PhoneEvent) => window.parent.postMessage({ ...event, protocol: PROTOCOL, channel: parent.channel }, parent.origin);
    send({ type: 'ready' });
    send({ type: 'state', state: publicState(phone.getSnapshot(), sessionOpen) });
    const receive = (event: MessageEvent<unknown>) => {
      if (!authorizedMessage(event, window.parent, new Set([parent.origin]), parent.channel)) return;
      if (envelope(event.data) && event.data.type === 'hello') {
        send({ type: 'ready' }); send({ type: 'state', state: publicState(phone.getSnapshot(), sessionOpen) });
      }
      if (!command(event.data)) return;
      const code = prepareResult(event.data.number, phone.getSnapshot(), sessionOpen);
      if (code === 'prepared') {
        if (phone.getSnapshot().call?.phase === 'ended') phone.dismiss();
        setDial(event.data.number); setView('phone');
      }
      send({ type: 'result', requestId: event.data.requestId, code });
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [parent, phone, sessionOpen, setDial, setView]);
  useEffect(() => {
    window.parent.postMessage({ protocol: PROTOCOL, channel: parent.channel, type: 'state', state: publicState(snapshot, sessionOpen) }, parent.origin);
    if (!sessionOpen) { seenCalls.current.clear(); return; }
    for (const call of [...snapshot.completedCalls ?? [], snapshot.call, snapshot.otherCall]) {
      if (!call) continue;
      const value = publicCall(call);
      const signature = JSON.stringify(value);
      if (seenCalls.current.get(call.id) === signature) continue;
      seenCalls.current.set(call.id, signature);
      window.parent.postMessage({ protocol: PROTOCOL, channel: parent.channel, type: 'call', call: value }, parent.origin);
    }
    // Keep only a small replay window, even through long agent sessions.
    if (seenCalls.current.size > 100) seenCalls.current.delete(seenCalls.current.keys().next().value!);
  }, [snapshot, sessionOpen, parent]);
  // Kept in the embedded header because the ordinary mobile phone view hides its top bar.
  const signOut = () => {
    if (publicState(snapshot, sessionOpen).inCall && !confirm(t('confirm.signOutInCall'))) return;
    void logout();
  };
  return <div className="embed-root">
    <header className="embed-header"><img src="/apisnix-mark.png" alt="" width={28} height={28} /><strong>ApisnixPhone</strong>
      <span>{sessionOpen ? t('embed.line', { phone: snapshot.account?.username ?? '' }) : t('embed.secure')}</span>
      {sessionOpen && <button className="icon-button" aria-label={t('action.signOut')} onClick={signOut}><LogOut size={17} /></button>}
    </header>
    <div className="embed-body"><App embedded /></div>
  </div>;
}
export function EmbeddedPhone() {
  const [parent, setParent] = useState<Parent | null>(null);
  const { t } = useI18n();
  useEffect(() => {
    let stopped = false;
    let checking = false;
    const receive = async (event: MessageEvent<unknown>) => {
      if (window.parent === window || event.source !== window.parent || !envelope(event.data) || event.data.type !== 'hello' || parent || checking) return;
      const next = { origin: event.origin, channel: event.data.channel };
      checking = true;
      try {
        let permitted = origins.has(next.origin);
        if (import.meta.env.VITE_APP_MODE === 'live' && !import.meta.env.DEV || !permitted) {
          const response = await fetch('/api/embed-policy?origin=' + encodeURIComponent(next.origin), { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000) });
          const value = response.ok ? await response.json() : null;
          permitted = value?.allowed === true && value.origin === next.origin;
        }
        if (!stopped && permitted) {
          if (import.meta.env.VITE_APP_MODE === 'live') configureEmbeddedSession(next.origin);
          setParent(current => current ?? next);
        }
      } catch { /* An unavailable policy never authorizes a parent. */ }
      finally { checking = false; }
    };
    window.addEventListener('message', receive);
    return () => { stopped = true; window.removeEventListener('message', receive); };
  }, [parent]);
  if (!parent) return <main className="embed-wait"><ShieldCheck size={32} /><h1>{t('embed.waitTitle')}</h1><p>{t('embed.waitText')}</p></main>;
  return <AppProvider embedded><Phone parent={parent} /></AppProvider>;
}
