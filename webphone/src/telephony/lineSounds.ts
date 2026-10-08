import type { DataStore } from '../storage/DataStore';
import { chime } from './audio';
import type { PhoneController } from './types';

/** Install only in the rendered workspace, never on the sign-in form. */
export function bindWorkspaceLineSounds(phone: PhoneController, store: Pick<DataStore, 'getSnapshot'>, play = chime) {
  let wasReady = false;
  let frame: number | undefined;
  const ready = () => {
    const state = phone.getSnapshot();
    return state.connection === 'ready' && !!state.account && !state.lineTaken;
  };
  const cancel = () => { if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; };
  const update = () => {
    const isReady = ready();
    if (isReady === wasReady) return;
    const previous = wasReady;
    wasReady = isReady;
    cancel();
    if (isReady) {
      // React has committed the workspace. Recheck at the next frame, so a connection
      // lost during rendering (or a failed/unmounted workspace) never announces success.
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const { lineSounds, volume } = store.getSnapshot().preferences;
        if (ready() && lineSounds) play('ready', volume / 100);
      });
    } else if (previous && phone.getSnapshot().connection === 'reconnecting') {
      const { lineSounds, volume } = store.getSnapshot().preferences;
      if (lineSounds) play('lost', volume / 100);
    }
  };
  const unsubscribe = phone.subscribe(update);
  update();
  return () => { cancel(); unsubscribe(); };
}
