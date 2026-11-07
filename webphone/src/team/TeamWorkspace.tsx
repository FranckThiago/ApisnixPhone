import { useNow } from '../app/clock';
import { useEffect, useState } from 'react';
import { useApp, usePhone } from '../app/AppContext';
import { useI18n, dateFormat } from '../i18n';
import { useTeamAction } from './useTeamAction';
import { useTeam } from './context';
import type { CallbackPage } from './client';
import type { Callback } from '../domain/types';

const date=(ms:number)=>dateFormat({dateStyle:'short',timeStyle:'short'}).format(ms);

export function PromoteCallback({callback}:{callback:Callback}) {
  const {workspace,request}=useTeam(),{store}=useApp(),{t}=useI18n(),{busy,run}=useTeamAction();
  if(!workspace?.policy.shared_enabled||callback.doneAt)return null;
  return <button type="button" className="ghost" disabled={busy} onClick={()=>{if(window.confirm(t('team.shareConfirm',{number:callback.number})))void run(async()=>{await request('/callbacks/promote',{callback,assignment_version:workspace.assignment_version});store.removeCallback(callback.id);});}}>{t('team.share')}</button>;
}

export function GroupCallbacks() {
  const now=useNow();
  const {workspace,request,version,refresh}=useTeam(),{placeCall,notify,phone:controller}=useApp(),phone=usePhone(),{t}=useI18n(),{busy,run}=useTeamAction();
  const [result,setResult]=useState<CallbackPage|null>(null),[page,setPage]=useState(1),[done,setDone]=useState(false),[query,setQuery]=useState(''),[search,setSearch]=useState(''),[error,setError]=useState('');
  useEffect(()=>{let alive=true;if(!workspace?.policy.shared_enabled)return;void request<CallbackPage>('/callbacks?'+new URLSearchParams({page:String(page),state:done?'done':'pending',q:query})).then(r=>{if(alive){setResult(r);setError('');}}).catch(e=>{if(alive)setError(e instanceof Error?e.message:t('team.failed'));});return()=>{alive=false;};},[workspace?.policy.shared_enabled,request,version,page,done,query,t]);
  if(!workspace?.policy.shared_enabled)return null;
  const available=phone.connection==='ready'&&(!phone.call||phone.call.phase==='ended');
  return <section className="panel team-section"><header><h2>{t('team.groupCallbacks')}</h2><button className="ghost" type="button" onClick={()=>{void refresh();}}>{t('team.refresh')}</button></header>
    <p>{t('team.claimHelp')}</p>
    <form className="team-controls" onSubmit={e=>{e.preventDefault();setQuery(search);setPage(1);}}><label>{t('team.search')}<input type="search" maxLength={100} value={search} onChange={e=>setSearch(e.target.value)} /></label><button className="ghost" type="submit">{t('team.search')}</button><label><input type="checkbox" checked={done} onChange={e=>{setDone(e.target.checked);setPage(1);}} /> {t('team.completed')}</label></form>
    {error&&<p role="alert">{error}</p>}
    {result?.callbacks.map(c=>{const mine=c.claimed_by===workspace.endpoint_id;return <article className={'team-card'+(!c.doneAt&&c.dueAt<now?' overdue':'')} key={c.id}>
      <h3>{c.name||c.number}</h3><p>{c.number} · {date(c.dueAt)}</p><p className="team-copy">{c.note}</p><small>{c.claimed_by?t('team.claimedBy',{name:c.claimed_name||''}):t('team.available')}</small>
      <div className="team-controls">
        {!c.doneAt&&!c.claimed_by&&<button className="primary" disabled={busy||!available} onClick={()=>{void run(async()=>{await request('/callbacks/'+encodeURIComponent(c.id),{action:'claim',revision:c.revision});if(controller.getSnapshot().connection==='ready'&&(!controller.getSnapshot().call||controller.getSnapshot().call?.phase==='ended'))placeCall(c.number);else notify(t('team.callUnavailable'));});}}>{t('team.claimCall')}</button>}
        {mine&&!c.doneAt&&<><button className="primary" disabled={busy||!available} onClick={()=>placeCall(c.number)}>{t('action.call')}</button><button className="ghost" disabled={busy} onClick={()=>{void run(()=>request('/callbacks/'+c.id,{action:'done',revision:c.revision}));}}>{t('callbacks.markDone')}</button><button className="ghost" disabled={busy} onClick={()=>{void run(()=>request('/callbacks/'+c.id,{action:'postpone',revision:c.revision,dueAt:Math.max(Date.now(),c.dueAt)+3600000}));}}>{t('team.later')}</button><button className="ghost" disabled={busy} onClick={()=>{void run(()=>request('/callbacks/'+c.id,{action:'release',revision:c.revision}));}}>{t('team.release')}</button></>}
        {mine&&c.doneAt&&<button className="ghost" disabled={busy} onClick={()=>{void run(()=>request('/callbacks/'+c.id,{action:'reopen',revision:c.revision}));}}>{t('callbacks.reopen')}</button>}
      </div></article>;})}
    {result?.count===0&&<p>{t('team.noCallbacks')}</p>}
    <div className="team-controls"><button className="ghost" disabled={!result||result.page<=1} onClick={()=>setPage((result?.page||1)-1)}>←</button><span>{result?.count??'…'} · {result?.page||1} / {result?.pages||1}</span><button className="ghost" disabled={!result||result.page>=result.pages} onClick={()=>setPage((result?.page||1)+1)}>→</button></div>
  </section>;
}

