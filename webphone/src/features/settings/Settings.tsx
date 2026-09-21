import { BellRing, Database, Headphones, Info, LogOut, Palette, PhoneIncoming } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { applyTheme } from '../../app/theme';
import type { Theme } from '../../domain/types';
import { MAX_AGE_DAYS, MAX_CALLS } from '../../storage/DataStore';
import { persistChoice } from '../../storage/persistence';
import { AudioSettings } from './AudioSettings';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="panel settings-section"><h2>{icon}{title}</h2>{children}</section>;
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange(value: boolean): void }) {
  return (
    <label className="setting"><span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" className="switch" checked={checked} onChange={event => onChange(event.target.checked)} /></label>
  );
}

export function Settings() {
  const { store, notify, simulateIncoming, logout, phone } = useApp();
  const { preferences, calls, contacts } = useData();
  const { account, demo } = usePhone();
  const profile = account ? `${account.domain}:${account.username}` : '';
  const set = store.setPreferences.bind(store);

  return (
    <div className="page">
      <header className="page-head"><div><p className="eyebrow">Votre confort</p><h1><span className="swoosh">Réglages</span></h1>
        <p className="lead">Audio, apparence et données conservées sur cet appareil.</p></div></header>
      <div className="settings-grid">
        <Section icon={<Headphones size={18} />} title="Audio">
          <AudioSettings />
          <Toggle label="Sonnerie" hint="Jouée pour un appel entrant." checked={preferences.ringtone} onChange={ringtone => set({ ringtone })} />
          <Toggle label="Sons de la ligne" hint="Carillon d’annonce quand la ligne est prête, deux notes descendantes si elle se coupe." checked={preferences.lineSounds} onChange={lineSounds => set({ lineSounds })} />
          <Toggle label="Annulation d’écho" checked={preferences.echoCancellation} onChange={echoCancellation => set({ echoCancellation })} />
          <Toggle label="Réduction de bruit" hint="Selon le matériel ; pris en compte au prochain appel." checked={preferences.noiseSuppression} onChange={noiseSuppression => set({ noiseSuppression })} />
        </Section>

        <Section icon={<Palette size={18} />} title="Apparence">
          <div className="setting"><span><b>Thème</b></span>
            <div className="segmented" role="group" aria-label="Thème">
              {([['light', 'Clair'], ['dark', 'Sombre'], ['system', 'Système']] as Array<[Theme, string]>).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={preferences.theme === value} className={preferences.theme === value ? 'active' : ''}
                  onClick={() => { set({ theme: value }); applyTheme(value); }}>{label}</button>))}
            </div></div>
          <div className="setting"><span><b>Densité</b></span>
            <div className="segmented" role="group" aria-label="Densité">
              {([['comfortable', 'Confortable'], ['compact', 'Compacte']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={preferences.density === value} className={preferences.density === value ? 'active' : ''}
                  onClick={() => set({ density: value })}>{label}</button>))}
            </div></div>
        </Section>

        <Section icon={<BellRing size={18} />} title="Appels">
          <Toggle label="Notifications du système" hint="Jamais demandées sans votre accord ; l’application fonctionne sans."
            checked={preferences.notifications} onChange={async wanted => {
              if (!wanted) return set({ notifications: false });
              // The demo never asks the browser for a permission.
              if (demo) { set({ notifications: true }); return notify('Démonstration : aucune permission demandée.'); }
              if (typeof Notification === 'undefined') return notify('Notifications indisponibles dans ce navigateur.', 'danger');
              set({ notifications: (await Notification.requestPermission()) === 'granted' });
            }} />
          <div className="setting"><span><b>Réponse automatique</b><small>Toujours désactivée : vous décidez de chaque appel.</small></span><span className="pill">Désactivée</span></div>
          <div className="setting"><span><b>Indicatif ajouté automatiquement</b><small>Aucun : le numéro est composé tel que saisi.</small></span><span className="pill">Aucun</span></div>
          {demo && <button type="button" className="ghost" onClick={simulateIncoming}><PhoneIncoming size={16} /> Simuler un appel entrant</button>}
        </Section>

        <Section icon={<Database size={18} />} title="Données de cet appareil">
          <Toggle label="Conserver sur cet appareil" hint={`Contacts, notes et journal (${MAX_CALLS} appels ou ${MAX_AGE_DAYS} jours au plus). Sinon, tout disparaît à la déconnexion.`}
            checked={preferences.persist} onChange={async persist => { persistChoice.set(profile, persist); await store.setPersist(persist); notify(persist ? 'Vos données seront conservées sur cet appareil.' : 'Conservation désactivée et copie locale effacée.'); }} />
          <p className="muted">{contacts.length} contact{contacts.length > 1 ? 's' : ''} · {calls.length} appel{calls.length > 1 ? 's' : ''}. Le mot de passe n’est jamais enregistré.</p>
          <button type="button" className="ghost danger" onClick={async () => {
            if (!window.confirm('Effacer les contacts, notes et le journal de cet appareil ? Le journal central du serveur n’est pas concerné.')) return;
            await store.eraseDevice();
            notify('Données de cet appareil effacées.');
          }}>Effacer les données de cet appareil</button>
        </Section>

        <Section icon={<Info size={18} />} title="Compte">
          <dl className="about"><div><dt>Identifiant</dt><dd>{account?.username}</dd></div><div><dt>Mode</dt><dd>{demo ? 'Démonstration' : 'Ligne réelle'}</dd></div>
            <div><dt>Version</dt><dd>ApisnixPhone Web 0.1.0</dd></div></dl>
          <button type="button" className="ghost danger" onClick={() => {
            const call = phone.getSnapshot().call;
            if (call && call.phase !== 'ended' && !window.confirm('Un appel est en cours. Se déconnecter y mettra fin.')) return;
            void logout();
          }}><LogOut size={16} /> Se déconnecter</button>
        </Section>
      </div>
    </div>
  );
}
