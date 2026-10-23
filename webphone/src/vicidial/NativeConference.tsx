import { useEffect, useState, useSyncExternalStore } from 'react';
import { Headphones, Mic, MicOff, PhoneIncoming, Volume2 } from 'lucide-react';
import { SipPhoneController } from '../telephony/SipPhoneController';
import { browserSipEnvironment } from '../telephony/sipEnvironment';
import { setLanguage, useI18n } from '../i18n';
import { ContactCard } from '../embed/ContactCard';
import { validContact, type CustomerContact } from '../embed/contact';

const protocol = 'apisnixphone.native-conference.v1';
const api = '../conference/api.php';
const phone = new SipPhoneController({ domain: location.hostname, wssUrl: `wss://${location.hostname}:8089/ws`, embedded: true, mediaAccess: false }, browserSipEnvironment);
let token = '';
let channel = '';
let parentSeen = 0;
async function request(action: string) {
  const response = await fetch(api, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, action }) });
  if (!response.ok) throw new Error('session');
  return response.json();
}
export function NativeConference() {
  const { t } = useI18n();
  const state = useSyncExternalStore(phone.subscribe, phone.getSnapshot);
  const [bound, setBound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [contact, setContact] = useState<CustomerContact | null>(null);
  useEffect(() => {
    const receive = (e: MessageEvent) => {
      if (e.source !== parent || e.origin !== location.origin || e.data?.protocol !== protocol) return;
      if (!token && e.data.type === 'init' && /^[a-f0-9]{64}$/.test(e.data.token) && typeof e.data.channel === 'string') {
        token = e.data.token; channel = e.data.channel;
        setLanguage(e.data.language === 'en' || e.data.language === 'es' ? e.data.language : 'fr'); setBound(true);
      }
      if (!token || e.data.channel !== channel) return;
      parentSeen = Date.now();
      if (e.data.type === 'contact' && validContact(e.data.contact)) setContact(e.data.contact);
    };
    window.addEventListener('message', receive);
    const tick = setInterval(() => {
      if (!token) { parent.postMessage({ protocol, type: 'hello' }, location.origin); return; }
      const s = phone.getSnapshot();
      parent.postMessage({ protocol, channel, type: 'state', connected: s.connection === 'ready', incoming: s.call?.phase === 'ringing-in',
        audio: s.connection === 'ready' && s.call?.phase === 'active' && !s.audioBlocked, inCall: !!s.call && s.call.phase !== 'ended' }, location.origin);
      if (Date.now() - parentSeen > 15000) { void phone.disconnect(); setFailed(true); }
    }, 1000);
    const close = () => { void phone.disconnect(); token = ''; };
    window.addEventListener('pagehide', close);
    return () => { clearInterval(tick); window.removeEventListener('message', receive); window.removeEventListener('pagehide', close); };
  }, []);
  const connect = async () => {
    setBusy(true); setFailed(false);
    try {
      // The agent's gesture unlocks playback; no credentials in URL/storage/messages.
      phone.resumeAudio();
      const credentials = await request('bootstrap');
      if (phone.getSnapshot().connection !== 'offline') await phone.disconnect();
      await phone.connect({ username: credentials.username, password: credentials.password });
    } catch { setFailed(true); } finally { setBusy(false); }
  };
  const active = state.call?.phase === 'active';
  return <main className="conference-phone">
    <Headphones size={32} /><h1>{t('conference.title')}</h1>
    <p role="status" className={active ? 'conference-connected' : ''}>{t(active ? 'conference.connected' : 'conference.waiting')}</p>
    <p>{t('nativeConference.help')}</p>
    {(!state.account || ['network-error','auth-error','other-tab-active'].includes(state.connection)) && <button className="primary-button" disabled={!bound || busy} onClick={() => void connect()}>{t('nativeConference.connect')}</button>}
    {state.call?.phase === 'ringing-in' && <button className="primary-button" onClick={() => phone.answer()}><PhoneIncoming size={18} />{t('conference.answer')}</button>}
    {active && <button className="secondary-button" aria-pressed={state.call?.muted} onClick={() => phone.setMuted(!state.call?.muted)}>{state.call?.muted ? <MicOff size={18} /> : <Mic size={18} />}{t(state.call?.muted ? 'conference.unmute' : 'conference.mute')}</button>}
    {state.audioBlocked && <button className="secondary-button" onClick={() => phone.resumeAudio()}><Volume2 size={18} />{t('conference.audio')}</button>}
    {failed && <p role="alert">{t('nativeConference.expired')}</p>}
    {state.error && <p role="alert">{state.error}</p>}
    {contact && <ContactCard contact={contact} expanded />}
  </main>;
}
