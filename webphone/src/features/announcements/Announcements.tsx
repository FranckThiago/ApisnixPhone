import { X } from 'lucide-react';
import { Fragment } from 'react';
import type { Announcement, AnnouncementType } from '../../announcements/client';
import { useI18n, type MessageKey } from '../../i18n';

// One icon per kind, the same as in the administration, the agent screen and the supervision.
const ICONS: Record<AnnouncementType, string> = { info: 'ℹ️', astuce: '💡', facture: '🧾', maj: '🚀', alerte: '⚠️' };
const KIND: Record<AnnouncementType, MessageKey> = { info: 'annonces.info', astuce: 'annonces.astuce', facture: 'annonces.facture', maj: 'annonces.maj', alerte: 'annonces.alerte' };

/** Cards at the top of the main screen. Text is rendered as text only; an alert has no « Masquer ». */
export function AnnouncementList({ items, onHide }: { items: Announcement[]; onHide(item: Announcement): void }) {
  const { t } = useI18n();
  if (!items.length) return null;
  return (
    <section className="annonces" aria-label={t('annonces.title')}>
      <h2 className="eyebrow">{t('annonces.title')}</h2>
      {items.map(item => (
        <article key={item.id} className={'annonce annonce-' + item.type}>
          <span className="annonce-ico" role="img" aria-label={t(KIND[item.type])}>{ICONS[item.type]}</span>
          <div className="annonce-body">
            {item.title && <strong>{item.title}</strong>}
            {item.text && <p>{item.text.split('\n').map((line, index) => <Fragment key={index}>{index > 0 && <br />}{line}</Fragment>)}</p>}
            {item.link && <a className="annonce-link" href={item.link} target="_blank" rel="noopener noreferrer">{item.linkLabel || t('annonces.more')}</a>}
          </div>
          {item.type !== 'alerte' && (
            <button type="button" className="icon-button annonce-close" aria-label={t('annonces.hide')} title={t('annonces.hide')} onClick={() => onHide(item)}><X size={16} /></button>
          )}
        </article>
      ))}
    </section>
  );
}
