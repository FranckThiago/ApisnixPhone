import { ArrowDownLeft, ArrowUpRight, Pause, Phone, PhoneOff, Play } from 'lucide-react';
import { useI18n } from '../../i18n';
import type { CallSnapshot } from '../../telephony/types';

/** The other lines of a multi-call phone: each call that rings or waits on hold, with its own actions. */
export function WaitingCallCard({ calls, switchingCall, onAnswer, onDecline, onSwitch }: {
  calls: CallSnapshot[]; switchingCall?: boolean; onAnswer(id: string): void; onDecline(id: string): void; onSwitch(id: string): void;
}) {
  const { t, tp } = useI18n();
  if (!calls.length) return null;
  const ringing = calls.filter(call => call.phase === 'ringing-in').length;
  return (
    <section className={'dock-card waiting-call' + (ringing ? ' has-ringing' : '')} aria-label={t('lines.title')}>
      <header className="waiting-head">
        <b>{t('lines.title')}</b>
        <span role="status">{switchingCall ? t('waiting.switching') : ringing ? tp('lines.ringing', ringing) : tp('lines.onHold', calls.length)}</span>
      </header>
      <ul className="line-list">
        {calls.map(call => {
          const rings = call.phase === 'ringing-in';
          const waits = call.phase === 'held' || call.phase === 'active';
          return (
            <li key={call.id} className={'line-row' + (rings ? ' ringing' : '')}>
              <span className="line-state" aria-hidden="true">
                {rings ? <Phone size={16} /> : call.direction === 'inbound' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </span>
              <span className="line-who">
                <b>{call.remoteName || call.dialTarget}</b>
                <small>{rings ? t('call.ringingIn') : call.phase === 'held' ? <><Pause size={11} aria-hidden="true" /> {t('call.held')}</> : t('waiting.held')}{call.remoteName ? ` · ${call.dialTarget}` : ''}</small>
              </span>
              <span className="line-actions">
                {rings ? <>
                  <button type="button" className="line-button accept" disabled={switchingCall} onClick={() => onAnswer(call.id)}
                    aria-label={t('waiting.answer')} title={t('waiting.answer')}><Phone size={17} /></button>
                  <button type="button" className="line-button decline" disabled={switchingCall} onClick={() => onDecline(call.id)}
                    aria-label={t('call.decline')} title={t('call.decline')}><PhoneOff size={17} /></button>
                </> : (
                  <button type="button" className="line-button resume" disabled={switchingCall || call.holdPending || !waits} onClick={() => onSwitch(call.id)}
                    aria-label={t('waiting.switch')} title={t('waiting.switch')}><Play size={17} /></button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <small className="waiting-hint">{t('waiting.hint')}</small>
    </section>
  );
}