export function TeamWorkspace() {
  const {workspace,reviews,objectives,error,request,refresh}=useTeam(),{t}=useI18n(),{busy,run}=useTeamAction();const [help,setHelp]=useState(''),[search,setSearch]=useState('');
  const shared=workspace?.policy.shared_enabled;
  return <div className="page team-page"><header className="page-head"><div><p className="eyebrow">APISNIX</p><h1>{t('team.title')}</h1><p className="lead">{t('team.lead')}</p></div><button className="ghost" onClick={()=>{void refresh();}}>{t('team.refresh')}</button></header>
    {error&&<p role="alert">{error}</p>}
    {shared&&<>
      <section className="panel team-section"><h2>{t('team.notices')}</h2>{workspace.resources.filter(r=>r.kind==='notice').map(r=><article className="team-card" key={r.id}><h3>{r.title}</h3><p className="team-copy">{r.content}</p><button className="ghost" disabled={busy||r.read} onClick={()=>{void run(()=>request('/read',{id:r.id,revision:r.revision}));}}>{t(r.read?'team.read':'team.markRead')}</button></article>)}{!workspace.resources.some(r=>r.kind==='notice')&&<p>{t('team.empty')}</p>}</section>
      <GroupCallbacks />
      <section className="panel team-section"><h2>{t('team.help')}</h2>{workspace.help.filter(h=>h.status!=='closed').map(h=><article className="team-card" key={h.id}><p>{h.message}</p><b>{h.reply||t('team.helpPending')}</b></article>)}
        {!workspace.help.some(h=>h.status!=='closed')&&<form onSubmit={e=>{e.preventDefault();void run(async()=>{await request('/help',{message:help});setHelp('');});}}><label>{t('team.helpPrompt')}<textarea value={help} onChange={e=>setHelp(e.target.value)} maxLength={1000} required /></label><button className="primary" disabled={busy||!help.trim()} type="submit">{t('team.send')}</button></form>}
      </section>
      <section className="panel team-section"><h2>{t('team.objections')}</h2><label>{t('team.search')}<input type="search" value={search} onChange={e=>setSearch(e.target.value)} /></label>{workspace.resources.filter(r=>r.kind==='objection'&&(r.title+' '+r.content).toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(r=><details className="team-card" key={r.id}><summary>{r.title}</summary><p className="team-copy">{r.content}</p></details>)}</section>
      <section className="panel team-section"><h2>{t('team.goals')}</h2>{objectives.map(g=><article className="team-card" key={g.id}><h3>{g.qualification}</h3><strong>{g.achieved} / {g.target}</strong><progress value={g.achieved} max={g.target} /><p>{date(g.starts_at*1000)} → {date(g.ends_at*1000)}</p></article>)}{!objectives.length&&<p>{t('team.empty')}</p>}</section>
    </>}
    <section className="panel team-section"><h2>{t('team.coaching')}</h2>{reviews.map(r=><article className="team-card" key={r.id}><h3>{r.number} · {date(r.started_at*1000)}</h3><strong>{r.score} / 100</strong>{r.criteria.map(c=><p key={c.label}>{c.label} : {c.score} / 5 {c.comment&&'— '+c.comment}</p>)}<p className="team-copy">{r.comment}</p><p className="team-copy"><b>{t('team.nextAction')}</b> {r.action_plan}</p>{r.audio_second!==null&&<p>{t('team.audioMark',{second:r.audio_second})}</p>}{r.follow_up&&<p>{t('team.followUp')} {date(r.follow_up*1000)}</p>}<button className="ghost" disabled={busy||r.ack_revision===r.revision} onClick={()=>{void run(()=>request('/quality/'+r.id+'/read',{revision:r.revision}));}}>{t(r.ack_revision===r.revision?'team.read':'team.markRead')}</button></article>)}{!reviews.length&&<p>{t('team.empty')}</p>}</section>
  </div>;
}
