import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n';
import { useTeam } from './context';

export function useTeamAction() {
  const {notify}=useApp(),{refresh}=useTeam(),{t}=useI18n();const [busy,setBusy]=useState(false);
  const run=async(action:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);try{await action();}catch(e){notify(e instanceof Error?e.message:t('team.failed'),'danger');void refresh();}finally{setBusy(false);}};
  return {busy,run};
}
