import type { PhoneController } from './types';

/** Actual page departure, never a hidden tab or navigation inside the application. */
export function bindPageLifecycle(phone: PhoneController, target: Window = window) {
  const warn = (event: BeforeUnloadEvent) => {
    const call = phone.getSnapshot().call;
    if (!call || call.phase === 'ended') return;
    event.preventDefault();
    // Still required by some browsers to show their native confirmation.
    event.returnValue = '';
  };
  const leave = () => {
    // Start BYE/CANCEL before the browser destroys the document. Delivery is best effort;
    // the PBX must also expire abandoned dialogs if the process/network disappears.
    void phone.disconnect().catch(() => undefined);
  };
  const restore = (event: PageTransitionEvent) => {
    // A cached document must not resurrect a destroyed SIP session or a held browser lock.
    if (event.persisted) target.location.reload();
  };
  target.addEventListener('beforeunload', warn);
  target.addEventListener('pagehide', leave);
  target.addEventListener('pageshow', restore);
  return () => {
    target.removeEventListener('beforeunload', warn);
    target.removeEventListener('pagehide', leave);
    target.removeEventListener('pageshow', restore);
  };
}
