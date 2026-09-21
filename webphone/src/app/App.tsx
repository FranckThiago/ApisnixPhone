import { BookUser, History, LogOut, Moon, Phone, PhoneOff, Search, Settings as SettingsIcon, Star, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { CommandPalette } from '../components/CommandPalette';
import { Kbd } from '../components/Kbd';
import { Toasts } from '../components/Toasts';
import { Avatar } from '../components/Avatar';
import { Login } from '../features/auth/Login';
import { ConnectionPill, PhoneDock } from '../features/calls/PhoneDock';
import { Contacts } from '../features/contacts/Contacts';
import { Journal } from '../features/history/Journal';
import { Settings } from '../features/settings/Settings';
import { dayKey } from '../domain/format';
import { useApp, useData, usePhone, type View } from './AppContext';
import { useNow } from './clock';
import { applyTheme, storedTheme } from './theme';

const NAV: Array<[View, string, typeof History]> = [
  ['journal', 'Journal', History], ['contacts', 'Contacts', BookUser], ['favorites', 'Favoris', Star], ['settings', 'Réglages', SettingsIcon],
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
  const { view, setView, logout, setPaletteOpen, store, phone } = useApp();
  const { account, call, demo } = usePhone();
  const { preferences, calls } = useData();
  useShortcuts();
  const now = useNow();

  useEffect(() => { document.documentElement.dataset.density = preferences.density; }, [preferences.density]);
  // Leaving with a live call would drop it: ask first.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { const current = phone.getSnapshot().call; if (current && current.phase !== 'ended') event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phone]);

  const missedToday = calls.filter(item => item.outcome === 'missed' && dayKey(item.startedAt) === dayKey(now)).length;
  const dark = document.documentElement.dataset.theme === 'dark';
  const inCall = call && call.phase !== 'ended';

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
            <li key={key}><button type="button" className={'nav-item' + (view === key ? ' active' : '')} aria-current={view === key ? 'page' : undefined} onClick={() => setView(key)}>
              <Icon size={19} /><span>{label}</span>{key === 'journal' && missedToday > 0 && <i className="badge" aria-label={`${missedToday} appels manqués aujourd’hui`}>{missedToday}</i>}</button></li>
          ))}
          <li className="nav-phone"><button type="button" className={'nav-item' + (view === 'phone' ? ' active' : '')} onClick={() => setView('phone')}><Phone size={19} /><span>Téléphone</span></button></li>
        </ul>
        <div className="sidebar-foot">
          <Avatar name={account?.username} size={34} />
          <span className="account"><b>{account?.username}</b><small>{demo ? 'Démonstration' : account?.domain}</small></span>
          <button type="button" className="icon-button on-dark" aria-label="Se déconnecter" title="Se déconnecter" onClick={() => {
            if (inCall && !window.confirm('Un appel est en cours. Se déconnecter y mettra fin.')) return;
            void logout();
          }}><LogOut size={17} /></button>
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
        </header>
        {/* Visible from every view on narrow screens: hanging up is never hidden behind navigation. */}
        {inCall && view !== 'phone' && (
          <div className="call-banner" role="status">
            <button type="button" onClick={() => setView('phone')}><Phone size={16} /> Appel en cours · {call.remoteName ?? call.dialTarget}</button>
            <button type="button" className="banner-hangup" aria-label="Raccrocher" onClick={() => phone.hangup()}><PhoneOff size={16} /></button>
          </div>
        )}
        <div className="content">
          {view === 'journal' && <Journal />}
          {view === 'contacts' && <Contacts />}
          {view === 'favorites' && <Contacts favoritesOnly />}
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
  const { connection, account } = usePhone();
  useEffect(() => applyTheme(storedTheme()), []);
  return <>{connection === 'ready' && account ? <Workspace /> : <Login />}<Toasts /></>;
}
