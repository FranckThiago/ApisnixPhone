import { AlarmClock, ChevronDown, ChevronRight, ClipboardCheck, LifeBuoy, Megaphone, MessageSquareQuote, PhoneForwarded, Target, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApp, usePhone } from '../app/AppContext';
import { Avatar } from '../components/Avatar';
import { dateFormat, useI18n } from '../i18n';
import { useTeam } from './context';
import { useTeamAction } from './useTeamAction';

type Panel = 'help' | 'transfer' | 'notices' | 'answers' | 'goals' | 'reviews';
const date = (ms: number) => dateFormat({ dateStyle: 'short', timeStyle: 'short' }).format(ms);

/** One expandable line of the team card; only one is open at a time. */
function Row({ icon, label, count, alert = false, open, onToggle, children }: {
  icon: ReactNode; label: string; count?: number; alert?: boolean; open: boolean; onToggle(): void; children: ReactNode;
}) {
  return (
    <li className={open ? 'open' : ''}>
      <button type="button" className="team-dock-row" aria-expanded={open} onClick={onToggle}>
        {icon}<span>{label}</span>
        {count !== undefined && count > 0 && <i className={'call-team-count' + (alert ? ' alert' : '')}>{count}</i>}
        <ChevronDown size={16} className="call-team-chevron" aria-hidden="true" />
      </button>
      {open && <div className="team-dock-panel">{children}</div>}
    </li>
  );
}

/**
 * Team functions under the keypad, shown only when the supervisor enabled them:
 * help and transfer during a call, notices, objection answers, goals and reviews.
 */
