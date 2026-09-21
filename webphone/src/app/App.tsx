import { AlarmClock, BookUser, History, LogOut, Moon, ShieldAlert, Phone, PhoneOff, Search, Settings as SettingsIcon, Star, Sun, WifiOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { CommandPalette } from '../components/CommandPalette';
import { Kbd } from '../components/Kbd';
import { Toasts } from '../components/Toasts';
import { Avatar } from '../components/Avatar';
import { Login } from '../features/auth/Login';
import { ConnectionPill, PhoneDock } from '../features/calls/PhoneDock';
import { Callbacks } from '../features/callbacks/Callbacks';
import { Contacts } from '../features/contacts/Contacts';
import { Journal } from '../features/history/Journal';
import { Settings } from '../features/settings/Settings';
import { useApp, useData, usePhone, type View } from './AppContext';
import { useNow } from './clock';
import { applyTheme, storedTheme } from './theme';

// On a narrow screen the phone sits in the middle of this list, as the main action.
const NAV: Array<[View, string, typeof History]> = [
  ['journal', 'Journal', History], ['contacts', 'Contacts', BookUser], ['phone', 'Téléphone', Phone],
  ['callbacks', 'Rappels', AlarmClock], ['favorites', 'Favoris', Star], ['settings', 'Réglages', SettingsIcon],
];

function useShortcuts() {
  const { phone, setPaletteOpen, paletteOpen } = useApp();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        return setPaletteOpen(!paletteOpen);
      }
      const target = event.target as HTMLElement | null;
      // Single-letter shortcuts never fire while typing, and Escape never hangs up by surprise.
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, dialog, [contenteditable]')) return;
      const call = phone.getSnapshot().call;
      if (!call || (call.phase !== 'active' && call.phase !== 'held')) return;
      if (event.key.toLowerCase() === 'm') phone.setMuted(!call.muted);
      if (event.key.toLowerCase() === 'h') phone.setHeld(call.phase !== 'held');
      if (call.phase === 'active' && /^[\d*#]$/.test(event.key)) phone.sendDtmf(event.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone, paletteOpen, setPaletteOpen]);
}

function Workspace() {
  const { view, setView, logout, setPaletteOpen, store, phone, notify } = useApp();
  const { account, call, demo, connection, lineTaken } = usePhone();
  const { preferences, calls, callbacks } = useData();
  useShortcuts();
  const now = useNow();

  useEffect(() => { document.documentElement.dataset.density = preferences.density; }, [preferences.density]);
  // Leaving with a live call would drop it: ask first.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { const current = phone.getSnapshot().call; if (current && current.phase !== 'ended') event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phone]);

  // A callback that comes due is announced once: in the page, and by the system when the person allowed it.
  const announced = useRef(new Set<string>());
  const dueCallbacks = callbacks.filter(callback => !callback.doneAt && callback.dueAt <= now);
  useEffect(() => {
    for (const callback of dueCallbacks) {
      if (announced.current.has(callback.id)) continue;
      announced.current.add(callback.id);
      // Already late when the page opened: the badge is enough, no burst of alerts.
      if (now - callback.dueAt > 90_000) continue;
      const label = callback.name ?? callback.number;
      notify(`C’est l’heure de rappeler ${label}.`);
      if (preferences.notifications && !demo && typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification('Rappel ApisnixPhone', { body: `Rappeler ${label}${callback.note ? ` — ${callback.note}` : ''}` });
    }
  }, [dueCallbacks, now, notify, preferences.notifications, demo]);

  // The badge counts missed calls not looked at yet; opening the journal is looking at them.
  const unseenMissed = calls.filter(item => item.outcome === 'missed' && item.startedAt > preferences.missedSeenAt).length;
  useEffect(() => {
    if (view === 'journal' && unseenMissed > 0) store.setPreferences({ missedSeenAt: Date.now() });
  }, [view, unseenMissed, store]);

  // Same for callbacks: the badge announces those that came due since « Rappels » was last opened.
  // The card under the keypad keeps showing them until they are really done.
  const unseenDue = dueCallbacks.filter(callback => callback.dueAt > preferences.callbacksSeenAt).length;
  useEffect(() => {
    if (view === 'callbacks' && unseenDue > 0) store.setPreferences({ callbacksSeenAt: Date.now() });
  }, [view, unseenDue, store]);

  // The tab title tells what is happening when the page is in the background.
  const ringingIn = call?.phase === 'ringing-in';
  useEffect(() => {
    document.title = ringingIn ? 'Appel entrant… · ApisnixPhone' : call && call.phase !== 'ended' ? 'En appel · ApisnixPhone'
      : unseenMissed ? `(${unseenMissed}) ApisnixPhone` : 'ApisnixPhone';
  }, [ringingIn, call, unseenMissed]);
  useEffect(() => {
    if (!ringingIn || demo || !preferences.notifications || !document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notification = new Notification('Appel entrant', { body: call?.remoteName ?? call?.dialTarget ?? '', tag: 'apisnixphone-incoming' });
    notification.onclick = () => window.focus();
    return () => notification.close();
  }, [ringingIn, demo, preferences.notifications, call?.remoteName, call?.dialTarget]);
  const dark = document.documentElement.dataset.theme === 'dark';
  const inCall = call && call.phase !== 'ended';
  const signOut = () => {
    if (inCall && !window.confirm('Un appel est en cours. Se déconnecter y mettra fin.')) return;
    void logout();
  };

  return (
    <div className={'shell' + (view === 'phone' ? ' show-phone' : '')}>
      {demo && <p className="demo-banner"><b>Démonstration</b> Données fictives · aucun appel réel, aucun microphone utilisé</p>}
      <nav className="sidebar" aria-label="Navigation principale">
        <a className="brand" href="/" onClick={event => { event.preventDefault(); setView('journal'); }}>
          <span className="brand-mark"><img src="/apisnix-mark.png" alt="" width={34} height={34} /></span>
          <span className="brand-name">APISNIX<small>ApisnixPhone</small></span></a>
        <p className="nav-caption">Espace d’appels</p>
        <ul>
          {NAV.map(([key, label, Icon]) => (
            <li key={key} className={'nav-' + key}><button type="button" className={'nav-item' + (view === key ? ' active' : '') + (key === 'phone' && inCall ? ' in-call' : '')}
              aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}>
              <Icon size={key === 'phone' ? 24 : 19} /><span>{label}</span>
              {key === 'journal' && unseenMissed > 0 && <i className="badge" aria-label={`${unseenMissed} appels manqués non consultés`}>{unseenMissed}</i>}
              {key === 'callbacks' && unseenDue > 0 && <i className="badge badge-yellow" aria-label={`${unseenDue} nouveaux rappels à faire`}>{unseenDue}</i>}</button></li>
          ))}
        </ul>
        <div className="sidebar-foot">
          <Avatar name={account?.username} size={34} />
          <span className="account" title={account?.domain}><b>{account?.username}</b><small>{demo ? 'Démonstration' : 'Ligne connectée'}</small></span>
          <button type="button" className="icon-button sign-out" aria-label="Se déconnecter" title="Se déconnecter" onClick={signOut}><LogOut size={17} /></button>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <button type="button" className="palette-trigger" onClick={() => setPaletteOpen(true)}>
            <Search size={17} aria-hidden="true" /><span>Un contact, un numéro, une action…</span><Kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</Kbd></button>
          <ConnectionPill />
          <button type="button" className="icon-button" aria-label={dark ? 'Thème clair' : 'Thème sombre'} onClick={() => {
            const theme = dark ? 'light' : 'dark'; store.setPreferences({ theme }); applyTheme(theme);
          }}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          {/* Always within reach, whatever the height of the window. */}
          <button type="button" className="icon-button sign-out" aria-label="Se déconnecter" title="Se déconnecter" onClick={signOut}><LogOut size={18} /></button>
        </header>
        {lineTaken && (
          <div className="line-alert" role="alert">
            <ShieldAlert size={22} aria-hidden="true" />
            <p><b>Cette ligne est ouverte sur un autre appareil.</b> Ce poste est en pause : il ne reçoit plus les appels et ne peut plus en passer. Un compte ne fonctionne que sur un appareil à la fois. Reprenez la ligne ici, et c’est l’autre appareil qui sera mis en pause.</p>
            <button type="button" onClick={() => phone.retakeLine()}>Reprendre la ligne ici</button>
          </div>
        )}
        {connection !== 'ready' && !lineTaken && (
          <p className="line-banner" role="status"><WifiOff size={16} /> {connection === 'reconnecting' ? 'Connexion perdue : reconnexion en cours… Les appels sont indisponibles.' : 'Ligne en cours d’enregistrement…'}</p>
        )}
        {/* Visible from every view on narrow screens: hanging up is never hidden behind navigation. */}
        {inCall && view !== 'phone' && (
          <div className="call-banner" role="status">
            <button type="button" onClick={() => setView('phone')}><Phone size={16} /> {ringingIn ? 'Appel entrant' : 'Appel en cours'} · {call.remoteName ?? call.dialTarget}</button>
            <button type="button" className="banner-hangup" aria-label="Raccrocher" onClick={() => phone.hangup()}><PhoneOff size={16} /></button>
          </div>
        )}
        <div className="content">
          {/* « Téléphone » is a view of its own only on a narrow screen; on a wide one the dock is always there. */}
          {(view === 'journal' || view === 'phone') && <Journal />}
          {view === 'contacts' && <Contacts />}
          {view === 'favorites' && <Contacts favoritesOnly />}
          {view === 'callbacks' && <Callbacks />}
          {view === 'settings' && <Settings />}
        </div>
      </div>
      {/* Mounted once, outside the views: the call survives every navigation. */}
      <PhoneDock />
      <CommandPalette />
    </div>
  );
}

export function App() {
  const { account } = usePhone();
  const { sessionOpen } = useApp();
  useEffect(() => {
    applyTheme(storedTheme());
    // « Système » keeps following the computer when it switches between day and night.
    const media = matchMedia('(prefers-color-scheme: dark)');
    const follow = () => { if (storedTheme() === 'system') applyTheme('system'); };
    media.addEventListener('change', follow);
    return () => media.removeEventListener('change', follow);
  }, []);
  // The workspace stays while the line reconnects; only a closed session returns to sign-in.
  return <>{sessionOpen && account ? <Workspace /> : <Login />}<Toasts /></>;
}
