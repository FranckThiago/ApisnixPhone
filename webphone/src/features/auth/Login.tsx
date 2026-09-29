import { ArrowRight, Eye, EyeOff, Headphones, Languages, ShieldCheck, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp, usePhone } from '../../app/AppContext';
import { LANGUAGES, setLanguage, useI18n } from '../../i18n';
import { primeAudio } from '../../telephony/audio';
import { offerToSave, savedCredentials } from './credentials';

/** Each language under its own name; the choice is remembered by this browser. */
export function LanguagePicker() {
  const { t, language } = useI18n();
  return (
    <div className="language-picker" role="group" aria-label={t('language.label')}>
      <Languages size={16} aria-hidden="true" />
      {LANGUAGES.map(({ id, name }) => (
        <button key={id} type="button" lang={id} aria-pressed={language === id} className={language === id ? 'active' : ''} onClick={() => setLanguage(id)}>{name}</button>
      ))}
    </div>
  );
}

export function Login() {
  const { login } = useApp();
  const { connection, error, demo } = usePhone();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const { t } = useI18n();
  const busy = connection === 'connecting' || connection === 'registering';

  // After a reload, an access the person saved in the browser signs back in by itself (real line only).
  const tried = useRef(false);
  useEffect(() => {
    if (demo || tried.current || connection !== 'offline') return;
    tried.current = true;
    void savedCredentials().then(saved => { if (saved) void login(saved); });
  }, [demo, connection, login]);

  const submit = async () => {
    if (busy) return;
    primeAudio();
    const credentials = { username, password };
    if (await login(credentials) && !demo) void offerToSave(credentials);
  };

  return (
    <main className="login">
      <section className="login-brand" aria-hidden="true">
        <div className="login-glow" />
        <img src="/apisnix-mark.png" alt="" width={120} height={120} />
        <h2>{t('login.brandLine1')}<br /><span className="swoosh">{t('login.brandLine2')}</span></h2>
        <ul>
          <li><Zap size={18} /> {t('login.point1')}</li>
          <li><Headphones size={18} /> {t('login.point2')}</li>
          <li><ShieldCheck size={18} /> {t('login.point3')}</li>
        </ul>
      </section>
      <section className="login-form">
        <form onSubmit={event => { event.preventDefault(); void submit(); }}>
          <LanguagePicker />
          <img src="/apisnix-mark.png" alt="APISNIX" width={56} height={56} className="login-mark" />
          <p className="eyebrow">ApisnixPhone</p>
          <h1>{t('login.title')}</h1>
          <p className="lead">{t('login.lead')}</p>
          {demo && <p className="callout">{t('login.demo')}</p>}
          <label>{t('login.username')}<input name="username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" maxLength={100} required autoFocus /></label>
          <label>{t('login.password')}
            <span className="password"><input name="password" type={visible ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" maxLength={256} required />
              <button type="button" className="icon-button" aria-label={t(visible ? 'login.hidePassword' : 'login.showPassword')} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {connection === 'other-tab-active' && <p className="fine">{t('login.otherTab')}</p>}
          <button type="submit" className="primary big" disabled={busy}>{busy ? t(connection === 'connecting' ? 'login.connecting' : 'login.registering') : <>{t('login.submit')} <ArrowRight size={18} /></>}</button>
          <p className="fine">{t('login.help')}</p>
        </form>
      </section>
    </main>
  );
}
