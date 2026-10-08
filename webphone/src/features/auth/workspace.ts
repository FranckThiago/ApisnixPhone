import { t } from '../../i18n';
import type { RecordingsSource } from '../../recordings/types';
import type { DataStore } from '../../storage/DataStore';
import type { Credentials } from '../../telephony/types';

export type RecordingsAccess = { state: 'idle' | 'opening' | 'open' } | { state: 'failed'; message: string };

/** HTTP data access cannot revoke an accepted SIP registration. */
export async function openLiveWorkspace(store: DataStore, recordings: RecordingsSource, credentials: Credentials, profile: string): Promise<RecordingsAccess> {
  try {
    await recordings.openWithLine(credentials.username, credentials.password);
  } catch (error) {
    store.openTemporary(profile, t('settings.profileUnavailable'));
    return { state: 'failed', message: error instanceof Error ? error.message : t('rec.unreachable') };
  }
  try { await store.open(profile, true); }
  catch { store.openTemporary(profile, t('settings.profileUnavailable')); }
  return { state: 'open' };
}
