import { AudioLines, Voicemail as VoicemailIcon } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useI18n } from '../../i18n';
import { Recordings } from './Recordings';
import { Voicemail } from './Voicemail';

/** The Audio entry of the menu: call recordings and the phone's voicemail, as two tabs. */
export function AudioView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<'recordings' | 'voicemail'>('recordings');
  const [unread, setUnread] = useState(0);
  const onCount = useCallback((count: number) => setUnread(count), []);
  const tabs = (
    <div className="tabs audio-tabs" role="tablist" aria-label={t('nav.audio')}>
      <button type="button" role="tab" aria-selected={tab === 'recordings'} className={tab === 'recordings' ? 'active' : ''} onClick={() => setTab('recordings')}>
        <AudioLines size={15} aria-hidden="true" /> {t('voicemail.tabRecordings')}</button>
      <button type="button" role="tab" aria-selected={tab === 'voicemail'} className={tab === 'voicemail' ? 'active' : ''} onClick={() => setTab('voicemail')}>
        <VoicemailIcon size={15} aria-hidden="true" /> {t('voicemail.tab')}{unread > 0 && <i className="badge badge-yellow">{unread}</i>}</button>
    </div>
  );
  return tab === 'recordings' ? <Recordings tabs={tabs} /> : <Voicemail tabs={tabs} onCount={onCount} />;
}
