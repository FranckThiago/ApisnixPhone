import { t } from '../i18n';
import type { CallbackPage, GroupCallback, Review, TeamClient, Workspace } from './client';

/** Fictional in-memory tools; no network or persistent team data in demo mode. */
export class DemoTeamClient implements TeamClient {
  private workspace: Workspace = {endpoint_id:'demo-self',assignment_version:0,team_id:'demo',policy:{shared_enabled:true,transfers_enabled:true},
    resources:[{id:'notice',kind:'notice',title:t('team.demoNotice'),content:t('team.demoNoticeText'),revision:1,read:false},
      {id:'objection',kind:'objection',title:t('team.demoObjection'),content:t('team.demoObjectionText'),revision:1,read:false}],help:[],
    peers:[{id:'demo-peer',name:'Camille · Démo',extension:'1002',assignment_version:0,connected:true}]};
  private callbacks: GroupCallback[] = [{id:'demo-callback',number:'0100000001',name:t('team.demoContact'),note:t('team.demoCallback'),dueAt:Date.now()-600000,createdAt:Date.now()-86400000,revision:1,claimed_by:null,claimed_name:null,owner:'Camille'}];
  private reviews: Review[] = [];
  private promoted: string[] = [];
  async request<T>(path='', body?: unknown): Promise<T> {
    const data = body as Record<string, unknown> | undefined;
    let result: unknown = {};
    if (!path) result=this.workspace;
    else if(path==='/read' && data) {const r=this.workspace.resources.find(r=>r.id===data.id);if(r)r.read=true;}
    else if(path==='/help' && data) this.workspace.help.unshift({id:crypto.randomUUID(),message:String(data.message),reply:'',status:'open'});
    else if(path==='/quality') result={reviews:this.reviews};
    else if(path==='/objectives') result={objectives:[{id:'demo-goal',qualification:t('team.demoGoal'),target:20,achieved:12,starts_at:Date.now()/1000-86400,ends_at:Date.now()/1000+6*86400}]};
    else if(path==='/transfer') result={extension:'1002',name:'Camille'};
    else if(path==='/callbacks/promote' && data) {const c=data.callback as GroupCallback;this.promoted.push(c.id);this.callbacks.unshift({...c,id:crypto.randomUUID(),revision:1,claimed_by:null,claimed_name:null,owner:t('team.you')});}
    else if(path==='/callbacks' && data) this.callbacks.unshift({...data as unknown as GroupCallback,createdAt:Date.now(),revision:1,claimed_by:null,claimed_name:null,owner:t('team.you')});
    else if(path.startsWith('/callbacks/') && data) {
      const c=this.callbacks.find(c=>c.id===path.split('/').pop());if(c){if(data.action==='claim'){c.claimed_by='demo-self';c.claimed_name=t('team.you');}if(data.action==='release'){c.claimed_by=null;c.claimed_name=null;}if(data.action==='done')c.doneAt=Date.now();if(data.action==='reopen')c.doneAt=undefined;if(data.action==='postpone')c.dueAt=Number(data.dueAt);c.revision++;}
    } else if(path.startsWith('/callbacks')) {
      const params=new URLSearchParams(path.split('?')[1]);const q=(params.get('q')||'').toLowerCase();const list=this.callbacks.filter(c=>Boolean(c.doneAt)===(params.get('state')==='done') && [c.name,c.number,c.note].join(' ').toLowerCase().includes(q));
      result={callbacks:list,promoted:this.promoted,count:list.length,page:1,pages:1} satisfies CallbackPage;
    }
    return structuredClone(result) as T;
  }
}
