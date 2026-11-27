import { createRoot } from 'react-dom/client';
import { useEffect, useSyncExternalStore } from 'react';
import { SipPhoneController, type ManagedSession, type Manager, type ManagerDelegate } from '../../src/telephony/SipPhoneController';
import { DemoRecordingsSource } from '../../src/recordings/client';
import { useLineHistory, useServerCallOutcome } from '../../src/features/history/useLineHistory';
import { outcomeLabel } from '../../src/domain/types';
import { setLanguage, useI18n, type Language } from '../../src/i18n';
import '../../src/styles/tokens.css';
import '../../src/styles/app.css';

let delegate: ManagerDelegate;
let request: Parameters<Manager['call']>[2];
const session: ManagedSession = { id: 'simulated', remoteIdentity: { uri: { user: '1001' } } };
const phone = new SipPhoneController({ domain: 'example.invalid', wssUrl: 'wss://example.invalid/ws' }, {
  createRemoteAudio: () => undefined,
  createManager: (_config, _credentials, target) => {
    delegate = target;
    return { contactName: 'simulation', connect: async () => delegate.onServerConnect(), isConnected: () => true,
      register: async () => delegate.onRegistered(), unregister: async () => undefined, disconnect: async () => undefined,
      call: async (_destination, _options, invite) => { request = invite; delegate.onCallCreated(session); },
      answer: async () => undefined, decline: async () => undefined, hangup: async () => undefined, hold: async () => undefined,
      unhold: async () => undefined, mute: () => undefined, unmute: () => undefined, sendDTMF: async () => undefined,
      dropSilently: async () => undefined, holdsLine: async () => true, sentAudioPackets: async () => 0,
    };
  },
});
const source = new DemoRecordingsSource();
source.history = async () => {
  const call = phone.getSnapshot().call;
  return { page: 1, pageCount: 1, truncated: false, catchingUp: false, stale: false,
    calls: call?.phase === 'ended' && call.awaitingServerOutcome ? [{ id: 'server-simulated', number: '1001', direction: 'outbound', startedAt: call.startedAt, endedAt: call.endedAt, outcome: 'busy' }] : [] };
};
export function Preview() {
  const snapshot = useSyncExternalStore(phone.subscribe, phone.getSnapshot);
  const { language } = useI18n();
  const history = useLineHistory(source, snapshot.connection === 'ready', snapshot.connection);
  useServerCallOutcome(phone, snapshot.call, history, true);
  useEffect(() => { void phone.connect({ username: 'simulation', password: 'fictional' }); return () => { void phone.disconnect(); }; }, []);
  const simulate = (status: number, reason = '', header = '') => {
    phone.dismiss(); phone.call('1001', '1001');
    request.requestDelegate.onReject({ message: { statusCode: status, reasonPhrase: reason, getHeader: () => header } });
    delegate.onCallHangup(session);
  };
  return <main style={{ width: 'min(680px,100%)', margin: '24px auto', padding: 16 }}>
    <h1>ApisnixPhone · diagnostics</h1><p>Simulation locale — aucun appel réel</p>
    <label>Langue <select aria-label="Langue" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="fr">Français</option><option value="en">English</option><option value="es">Español</option></select></label>
    <div className="tags" style={{ margin: '20px 0' }}>
      <button onClick={() => simulate(480)}>480 + serveur occupé</button>
      <button onClick={() => simulate(480, '', 'Q.850;cause=17')}>Occupé Q.850</button>
      <button onClick={() => simulate(404)}>404 générique</button>
      <button onClick={() => simulate(403, 'Insufficient Balance')}>Crédit insuffisant</button>
      <button onClick={() => simulate(480, '', 'Q.850;cause=19')}>Sans réponse</button>
      <button onClick={() => simulate(480, 'Call limit reached')}>Limite d’appels</button>
      <button onClick={() => simulate(488)}>Audio refusé</button>
    </div>
    <section className="dock-card call-card" style={{ padding: 24 }}>
      <h2>1001</h2>
      {snapshot.call?.failure && <p className="call-failure" role="alert">{snapshot.call.failure}</p>}
      <p className={'outcome outcome-' + snapshot.call?.outcome}>{outcomeLabel(snapshot.call?.outcome ?? 'unknown')}</p>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Preview />);
