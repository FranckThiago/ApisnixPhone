import { Check, Copy, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { applyTheme, storedTheme } from '../../app/theme';
import { useI18n } from '../../i18n';
import { buildSignInLink } from './credentials';
import { LanguagePicker } from './Login';

const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Page `/lien`, for the administrator: builds a customer's sign-in link in this browser.
 * Nothing is sent or kept, and the phone itself is never loaded here.
 */
export function LinkGenerator() {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const output = useRef<HTMLInputElement>(null);
  const link = username.trim() && password ? buildSignInLink(location.origin, { username, password }) : '';

  useEffect(() => applyTheme(storedTheme()), []);
  useEffect(() => {
    if (copied !== 'yes') return;
    const timer = setTimeout(() => setCopied('no'), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('yes');
    } catch {
      // Clipboard access refused (embedded browser, old page): the selected field copies the old way.
      output.current?.select();
      setCopied(document.execCommand('copy') ? 'yes' : 'failed');
    }
  };

  const share = () => { void navigator.share({ title: 'ApisnixPhone', text: t('linkgen.shareText'), url: link }).catch(() => undefined); };

  // Typed, not saved: the browser must not take the customer's password for the administrator's own.
  const field = { type: 'text', autoComplete: 'off', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false } as const;

  return (
    <main className="login">
      <section className="login-brand" aria-hidden="true">
        <div className="login-glow" />
        <img src="/apisnix-mark.png" alt="" width={120} height={120} />
        <h2>{t('login.brandLine1')}<br /><span className="swoosh">{t('login.brandLine2')}</span></h2>
      </section>
      <section className="login-form">
        <form onSubmit={event => { event.preventDefault(); if (link) void copy(); }}>
          <LanguagePicker />
          <img src="/apisnix-mark.png" alt="APISNIX" width={56} height={56} className="login-mark" />
          <p className="eyebrow">ApisnixPhone</p>
          <h1>{t('linkgen.title')}</h1>
          <p className="lead">{t('linkgen.lead')}</p>
          <label>{t('login.username')}<input {...field} name="line-username" value={username} onChange={event => { setUsername(event.target.value); setCopied('no'); }} maxLength={100} autoFocus /></label>
          <label>{t('login.password')}<input {...field} name="line-secret" value={password} onChange={event => { setPassword(event.target.value); setCopied('no'); }} maxLength={256} /></label>
          <label>{t('linkgen.link')}
            <input ref={output} readOnly className="link-output" value={link} placeholder={t('linkgen.placeholder')} onFocus={event => event.currentTarget.select()} />
          </label>
          {copied === 'failed' && <p className="form-error" role="alert">{t('linkgen.copyFailed')}</p>}
          <div className="link-actions">
            <button type="submit" className="primary" disabled={!link}>{copied === 'yes' ? <><Check size={17} /> {t('linkgen.copied')}</> : <><Copy size={17} /> {t('linkgen.copy')}</>}</button>
            {canShare && <button type="button" className="ghost" disabled={!link} onClick={share}><Share2 size={16} /> {t('linkgen.share')}</button>}
          </div>
          <p className="callout">{t('linkgen.warning')}</p>
          <p className="fine">{t('linkgen.note')}</p>
        </form>
      </section>
    </main>
  );
}
