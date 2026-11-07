import { useState } from 'react';
import { useApp, usePhone } from '../app/AppContext';
import { useI18n } from '../i18n';
import { useTeam } from './context';
import { useTeamAction } from './useTeamAction';

export function CallTeamTools() {
  const {workspace,request,refresh}=useTeam(),{phone,setView,notify}=useApp(),snapshot=usePhone(),{t}=useI18n(),{busy,run}=useTeamAction();
  const [open,setOpen]=useState(false),[target,setTarget]=useState('');
  if(!workspace?.policy.shared_enabled)return null;
  const canTransfer=workspace.policy.transfers_enabled&&phone.transfer&&!snapshot.otherCall&&!snapshot.switchingCall&&snapshot.call?.phase==='active';
  const transfer=async()=>{
    const peer=workspace.peers.find(p=>p.id===target);const callId=phone.getSnapshot().call?.id;
    if(!peer||!canTransfer||!callId)return;
    await run(async()=>{
      const result=await request<{extension:string;name:string}>('/transfer',{endpoint_id:peer.id,assignment_version:peer.assignment_version});
      if(phone.getSnapshot().call?.id!==callId||phone.getSnapshot().call?.phase!=='active')throw new Error(t('team.callUnavailable'));
      await phone.transfer!(result.extension);notify(t('team.transferDone'),'success');setOpen(false);
    });
  };
  return <section className="call-team-tools"><div className="team-controls"><button className="ghost-call" onClick={()=>setView('team')}>{t('team.help')}</button>{canTransfer&&<button className="ghost-call" disabled={busy} onClick={()=>{setOpen(!open);void refresh();}}>{t('team.transfer')}</button>}</div>
    {open&&canTransfer&&<div className="team-transfer"><label>{t('team.destination')}<select value={target} disabled={busy} onChange={e=>setTarget(e.target.value)}><option value="">{t('team.chooseAgent')}</option>{workspace.peers.map(p=><option key={p.id} value={p.id}>{p.name} · {p.extension}</option>)}</select></label>{!workspace.peers.length&&<p>{t('team.noPeers')}</p>}<p>{t('team.transferHelp')}</p><button className="primary" disabled={busy||!target} onClick={()=>{void transfer();}}>{t(busy?'team.transferring':'team.confirmTransfer')}</button></div>}
    {workspace.resources.some(r=>r.kind==='objection')&&<details><summary>{t('team.objections')}</summary>{workspace.resources.filter(r=>r.kind==='objection').map(r=><details key={r.id}><summary>{r.title}</summary><p className="team-copy">{r.content}</p></details>)}</details>}
  </section>;
}
