import { ErrorBoundary } from '../components/ErrorBoundary';
import { AlarmClock, AudioLines, BookUser, History, LogOut, Moon, ShieldAlert, Phone, PhoneOff, Search, Settings as SettingsIcon, Sun, WifiOff } from 'lucide-react';
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
import { Recordings } from '../features/recordings/Recordings';
import { Settings } from '../features/settings/Settings';
import { useI18n, type MessageKey } from '../i18n';
import { bindWorkspaceLineSounds } from '../telephony/lineSounds';
import { keypadTone } from '../telephony/audio';
import { useApp, useData, usePhone, type View } from './AppContext';
import { useNow } from './clock';
import { applyTheme, storedTheme } from './theme';

// On a narrow screen the phone sits in the middle of this list, as the main action.
const NAV: Array<[View, MessageKey, typeof History]> = [
  ['journal', 'nav.journal', History], ['contacts', 'nav.contacts', BookUser], ['phone', 'nav.phone', Phone],
  ['audio', 'nav.audio', AudioLines], ['settings', 'nav.settings', SettingsIcon],
];

function useShortcuts() {
  const { phone, store, setPaletteOpen, paletteOpen } = useApp();
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
      if (call.phase === 'active' && /^[\d*#]$/.test(event.key)) {
        // Same tone as the on-screen keypad, heard only here.
        const { keypadTones, volume } = store.getSnapshot().preferences;
        if (keypadTones && !event.repeat) keypadTone(event.key, volume / 100);
        phone.sendDtmf(event.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phone, store, paletteOpen, setPaletteOpen]);
}

function Workspace() {
  const { view, setView, logout, setPaletteOpen, store, phone, notify } = useApp();
  const { account, call, demo, connection, lineTaken } = usePhone();
  const { preferences, calls, callbacks } = useData();
  const { t, language } = useI18n();
  useShortcuts();
  useEffect(() => bindWorkspaceLineSounds(phone, store), [phone, store]);
  const now = useNow();

  useEffect(() => { document.documentElement.dataset.density = preferences.density; }, [preferences.density]);
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
      notify(t('callbacks.dueToast', { name: label }));
      if (preferences.notifications && !demo && typeof Notification !== 'undefined' && Notification.permission === 'granted')
        new Notification(t('callbacks.notificationTitle'), { body: t('callbacks.notificationBody', { name: label }) + (callback.note ? ` — ${callback.note}` : '') });
    }
  }, [dueCallbacks, now, notify, preferences.notifications, demo, t]);

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
    document.title = ringingIn ? t('title.incoming') : call && call.phase !== 'ended' ? t('title.inCall')
      : unseenMissed ? `(${unseenMissed}) ApisnixPhone` : 'ApisnixPhone';
  }, [ringingIn, call, unseenMissed, t, language]);
  useEffect(() => {
    if (!ringingIn || demo || !preferences.notifications || !document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const notification = new Notification(t('banner.incoming'), { body: call?.remoteName ?? call?.dialTarget ?? '', tag: 'apisnixphone-incoming' });
    notification.onclick = () => window.focus();
    return () => notification.close();
  }, [ringingIn, demo, preferences.notifications, call?.remoteName, call?.dialTarget, t]);
  const dark = document.documentElement.dataset.theme === 'dark';
  const inCall = call && call.phase !== 'ended';
  const signOut = () => {
    if (inCall && !window.confirm(t('confirm.signOutInCall'))) return;
    void logout();
  };

  return (
    <div className={'shell' + (view === 'phone' ? ' show-phone' : '')}>
      {demo && <p className="demo-banner"><b>{t('demo.bannerTitle')}</b> {t('demo.bannerText')}</p>}
      <nav className="sidebar" aria-label={t('nav.label')}>
        <a className="brand" href="/" onClick={event => { event.preventDefault(); setView('journal'); }}>
          <span className="brand-mark"><img src="/apisnix-mark.png" alt="" width={34} height={34} /></span>
          <span className="brand-name">APISNIX<small>ApisnixPhone</small></span></a>
        <p className="nav-caption">{t('nav.caption')}</p>
        <ul>
          {NAV.map(([key, label, Icon]) => (
            <li key={key} className={'nav-' + key}><button type="button" className={'nav-item' + (view === key || key === 'journal' && view === 'callbacks' ? ' active' : '') + (key === 'phone' && inCall ? ' in-call' : '')}
              aria-current={view === key || key === 'journal' && view === 'callbacks' ? 'page' : undefined} onClick={() => setView(key)}>
              <Icon size={key === 'phone' ? 24 : 19} /><span>{t(label)}</span>
              {key === 'journal' && unseenMissed + unseenDue > 0 && <i className={'badge' + (unseenDue ? ' badge-yellow' : '')}
                aria-label={t('nav.badge', { missed: unseenMissed, due: unseenDue })}>{unseenMissed + unseenDue}</i>}</button></li>
          ))}
        </ul>
        <div className="sidebar-foot">
          <Avatar name={account?.username} size={34} />
          <span className="account" title={account?.domain}><b>{account?.username}</b><small>{t(demo ? 'account.demo' : 'account.connected')}</small></span>
          <button type="button" className="icon-button sign-out" aria-label={t('action.signOut')} title={t('action.signOut')} onClick={signOut}><LogOut size={17} /></button>
        </div>
      </nav>

      <div className="main">
        <header className="topbar">
          <button type="button" className="palette-trigger" onClick={() => setPaletteOpen(true)}>
            <Search size={17} aria-hidden="true" /><span>{t('topbar.search')}</span><Kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</Kbd></button>
          <ConnectionPill />
          <button type="button" className="icon-button" aria-label={t(dark ? 'theme.toLight' : 'theme.toDark')} onClick={() => {
            const theme = dark ? 'light' : 'dark'; store.setPreferences({ theme }); applyTheme(theme);
          }}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          {/* Always within reach, whatever the height of the window. */}
          <button type="button" className="icon-button sign-out" aria-label={t('action.signOut')} title={t('action.signOut')} onClick={signOut}><LogOut size={18} /></button>
        </header>
        {lineTaken && (
          <div className="line-alert" role="status">
            <ShieldAlert size={17} aria-hidden="true" />
            <p><b>{t('line.takenTitle')}</b> {t('line.takenText')}</p>
            <button type="button" onClick={() => phone.retakeLine()}>{t('line.retake')}</button>
          </div>
        )}
        {connection !== 'ready' && !lineTaken && (
          <p className="line-banner" role="status"><WifiOff size={16} /> {t(connection === 'reconnecting' ? 'line.reconnecting' : 'line.registering')}</p>
        )}
        {/* Visible from every view on narrow screens: hanging up is never hidden behind navigation. */}
        {inCall && view !== 'phone' && (
          <div className="call-banner" role="status">
            <button type="button" onClick={() => setView('phone')}><Phone size={16} /> {t(ringingIn ? 'banner.incoming' : 'banner.active')} · {call.remoteName ?? call.dialTarget}</button>
            <button type="button" className="banner-hangup" aria-label={t('call.hangUp')} onClick={() => phone.hangup()}><PhoneOff size={16} /></button>
          </div>
        )}
        <div className="content">
          {/* « Téléphone » is a view of its own only on a narrow screen; on a wide one the dock is always there. */}
          {(view === 'journal' || view === 'callbacks') && <nav className="journal-sections tabs" aria-label={t('journal.sections')}>
            <button type="button" className={view === 'journal' ? 'active' : ''} aria-current={view === 'journal' ? 'page' : undefined} onClick={() => setView('journal')}><History size={16} /> {t('journal.tabCalls')}</button>
            <button type="button" className={view === 'callbacks' ? 'active' : ''} aria-current={view === 'callbacks' ? 'page' : undefined} onClick={() => setView('callbacks')}><AlarmClock size={16} /> {t('journal.tabCallbacks')}{unseenDue > 0 && <i className="badge badge-yellow" aria-label={t('callbacks.newDue', { count: unseenDue })}>{unseenDue}</i>}</button>
          </nav>}
          <ErrorBoundary key={view}>
            {(view === 'journal' || view === 'phone') && <Journal />}
            {view === 'contacts' && <Contacts />}
            {view === 'audio' && <Recordings />}
            {view === 'callbacks' && <Callbacks />}
            {view === 'settings' && <Settings />}
          </ErrorBoundary>
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
  // A new language re-renders the whole tree, including the parts that format outside React.
  useI18n();
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
