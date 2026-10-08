import type { Credentials, PhoneController } from '../../telephony/types';

/** One complete sign-in at a time, including the workspace after REGISTER. */
export function createLineLogin(phone: PhoneController, openWorkspace: (credentials: Credentials, profile: string) => Promise<void>) {
  let pending: Promise<boolean> | null = null;
  return (input: Credentials): Promise<boolean> => {
    if (pending) return pending;
    const credentials = { ...input, username: input.username.trim() };
    pending = (async () => {
      await phone.connect(credentials);
      await new Promise<void>(resolve => {
        const settled = () => !['connecting', 'registering'].includes(phone.getSnapshot().connection);
        if (settled()) return resolve();
        const stop = phone.subscribe(() => { if (settled()) { stop(); resolve(); } });
      });
      const { account, connection } = phone.getSnapshot();
      if (connection !== 'ready' || !account || account.username !== credentials.username) return false;
      await openWorkspace(credentials, `${account.domain}:${account.username}`);
      const current = phone.getSnapshot();
      return current.account === account && current.connection === 'ready';
    })().finally(() => { pending = null; });
    return pending;
  };
}
