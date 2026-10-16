import { useI18n } from '../../i18n';
import type { CallSnapshot } from '../../telephony/types';

export function WaitingCallCard({ call, switchingCall, onAnswer, onDecline, onSwitch }: {
  call?: CallSnapshot; switchingCall?: boolean; onAnswer(): void; onDecline(): void; onSwitch(): void;
}) {
  const { t } = useI18n();
  if (!call) return null;
  const ringing = call.phase === 'ringing-in';
  return <section className="dock-card waiting-call" aria-label={t('waiting.incoming')}>
    <p className="waiting-title" role="status">{t(switchingCall ? 'waiting.switching' : ringing ? 'waiting.incoming' : call.phase === 'held' ? 'call.held' : 'waiting.held')}</p>
    <b>{call.remoteName || call.dialTarget}</b>
    {call.remoteName && <span>{call.dialTarget}</span>}
    <small>{t('waiting.hint')}</small>
    <div className="waiting-actions">
      {ringing ? <>
        <button type="button" className="done" disabled={switchingCall} onClick={() => onAnswer()}>{t('waiting.answer')}</button>
        <button type="button" className="ghost-call danger" disabled={switchingCall} onClick={() => onDecline()}>{t('call.decline')}</button>
      </> : <button type="button" className="done" disabled={switchingCall || call.holdPending || !['active', 'held'].includes(call.phase)} onClick={() => onSwitch()}>{t('waiting.switch')}</button>}
    </div>
  </section>;
}

