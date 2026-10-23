import { Headphones, Mic, MicOff, PhoneIncoming, Volume2 } from 'lucide-react';
import { useApp, usePhone } from '../app/AppContext';
import { Login } from '../features/auth/Login';
import { useI18n } from '../i18n';

/** VICIdial owns customer dialing/hangup. This pane owns only the persistent SIP audio leg. */
export function ConferencePhone() {
  const { phone, sessionOpen } = useApp();
  const snapshot = usePhone();
  const { t } = useI18n();
  if (!sessionOpen) return <Login embedded />;
  const connected = snapshot.connection === 'ready' && snapshot.call?.phase === 'active';
  const incoming = snapshot.call?.phase === 'ringing-in';
  return <main className="conference-phone">
    <Headphones size={36} /><h1>{t('conference.title')}</h1>
    <p className={connected ? 'conference-connected' : ''} role="status">{t(connected ? 'conference.connected' : incoming ? 'conference.incoming' : 'conference.waiting')}</p>
    <p>{t('conference.help')}</p>
    {incoming && <button className="primary-button" onClick={() => phone.answer()}><PhoneIncoming size={18} />{t('conference.answer')}</button>}
    {connected && <button className="secondary-button" aria-pressed={snapshot.call?.muted} onClick={() => phone.setMuted(!snapshot.call?.muted)}>{snapshot.call?.muted ? <MicOff size={18} /> : <Mic size={18} />}{t(snapshot.call?.muted ? 'conference.unmute' : 'conference.mute')}</button>}
    {snapshot.audioBlocked && <button className="secondary-button" onClick={() => phone.resumeAudio()}><Volume2 size={18} />{t('conference.audio')}</button>}
    {snapshot.error && <p role="alert">{snapshot.error}</p>}
    {snapshot.demo && <small>{t('integration.demoTitle')}</small>}
  </main>;
}
