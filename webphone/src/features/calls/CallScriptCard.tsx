import { BookOpen, ChevronDown, ChevronUp, Maximize2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp, usePhone } from '../../app/AppContext';
import { useI18n } from '../../i18n';
import { isMobileLayout, onLayoutChange } from '../../app/layout';


/** The area left of the dock, where a wide screen shows the script in large. Absent in the embed. */
function useStage(): HTMLElement | null {
  const [stage, setStage] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // In the phone layout the dock is a view of its own: the script stays in it.
    const pick = () => setStage(isMobileLayout() ? null : document.querySelector<HTMLElement>('.main-stage'));
    pick();
    return onLayoutChange(pick);
  }, []);
  return stage;
}

export function CallScriptCard() {
  const { callScript } = useApp();
  const { demo } = usePhone();
  const { t } = useI18n();
  // On a wide screen the script starts reduced in the dock and opens on « Afficher » (Franck, 18 Nov 2026);
  // on a narrow one it stays open under the call. The card is keyed by call, so each call starts afresh.
  const [expanded, setExpanded] = useState(isMobileLayout);
  const stage = useStage();
  const script = demo ? { title: t('script.demoTitle'), content: t('script.demoContent') } : callScript;
  if (!script) return null;

  if (stage) {
    // Wide screen: large panel over the journal; closed, it waits in the dock as a small card.
    return <>
      {expanded && createPortal(
        <div className="call-script-backdrop"><section className="call-script-stage" role="region" aria-label={t('script.title')}>
          <header><BookOpen size={22} aria-hidden="true" /><div><small>{t('script.title')}</small><b>{script.title}</b></div>
            <button type="button" className="ghost" title={t('script.closeHint')} onClick={() => setExpanded(false)}>
              <X size={18} aria-hidden="true" /> {t('script.close')}</button></header>
          <div className="call-script-text">{script.content}</div>
        </section></div>, stage)}
      {!expanded && <section className="dock-card call-script-card reduced" aria-label={t('script.title')}>
        <header><BookOpen size={19} aria-hidden="true" /><div><small>{t('script.title')}</small><b>{script.title}</b></div>
          <button type="button" className="ghost" title={t('script.expand')}
            onClick={() => setExpanded(true)}><Maximize2 size={16} aria-hidden="true" /> {t('script.open')}</button></header>
      </section>}
    </>;
  }

  return <section className="dock-card call-script-card" aria-label={t('script.title')}>
    <header><BookOpen size={19} aria-hidden="true" /><div><small>{t('script.title')}</small><b>{script.title}</b></div>
      <button type="button" className="ghost" aria-expanded={expanded} aria-label={t(expanded ? 'script.collapse' : 'script.expand')}
        onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button></header>
    <div className="call-script-text" hidden={!expanded}>{script.content}</div>
  </section>;
}
