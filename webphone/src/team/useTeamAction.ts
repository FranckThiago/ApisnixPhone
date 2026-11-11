import { useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n';
import { useTeam } from './context';

/** One action at a time per control, including two clicks before the next render. */
export function useTeamAction() {
  const { notify } = useApp();
  const { refresh } = useTeam();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const run = async (action: () => Promise<unknown>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      notify(error instanceof Error ? error.message : t('team.failed'), 'danger');
      void refresh();
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  return { busy, run };
}
