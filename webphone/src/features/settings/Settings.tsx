import { BellRing, Database, Headphones, Info, LogOut, Palette, PhoneIncoming } from 'lucide-react';
import type { ReactNode } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { applyTheme } from '../../app/theme';
import type { Theme } from '../../domain/types';
import { LANGUAGES, setLanguage, useI18n, type MessageKey } from '../../i18n';
import { MAX_AGE_DAYS, MAX_CALLS } from '../../storage/DataStore';
import { persistChoice } from '../../storage/persistence';
import { AudioSettings } from './AudioSettings';
import { RingtonePicker } from './RingtonePicker';

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
  const { t, tp, language } = useI18n();
  const profile = account ? `${account.domain}:${account.username}` : '';
  const set = store.setPreferences.bind(store);

  return (
    <div className="page">
      <header className="page-head"><div><p className="eyebrow">{t('settings.eyebrow')}</p><h1><span className="swoosh">{t('settings.title')}</span></h1>
        <p className="lead">{t('settings.lead')}</p></div></header>
      <div className="settings-grid">
        <Section icon={<Headphones size={18} />} title={t('settings.audio')}>
          <AudioSettings />
          <Toggle label={t('settings.ringtone')} hint={t('settings.ringtoneHint')} checked={preferences.ringtone} onChange={ringtone => set({ ringtone })} />
          <RingtonePicker />
          <Toggle label={t('settings.lineSounds')} hint={t('settings.lineSoundsHint')} checked={preferences.lineSounds} onChange={lineSounds => set({ lineSounds })} />
          <Toggle label={t('settings.keypadTones')} hint={t('settings.keypadTonesHint')} checked={preferences.keypadTones} onChange={keypadTones => set({ keypadTones })} />
          <Toggle label={t('settings.echo')} checked={preferences.echoCancellation} onChange={echoCancellation => set({ echoCancellation })} />
          <Toggle label={t('settings.noise')} hint={t('settings.noiseHint')} checked={preferences.noiseSuppression} onChange={noiseSuppression => set({ noiseSuppression })} />
        </Section>

        <Section icon={<Palette size={18} />} title={t('settings.appearance')}>
          <div className="setting"><span><b>{t('language.label')}</b><small>{t('settings.languageHint')}</small></span>
            <div className="segmented" role="group" aria-label={t('language.label')}>
              {LANGUAGES.map(({ id, name }) => (
                <button key={id} type="button" lang={id} aria-pressed={language === id} className={language === id ? 'active' : ''}
                  onClick={() => setLanguage(id)}>{name}</button>))}
            </div></div>
          <div className="setting"><span><b>{t('settings.theme')}</b></span>
            <div className="segmented" role="group" aria-label={t('settings.theme')}>
              {([['light', 'theme.light'], ['dark', 'theme.dark'], ['system', 'theme.system']] as Array<[Theme, MessageKey]>).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={preferences.theme === value} className={preferences.theme === value ? 'active' : ''}
                  onClick={() => { set({ theme: value }); applyTheme(value); }}>{t(label)}</button>))}
            </div></div>
          <div className="setting"><span><b>{t('settings.density')}</b></span>
            <div className="segmented" role="group" aria-label={t('settings.density')}>
              {([['comfortable', 'density.comfortable'], ['compact', 'density.compact']] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={preferences.density === value} className={preferences.density === value ? 'active' : ''}
                  onClick={() => set({ density: value })}>{t(label)}</button>))}
            </div></div>
        </Section>

        <Section icon={<BellRing size={18} />} title={t('settings.calls')}>
          <Toggle label={t('settings.notifications')} hint={t('settings.notificationsHint')}
            checked={preferences.notifications} onChange={async wanted => {
              if (!wanted) return set({ notifications: false });
              // The demo never asks the browser for a permission.
              if (demo) { set({ notifications: true }); return notify(t('settings.demoNoPermission')); }
              if (typeof Notification === 'undefined') return notify(t('settings.notificationsUnavailable'), 'danger');
              set({ notifications: (await Notification.requestPermission()) === 'granted' });
            }} />
          <div className="setting"><span><b>{t('settings.autoAnswer')}</b><small>{t('settings.autoAnswerHint')}</small></span><span className="pill">{t('settings.off')}</span></div>
          <div className="setting"><span><b>{t('settings.autoPrefix')}</b><small>{t('settings.autoPrefixHint')}</small></span><span className="pill">{t('settings.none')}</span></div>
          {demo && <button type="button" className="ghost" onClick={simulateIncoming}><PhoneIncoming size={16} /> {t('settings.simulate')}</button>}
        </Section>

        <Section icon={<Database size={18} />} title={t('settings.data')}>
          <Toggle label={t('settings.persist')} hint={t('settings.persistHint', { calls: MAX_CALLS, days: MAX_AGE_DAYS })}
            checked={preferences.persist} onChange={async persist => { persistChoice.set(profile, persist); await store.setPersist(persist); notify(t(persist ? 'settings.persistOn' : 'settings.persistOff')); }} />
          <p className="muted">{tp('settings.contacts', contacts.length)} · {tp('settings.callCount', calls.length)}. {t('settings.noPassword')}</p>
          <button type="button" className="ghost danger" onClick={async () => {
            if (!window.confirm(t('settings.eraseConfirm'))) return;
            await store.eraseDevice();
            notify(t('settings.erased'));
          }}>{t('settings.erase')}</button>
        </Section>

        <Section icon={<Info size={18} />} title={t('settings.account')}>
          <dl className="about"><div><dt>{t('settings.username')}</dt><dd>{account?.username}</dd></div><div><dt>{t('settings.mode')}</dt><dd>{t(demo ? 'settings.modeDemo' : 'settings.modeLive')}</dd></div>
            <div><dt>{t('settings.version')}</dt><dd>ApisnixPhone Web 0.1.0</dd></div></dl>
          <button type="button" className="ghost danger" onClick={() => {
            const call = phone.getSnapshot().call;
            if (call && call.phase !== 'ended' && !window.confirm(t('confirm.signOutInCall'))) return;
            void logout();
          }}><LogOut size={16} /> {t('action.signOut')}</button>
        </Section>
      </div>
    </div>
  );
}
