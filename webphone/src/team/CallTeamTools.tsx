import { ChevronDown, LifeBuoy, MessageSquareQuote, PhoneForwarded, Users } from 'lucide-react';
import { useState } from 'react';
import { useApp, usePhone } from '../app/AppContext';
import { useI18n } from '../i18n';
import { useTeam } from './context';
import { useTeamAction } from './useTeamAction';

/** Team tools under the call card: help, confirmed transfer and objection answers. */
export function CallTeamTools() {
  const { workspace, request, refresh } = useTeam();
  const { phone, setView, notify } = useApp();
  const snapshot = usePhone();
  const { t } = useI18n();
  const { busy, run } = useTeamAction();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  if (!workspace?.policy.shared_enabled) return null;

  const canTransfer = workspace.policy.transfers_enabled && Boolean(phone.transfer) && !snapshot.otherCall
    && !snapshot.switchingCall && snapshot.call?.phase === 'active';
  const objections = workspace.resources.filter(resource => resource.kind === 'objection');

  const transfer = async () => {
    const peer = workspace.peers.find(candidate => candidate.id === target);
    const callId = phone.getSnapshot().call?.id;
    if (!peer || !canTransfer || !callId) return;
    await run(async () => {
      const result = await request<{ extension: string; name: string }>('/transfer', { endpoint_id: peer.id, assignment_version: peer.assignment_version });
      const call = phone.getSnapshot().call;
      if (call?.id !== callId || call.phase !== 'active') throw new Error(t('team.callUnavailable'));
      await phone.transfer!(result.extension);
      notify(t('team.transferDone'), 'success');
      setOpen(false);
    });
  };

  return (
    <section className="dock-card call-team-card" aria-label={t('team.callTools')}>
      <header className="call-team-head">
        <span className="call-team-icon"><Users size={18} aria-hidden="true" /></span>
        <div><small>{t('team.title')}</small><b>{t('team.callTools')}</b></div>
      </header>
      <div className={'call-team-actions' + (canTransfer ? '' : ' single')}>
        <button type="button" className="call-team-action" onClick={() => setView('team')}>
          <LifeBuoy size={17} aria-hidden="true" /><span>{t('team.help')}</span>
        </button>
        {canTransfer && (
          <button type="button" className={'call-team-action' + (open ? ' active' : '')} disabled={busy} aria-expanded={open}
            onClick={() => { setOpen(!open); void refresh(); }}>
            <PhoneForwarded size={17} aria-hidden="true" /><span>{t('team.transfer')}</span>
          </button>
        )}
      </div>
      {open && canTransfer && (
        <div className="call-team-transfer">
          <label>{t('team.destination')}
            <select value={target} disabled={busy} onChange={event => setTarget(event.target.value)}>
              <option value="">{t('team.chooseAgent')}</option>
              {workspace.peers.map(peer => <option key={peer.id} value={peer.id}>{peer.name} · {peer.extension}</option>)}
            </select>
          </label>
          {!workspace.peers.length && <p className="call-team-empty">{t('team.noPeers')}</p>}
          <p className="call-team-hint">{t('team.transferHelp')}</p>
          <div className="call-team-confirm">
            <button type="button" className="ghost" disabled={busy} onClick={() => setOpen(false)}>{t('action.cancel')}</button>
            <button type="button" className="primary" disabled={busy || !target} onClick={() => { void transfer(); }}>
              {t(busy ? 'team.transferring' : 'team.confirmTransfer')}
            </button>
          </div>
        </div>
      )}
      {objections.length > 0 && (
        <details className="call-team-objections">
          <summary>
            <MessageSquareQuote size={16} aria-hidden="true" /><span>{t('team.objections')}</span>
            <i className="call-team-count">{objections.length}</i><ChevronDown size={16} className="call-team-chevron" aria-hidden="true" />
          </summary>
          <div className="call-team-answers">
            {objections.map(resource => (
              <details key={resource.id}>
                <summary><span>{resource.title}</span><ChevronDown size={15} className="call-team-chevron" aria-hidden="true" /></summary>
                <p className="team-copy">{resource.content}</p>
              </details>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
