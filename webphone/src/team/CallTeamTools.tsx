import { useState } from 'react';
import { useApp, usePhone } from '../app/AppContext';
import { useI18n } from '../i18n';
import { useTeam } from './context';
import { useTeamAction } from './useTeamAction';

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
    <section className="call-team-tools">
      <div className="team-controls">
        <button className="ghost-call" onClick={() => setView('team')}>{t('team.help')}</button>
        {canTransfer && <button className="ghost-call" disabled={busy} onClick={() => { setOpen(!open); void refresh(); }}>{t('team.transfer')}</button>}
      </div>
      {open && canTransfer && (
        <div className="team-transfer">
          <label>{t('team.destination')}
            <select value={target} disabled={busy} onChange={event => setTarget(event.target.value)}>
              <option value="">{t('team.chooseAgent')}</option>
              {workspace.peers.map(peer => <option key={peer.id} value={peer.id}>{peer.name} · {peer.extension}</option>)}
            </select>
          </label>
          {!workspace.peers.length && <p>{t('team.noPeers')}</p>}
          <p>{t('team.transferHelp')}</p>
          <button className="primary" disabled={busy || !target} onClick={() => { void transfer(); }}>{t(busy ? 'team.transferring' : 'team.confirmTransfer')}</button>
        </div>
      )}
      {objections.length > 0 && (
        <details>
          <summary>{t('team.objections')}</summary>
          {objections.map(resource => (
            <details key={resource.id}><summary>{resource.title}</summary><p className="team-copy">{resource.content}</p></details>
          ))}
        </details>
      )}
    </section>
  );
}
