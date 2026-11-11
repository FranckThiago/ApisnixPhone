import { sessionFetch } from '../http/embeddedSession';
import { t } from '../i18n';
import type { Callback } from '../domain/types';

export interface Peer { id: string; name: string; extension: string; assignment_version: number; connected: boolean }
export interface Resource { id: string; kind: 'notice' | 'objection'; title: string; content: string; revision: number; read: boolean }
export interface Help { id: string; message: string; reply: string; status: 'open' | 'answered' | 'closed' }
export interface Workspace { endpoint_id: string; assignment_version: number; team_id: string; policy: {shared_enabled: boolean; transfers_enabled: boolean}; resources: Resource[]; help: Help[]; peers: Peer[]; admin_hangups?: {id: number; at: number}[] }
export interface GroupCallback extends Callback { revision: number; claimed_by: string | null; claimed_name: string | null; owner: string }
export interface CallbackPage { callbacks: GroupCallback[]; promoted: string[]; count: number; page: number; pages: number }
export interface Review {id: string; call_id: number; number: string; started_at: number; score: number; criteria: {label: string; score: number; comment: string}[]; comment: string; action_plan: string; audio_second: number | null; follow_up: number | null; revision: number; ack_revision: number | null}
export interface Objective {id: string; qualification: string; target: number; achieved: number; starts_at: number; ends_at: number}
export interface TeamClient { request<T>(path?: string, body?: unknown): Promise<T> }

export class HttpTeamClient implements TeamClient {
  constructor(private base: string, private fetchImpl: typeof fetch = sessionFetch) {}
  async request<T>(path = '', body?: unknown): Promise<T> {
    const headers: Record<string,string> = {};
    if (body !== undefined) {
      const me = await this.fetchImpl(this.base+'/me', {credentials:'include',cache:'no-store',signal:AbortSignal.timeout(10000)});
      if (!me.ok) throw new Error(t('team.accessDenied'));
      const data = await me.json() as {csrf?: string};
      if (!data.csrf) throw new Error(t('team.accessDenied'));
      headers['X-CSRF-Token']=data.csrf;headers['Content-Type']='application/json';
    }
    const response = await this.fetchImpl(this.base+'/team-workspace'+path, {method:body === undefined?'GET':'POST',headers,
      ...(body === undefined?{}:{body:JSON.stringify(body)}),credentials:'include',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw new TeamError(response.status, t(response.status===409?'team.conflict':response.status===401||response.status===403?'team.accessDenied':'team.failed'));
    return response.json() as Promise<T>;
  }
}
export class TeamError extends Error {constructor(public status: number, message: string) {super(message);}}
