import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { useApp, usePhone } from '../../app/AppContext';
import { useI18n } from '../../i18n';

export function CallScriptCard() {
  const { callScript } = useApp();
  const { demo } = usePhone();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);
  const script = demo ? { title: t('script.demoTitle'), content: t('script.demoContent') } : callScript;
  if (!script) return null;
  return <section className="dock-card call-script-card" aria-label={t('script.title')}>
    <header><BookOpen size={19} aria-hidden="true" /><div><small>{t('script.title')}</small><b>{script.title}</b></div>
      <button type="button" className="ghost" aria-expanded={expanded} aria-label={t(expanded ? 'script.collapse' : 'script.expand')}
        onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button></header>
    <div className="call-script-text" hidden={!expanded}>{script.content}</div>
  </section>;
}
