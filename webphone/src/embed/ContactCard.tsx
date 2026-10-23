import { useI18n } from '../i18n';
import { contactFields, type CustomerContact } from './contact';

export function ContactCard({ contact, expanded = false }: { contact: CustomerContact; expanded?: boolean }) {
  const { t } = useI18n();
  return <details className="embed-contact" open={expanded || undefined}>
    <summary>{t('contactContext.title')} <span>{[contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.company || contact.phone}</span></summary>
    <dl>{contactFields.map(field => <div key={field}><dt>{t(`contactContext.${field}`)}</dt><dd>{contact[field] || '—'}</dd></div>)}</dl>
    {contact.notes && <p className="embed-contact-notes">{contact.notes}</p>}
  </details>;
}
