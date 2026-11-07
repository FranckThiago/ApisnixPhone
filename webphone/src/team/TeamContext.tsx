import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { t } from '../i18n';
import { useApp, usePhone } from '../app/AppContext';
import { HttpTeamClient, TeamError, type CallbackPage, type Objective, type Review, type Workspace } from './client';
import { TeamContext } from './context';
import { DemoTeamClient } from './demo';

export function TeamProvider({children}:{children:ReactNode}) {
  const {store,recordingsAccess}=useApp();const {demo}=usePhone();
  const client=useMemo(()=>demo?new DemoTeamClient():new HttpTeamClient(String(import.meta.env.VITE_RECORDINGS_URL??'/api').replace(/\/$/,'')),[demo]);
  const [workspace,setWorkspace]=useState<Workspace|null>(null),[reviews,setReviews]=useState<Review[]>([]),[objectives,setObjectives]=useState<Objective[]>([]),[error,setError]=useState(''),[version,setVersion]=useState(0);
  const active=useRef(false),pending=useRef(false),epoch=useRef(0);
  const refresh=useCallback(async function refreshTeam(): Promise<void> {
    if(!active.current||pending.current)return;pending.current=true;const current=epoch.current;
    try {
      const w=await client.request<Workspace>();
      const [q,g,c]=await Promise.all([client.request<{reviews:Review[]}>('/quality'),w.policy.shared_enabled?client.request<{objectives:Objective[]}>('/objectives'):Promise.resolve({objectives:[]}),w.policy.shared_enabled?client.request<CallbackPage>('/callbacks'):Promise.resolve(null)]);
      if(!active.current||current!==epoch.current)return;
      setWorkspace(w);setReviews(q.reviews);setObjectives(g.objectives);setError('');setVersion(v=>v+1);
      if(c?.promoted.length) {const ids=new Set(c.promoted);for(const callback of store.getSnapshot().callbacks)if(ids.has(callback.id))store.removeCallback(callback.id);}
    } catch(e) {if(active.current&&current===epoch.current){setError(e instanceof Error?e.message:'');if(e instanceof TeamError&&(e.status===401||e.status===403)){setWorkspace(null);setReviews([]);setObjectives([]);}}}
    finally{pending.current=false;if(active.current&&current!==epoch.current)void refreshTeam();}
  },[client,store]);
  useEffect(()=>{
    active.current=demo||recordingsAccess.state==='open';const current=++epoch.current;
    const update=()=>{if(!document.hidden)void refresh();};const initial=setTimeout(()=>{void refresh();},0);const timer=setInterval(update,30000);
    window.addEventListener('focus',update);window.addEventListener('online',update);document.addEventListener('visibilitychange',update);
    return()=>{active.current=false;epoch.current=current+1;clearTimeout(initial);clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('online',update);document.removeEventListener('visibilitychange',update);};
  },[demo,recordingsAccess.state,refresh]);
  const request=useCallback(async<T,>(path:string,body?:unknown):Promise<T>=>{
    const current=epoch.current;
    const valid=()=>{if(!active.current||current!==epoch.current)throw new TeamError(403,t('team.accessDenied'));};
    valid();const result=await client.request<T>(path,body);valid();
    if(body!==undefined&&path!=='/transfer')await refresh();valid();return result;
  },[client,refresh]);
  const accessible=demo||recordingsAccess.state==='open';
  const value=useMemo(()=>({workspace:accessible?workspace:null,reviews:accessible?reviews:[],objectives:accessible?objectives:[],error,version,refresh,request}),[accessible,workspace,reviews,objectives,error,version,refresh,request]);
  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}