export function TeamDock() {
  const { workspace, reviews, objectives, request, refresh } = useTeam();
  const { phone, setView, notify } = useApp();
  const snapshot = usePhone();
  const { t } = useI18n();
  const { busy, run } = useTeamAction();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [target, setTarget] = useState('');
  const [help, setHelp] = useState('');
  const shared = Boolean(workspace?.policy.shared_enabled);
  if (!workspace || (!shared && !reviews.length)) return null;

  const call = snapshot.call;
  const inCall = call?.phase === 'active' || call?.phase === 'held';
  const showTransfer = shared && workspace.policy.transfers_enabled && Boolean(phone.transfer) && inCall;
  const canTransfer = showTransfer && !snapshot.otherCall && !snapshot.switchingCall && call?.phase === 'active';
  const notices = workspace.resources.filter(resource => resource.kind === 'notice');
  const objections = workspace.resources.filter(resource => resource.kind === 'objection');
  const openHelp = workspace.help.filter(item => item.status !== 'closed');
  const unreadNotices = notices.filter(notice => !notice.read).length;
  const answered = workspace.help.filter(item => item.status === 'answered').length;
  const unreadReviews = reviews.filter(review => review.ack_revision !== review.revision).length;
  const pending = (shared ? unreadNotices + answered : 0) + unreadReviews;
  const toggle = (next: Panel) => setPanel(panel === next ? null : next);

  const transfer = async () => {
    const peer = workspace.peers.find(candidate => candidate.id === target);
    const callId = phone.getSnapshot().call?.id;
    if (!peer || !canTransfer || !callId) return;
    await run(async () => {
      const result = await request<{ extension: string; name: string }>('/transfer', { endpoint_id: peer.id, assignment_version: peer.assignment_version });
      const current = phone.getSnapshot().call;
      if (current?.id !== callId || current.phase !== 'active') throw new Error(t('team.callUnavailable'));
      await phone.transfer!(result.extension);
      notify(t('team.transferDone'), 'success');
      setPanel(null);
    });
  };

  return (
    <section className="dock-card call-team-card" aria-label={t('team.title')}>
      <header className="call-team-head">
        <span className="call-team-icon"><Users size={18} aria-hidden="true" /></span>
        <div><small>{t('team.title')}</small><b>{t(inCall && shared ? 'team.callTools' : 'team.dockLead')}</b></div>
        {pending > 0 && <i className="call-team-count alert" title={t('team.pending', { count: pending })} aria-label={t('team.pending', { count: pending })}>{pending}</i>}
      </header>

      {shared && (
        <div className={'call-team-actions' + (showTransfer ? '' : ' single')}>
          <button type="button" className={'call-team-action' + (panel === 'help' ? ' active' : '')} aria-expanded={panel === 'help'} onClick={() => toggle('help')}>
            <LifeBuoy size={17} aria-hidden="true" /><span>{t('team.help')}</span>
            {answered > 0 && <i className="call-team-dot" aria-hidden="true" />}
          </button>
          {showTransfer && (
            <button type="button" className={'call-team-action' + (panel === 'transfer' ? ' active' : '')} aria-expanded={panel === 'transfer'}
              disabled={!canTransfer || busy} onClick={() => { toggle('transfer'); void refresh(); }}>
              <PhoneForwarded size={17} aria-hidden="true" /><span>{t('team.transfer')}</span>
            </button>
          )}
        </div>
      )}

      {shared && panel === 'help' && (
        <div className="call-team-transfer">
          {openHelp.map(item => (
            <div className="team-dock-item" key={item.id}><p className="team-copy">{item.message}</p><b>{item.reply || t('team.helpPending')}</b></div>
          ))}
          {!openHelp.length && (
            <form className="team-dock-form" onSubmit={event => { event.preventDefault(); void run(async () => { await request('/help', { message: help }); setHelp(''); }); }}>
              <label>{t('team.helpPrompt')}<textarea value={help} onChange={event => setHelp(event.target.value)} maxLength={1000} required /></label>
              <button className="primary" disabled={busy || !help.trim()} type="submit">{t('team.send')}</button>
            </form>
          )}
        </div>
      )}

      {panel === 'transfer' && canTransfer && (
        <div className="call-team-transfer">
          <fieldset className="team-peers" disabled={busy}>
            <legend>{t('team.destination')}</legend>
            {workspace.peers.map(peer => (
              <label key={peer.id} className={'team-peer' + (target === peer.id ? ' selected' : '')}>
                <input type="radio" name="team-transfer-target" value={peer.id} checked={target === peer.id} onChange={() => setTarget(peer.id)} />
                <Avatar name={peer.name} size={30} /><span className="team-peer-name"><b>{peer.name}</b><small>{peer.extension}</small></span>
              </label>
            ))}
          </fieldset>
          {!workspace.peers.length && <p className="call-team-empty">{t('team.noPeers')}</p>}
          <p className="call-team-hint">{t('team.transferHelp')}</p>
          <div className="call-team-confirm">
            <button type="button" className="ghost" disabled={busy} onClick={() => setPanel(null)}>{t('action.cancel')}</button>
            <button type="button" className="primary" disabled={busy || !target} onClick={() => { void transfer(); }}>
              {t(busy ? 'team.transferring' : 'team.confirmTransfer')}
            </button>
          </div>
        </div>
      )}

      <ul className="team-dock-rows">
        {shared && (
          <Row icon={<Megaphone size={16} aria-hidden="true" />} label={t('team.notices')} count={unreadNotices} alert
            open={panel === 'notices'} onToggle={() => toggle('notices')}>
            {notices.map(notice => (
              <div className="team-dock-item" key={notice.id}>
                <b>{notice.title}</b><p className="team-copy">{notice.content}</p>
                <button type="button" className="ghost small" disabled={busy || notice.read}
                  onClick={() => { void run(() => request('/read', { id: notice.id, revision: notice.revision })); }}>{t(notice.read ? 'team.read' : 'team.markRead')}</button>
              </div>
            ))}
            {!notices.length && <p className="call-team-hint">{t('team.empty')}</p>}
          </Row>
        )}
        {shared && objections.length > 0 && (
          <Row icon={<MessageSquareQuote size={16} aria-hidden="true" />} label={t('team.objections')} count={objections.length}
            open={panel === 'answers'} onToggle={() => toggle('answers')}>
            <div className="call-team-answers">
              {objections.map(resource => (
                <details key={resource.id}>
                  <summary><span>{resource.title}</span><ChevronDown size={15} className="call-team-chevron" aria-hidden="true" /></summary>
                  <p className="team-copy">{resource.content}</p>
                </details>
              ))}
            </div>
          </Row>
        )}
        {shared && objectives.length > 0 && (
          <Row icon={<Target size={16} aria-hidden="true" />} label={t('team.goals')} open={panel === 'goals'} onToggle={() => toggle('goals')}>
            {objectives.map(goal => (
              <div className="team-dock-item" key={goal.id}>
                <div className="team-dock-goal"><b>{goal.qualification}</b><strong>{goal.achieved} / {goal.target}</strong></div>
                <progress value={goal.achieved} max={goal.target} />
                <small>{date(goal.starts_at * 1000)} → {date(goal.ends_at * 1000)}</small>
              </div>
            ))}
          </Row>
        )}
        {reviews.length > 0 && (
          <Row icon={<ClipboardCheck size={16} aria-hidden="true" />} label={t('team.coaching')} count={unreadReviews} alert
            open={panel === 'reviews'} onToggle={() => toggle('reviews')}>
            {reviews.map(review => {
              const read = review.ack_revision === review.revision;
              return (
                <div className="team-dock-item" key={review.id}>
                  <div className="team-dock-goal"><b>{review.number} · {date(review.started_at * 1000)}</b><strong>{review.score} / 100</strong></div>
                  {review.criteria.map(criterion => <p key={criterion.label}>{criterion.label} : {criterion.score} / 5 {criterion.comment && '— ' + criterion.comment}</p>)}
                  {review.comment && <p className="team-copy">{review.comment}</p>}
                  {review.action_plan && <p className="team-copy"><b>{t('team.nextAction')}</b> {review.action_plan}</p>}
                  {review.audio_second !== null && <small>{t('team.audioMark', { second: review.audio_second })}</small>}
                  {review.follow_up && <small>{t('team.followUp')} {date(review.follow_up * 1000)}</small>}
                  <button type="button" className="ghost small" disabled={busy || read}
                    onClick={() => { void run(() => request('/quality/' + encodeURIComponent(review.id) + '/read', { revision: review.revision })); }}>{t(read ? 'team.read' : 'team.markRead')}</button>
                </div>
              );
            })}
          </Row>
        )}
        {shared && (
          <li>
            <button type="button" className="team-dock-row" onClick={() => setView('callbacks')}>
              <AlarmClock size={16} aria-hidden="true" /><span>{t('team.groupCallbacks')}</span><ChevronRight size={16} className="call-team-chevron" aria-hidden="true" />
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
