import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronRight, CircleHelp, Clock3, ContactRound, LayoutDashboard, LogOut, Phone, Search, ShieldCheck, Users, X } from 'lucide-react';
import { LanguagePicker } from '../features/auth/Login';
import { useI18n, type MessageKey } from '../i18n';
import { createApisnixPhone, type PhoneEvent, type PublicState } from './client';
import { sameNumber } from '../domain/numbers';

const contacts = [
  { name: 'Camille Martin', company: 'Atelier Lumen', number: '+33100000001', initials: 'CM', color: 'mint' },
  { name: 'Alex Laurent', company: 'Nordia Conseil', number: '+3220000001', initials: 'AL', color: 'lilac' },
  { name: 'Sarah Moreau', company: 'Studio Océane', number: '+33100000002', initials: 'SM', color: 'peach' },
];
const phaseLabels: Record<string, MessageKey> = {
  dialing: 'integration.dialing', 'ringing-out': 'integration.ringingOut', 'ringing-in': 'integration.ringingIn',
  active: 'integration.active', held: 'integration.held', ending: 'integration.ending', ended: 'integration.ended',
};
type Activity = { key: string; label: MessageKey; detail: string; time: number };
export function IntegrationDemo() {
  const { t, language } = useI18n();
  const container = useRef<HTMLDivElement>(null);
  const client = useRef<ReturnType<typeof createApisnixPhone> | null>(null);
  const [phone, setPhone] = useState('1001');
  const [selected, setSelected] = useState(0);
  const [state, setState] = useState<PublicState | null>(null);
  const [ready, setReady] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [feedback, setFeedback] = useState<MessageKey>('integration.instructions');
  const [search, setSearch] = useState('');
  const contact = contacts[selected]!;
  useEffect(() => {
    if (!container.current) return;
    let alive = true;
    let previousConnection = '';
    const onEvent = (event: PhoneEvent) => {
      if (!alive) return;
      if (event.type === 'ready') setReady(true);
      if (event.type === 'state') {
        setState(event.state);
        const connection = event.state.sessionOpen && event.state.connection === 'ready' ? 'ready' : 'offline';
        if (connection !== previousConnection) {
          if (previousConnection || connection === 'ready') setActivities(items => [{ key: crypto.randomUUID(), label: connection === 'ready' ? 'integration.connected' as const : 'integration.disconnected' as const, detail: event.state.phone ?? phone, time: Date.now() }, ...items].slice(0, 8));
          previousConnection = connection;
        }
      }
      if (event.type === 'call') {
        const match = contacts.findIndex(item => sameNumber(item.number, event.call.number));
        if (match >= 0) setSelected(match);
        setActivities(items => [{ key: crypto.randomUUID(), label: phaseLabels[event.call.phase] ?? 'integration.updated', detail: event.call.number, time: Date.now() }, ...items].slice(0, 8));
        if (event.call.phase === 'ringing-in') setHidden(false);
      }
    };
    client.current = createApisnixPhone({ container: container.current, url: location.origin, phone, onEvent,
      onError: () => { if (alive) { setReady(false); setFeedback('integration.unavailable'); } } });
    return () => { alive = false; client.current?.destroy(); client.current = null; };
  }, [phone]);
  const prepare = async () => {
    setHidden(false);
    if (matchMedia('(max-width: 800px)').matches) requestAnimationFrame(() => container.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    try {
      const code = await client.current?.prepareCall(contact.number);
      setFeedback(code === 'prepared' ? 'integration.prepared' : code === 'call-in-progress' ? 'integration.busy' : 'integration.loginFirst');
    } catch { setFeedback('integration.unavailable'); }
  };
  const connected = state?.sessionOpen && state.connection === 'ready';
  return <div className="crm-demo">
    <aside className="crm-sidebar">
      <a href="/integration-demo" className="crm-brand"><span>A</span> atelier<span className="crm-brand-dot">.</span></a>
      <small>{t('integration.workspace')}</small>
      <div className="crm-nav-muted"><LayoutDashboard size={18} />{t('integration.overview')}</div>
      <div className="crm-nav-active"><Users size={18} />{t('integration.contacts')}<b>3</b></div>
      <div className="crm-sidebar-foot"><ShieldCheck size={22} /><strong>{t('integration.demoTitle')}</strong><p>{t('integration.demoText')}</p></div>
      <div className="crm-profile"><span>{phone === '1001' ? 'AL' : 'TM'}</span><div><b>{phone === '1001' ? 'Alice Laurent' : 'Thomas Martin'}</b><small>{t('integration.team')}</small></div></div>
    </aside>
    <main className="crm-main">
      <header className="crm-top"><span>{t('integration.workspace')}<ChevronRight size={14} /><b>{t('integration.contacts')}</b></span><LanguagePicker /></header>
      <div className="crm-page">
        <div className="crm-intro"><div><p className="crm-kicker">APISNIXPHONE × ATELIER CRM</p><h1>{t('integration.title')}</h1><p>{t('integration.subtitle')}</p></div><span className="crm-demo-label">{t('integration.demoTitle')}</span></div>
        <section className="crm-connect-card"><div className="crm-connect-icon"><Phone size={24} /></div><div><strong>{t('integration.accessTitle')}</strong><p>{t('integration.accessHelp')}</p></div>
          <label>{t('integration.agent')}<select value={phone} disabled={!!state?.sessionOpen || state?.connection === 'connecting' || state?.connection === 'registering'} onChange={event => { setPhone(event.target.value); setState(null); setReady(false); setFeedback('integration.instructions'); }}>
            <option value="1001">Alice · 1001</option><option value="1002">Thomas · 1002</option></select></label>
          <span className={'crm-status ' + (connected ? 'online' : '')}><i />{t(connected ? 'integration.connected' : 'integration.toConnect')}</span>
        </section>
        <div className="crm-section-title"><h2>{t('integration.contacts')}</h2><label className="crm-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('integration.search')} aria-label={t('integration.search')} /></label></div>
        <section className="crm-contacts" aria-label={t('integration.contacts')}>
          {contacts.map((item, index) => (!search || `${item.name} ${item.company} ${item.number}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <button key={item.number} className={'crm-contact ' + (selected === index ? 'selected' : '')} onClick={() => setSelected(index)} aria-pressed={selected === index}>
            <span className={'crm-avatar ' + item.color}>{item.initials}</span><span><b>{item.name}</b><small>{item.company}</small></span><span className="crm-number">{item.number}</span><ArrowUpRight size={18} />
          </button>)}
          {search && !contacts.some(item => `${item.name} ${item.company} ${item.number}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) && <p className="crm-empty">{t('integration.noResults')}</p>}
        </section>
        <section className="crm-detail"><div className="crm-detail-title"><span className={'crm-avatar large ' + contact.color}>{contact.initials}</span><div><p className="crm-kicker">{t('integration.contactCard')}</p><h2>{contact.name}</h2><p>{contact.company}</p></div><span className="crm-prospect">{t('integration.prospect')}</span></div>
          <div className="crm-detail-content"><div><span>{t('integration.phone')}</span><strong>{contact.number}</strong><p>{t('integration.note')}</p></div><button className="crm-primary" disabled={!ready || !!state?.inCall} onClick={() => void prepare()}><Phone size={17} />{t('integration.prepare')}</button></div>
          <p className="crm-feedback" role="status"><CircleHelp size={16} />{t(feedback)}</p>
        </section>
        <section className="crm-activity"><div className="crm-section-title"><h2>{t('integration.activity')}</h2><span><i />{t('integration.live')}</span></div>
          {activities.length ? <ol>{activities.map(item => <li key={item.key}><span className="crm-activity-icon"><Check size={14} /></span><div><b>{t(item.label)}</b><span>{item.detail}</span></div><time>{new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(item.time)}</time></li>)}</ol> : <div className="crm-empty"><Clock3 size={22} /><p>{t('integration.emptyActivity')}</p></div>}
        </section>
        <p className="crm-footnote"><ShieldCheck size={15} />{t('integration.private')}</p>
      </div>
    </main>
    <aside className={'crm-phone-panel' + (hidden ? ' minimized' : '')} aria-label={t('integration.phonePanel')}>
      <div className="crm-panel-heading"><div><span className="crm-kicker">APISNIXPHONE</span><h2>{t('integration.phonePanel')}</h2></div><button aria-label={t('integration.minimize')} onClick={() => setHidden(true)}><X size={20} /></button></div>
      <div className="crm-frame" ref={container} />
      <p className="crm-panel-help"><LogOut size={14} />{t('integration.switchHelp')}</p>
    </aside>
    {hidden && <button className="crm-reopen" onClick={() => setHidden(false)}><Phone size={19} />{t('integration.openPhone')}{state?.inCall && <i />}</button>}
    <div className="crm-mobile-label"><ContactRound size={14} />{t('integration.demoText')}</div>
  </div>;
}
