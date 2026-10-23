import { isEmbeddedSession } from '../http/embeddedSession';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { parseDialInput } from '../domain/numbers';
import { notificationsEnabled } from '../telephony/notifications';
import { bindPageLifecycle } from '../telephony/pageLifecycle';
import { t, language, setLanguage } from '../i18n';
import { DataStore, findContact } from '../storage/DataStore';
import { indexedDbPersistence } from '../storage/persistence';
import { ServerPersistence } from '../storage/serverPersistence';
import { DemoPhoneController } from '../telephony/DemoPhoneController';
import { DEMO_CALLERS, demoSeed } from '../telephony/demoSeed';
import { CallWaitingPhoneController } from '../telephony/CallWaitingPhoneController';
import { browserSipEnvironment, sipConfigFromEnv } from '../telephony/sipEnvironment';
import type { Credentials, PhoneController } from '../telephony/types';
import { createLineLogin } from '../features/auth/lineLogin';
import { openLiveWorkspace, type RecordingsAccess } from '../features/auth/workspace';
import { forgetSilentAccess } from '../features/auth/credentials';
import { DemoRecordingsSource, HttpRecordingsSource } from '../recordings/client';
import { announcementsUrlFromEnv, DemoAnnouncementsSource, HttpAnnouncementsSource, type AnnouncementsSource } from '../announcements/client';
import type { RecordingsSource } from '../recordings/types';
import { applyTheme, storedTheme } from './theme';

export type View = 'journal' | 'contacts' | 'audio' | 'callbacks' | 'settings' | 'phone';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'danger';
}

interface AppValue {
  phone: PhoneController;
  store: DataStore;
  /** The recordings of the person's own phone, served by the supervision service. */
  recordings: RecordingsSource;
  /** APISNIX announcements written in the PBX administration; fictional in the demonstration. */
  announcements: AnnouncementsSource;
  view: View;
  setView(view: View): void;
  dial: string;
  setDial(value: string): void;
  placeCall(rawInput: string): void;
  /** Resolves to true once the line is registered and the session is open. */
  login(credentials: Credentials): Promise<boolean>;
  signingIn: boolean;
  logout(): Promise<void>;
  paletteOpen: boolean;
  setPaletteOpen(open: boolean): void;
  toasts: Toast[];
  notify(message: string, tone?: Toast['tone']): void;
  dismissToast(id: number): void;
  /** True between a successful sign-in and the sign-out, even while the line reconnects. */
  sessionOpen: boolean;
  /** Journal entry written for the call currently in wrap-up, if any. */
  wrapUpRecordId: string | null;
  simulateIncoming(): void;
  selectedContactId: string | null;
  openContact(id: string | null): void;
  /** « Contacts » showing favourites only; set from the palette or the narrow-screen shortcut. */
  favoritesOnly: boolean;
  setFavoritesOnly(value: boolean): void;
  /** State of the recordings access opened with the line's own credentials. */
  recordingsAccess: RecordingsAccess;
  /** Tries again with the credentials of the current line (kept in memory only). */
  reopenRecordings(): Promise<void>;
}

export type { RecordingsAccess } from '../features/auth/workspace';

const AppContext = createContext<AppValue | null>(null);

// One controller for the whole page life: it must survive every view change.
// `live` needs the public connection settings; anything else is the demonstration, which never touches the network.
const sipConfig = sipConfigFromEnv(import.meta.env, window.parent !== window);
const demoPhone = sipConfig ? null : new DemoPhoneController();
const phone: PhoneController = demoPhone ?? new CallWaitingPhoneController(sipConfig!, browserSipEnvironment);
const apiBase = String(import.meta.env.VITE_RECORDINGS_URL ?? '/api').replace(/\/$/, '');
const store = new DataStore(demoPhone ? (typeof indexedDB === 'undefined' ? undefined : indexedDbPersistence) : new ServerPersistence(apiBase));
// Same origin by default (`/api` behind the site's reverse proxy); the demonstration never calls the network.
const recordings: RecordingsSource = demoPhone ? new DemoRecordingsSource() : new HttpRecordingsSource(apiBase);
// Read straight from the PBX's public page: its origin is allowed by the site's connection policy.
const announcements: AnnouncementsSource = demoPhone ? new DemoAnnouncementsSource() : new HttpAnnouncementsSource(announcementsUrlFromEnv(import.meta.env));

export function AppProvider({ children, embedded = false, recordCalls = true }: { children: ReactNode; embedded?: boolean; recordCalls?: boolean }) {
  useEffect(() => bindPageLifecycle(phone), []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (store.server && store.getSyncSnapshot() !== 'saved') { event.preventDefault(); event.returnValue = ''; }
    };
    const retry = () => { if (store.server && store.getSyncSnapshot() === 'error') void store.retrySave().catch(() => undefined); };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('online', retry);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('online', retry); };
  }, []);
  const [view, setView] = useState<View>(embedded ? 'phone' : 'journal');
  const [dial, setDial] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [wrapUpRecordId, setWrapUpRecordId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [recordingsAccess, setRecordingsAccess] = useState<RecordingsAccess>({ state: 'idle' });
  // The line's credentials, in memory for this session only: the recordings access reuses them, nothing else.
  const lineCredentials = useRef<Credentials | null>(null);
  const recorded = useRef(new Map<string, string>());
  const toastId = useRef(0);
  const incomingIndex = useRef(0);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastId.current;
    setToasts(current => [...current.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts(current => current.filter(toast => toast.id !== id)), []);

  // The journal only holds calls this browser really observed, written once when they end.
  useEffect(() => phone.subscribe(() => {
    if (!recordCalls) return;
    const snapshot = phone.getSnapshot();
    for (const call of snapshot.completedCalls ?? [snapshot.call]) {
      if (!call || call.phase !== 'ended' || recorded.current.has(call.id) || !call.outcome || !call.endedAt) continue;
      // Store notifications can synchronously rebuild the phone snapshot. Reserve first.
      recorded.current.set(call.id, '');
      const record = store.addCall({
        direction: call.direction, dialTarget: call.dialTarget, remoteName: call.remoteName,
        ...(call.direction === 'inbound' ? { receivedNumber: call.rawInput } : {}),
        startedAt: call.startedAt, answeredAt: call.answeredAt, endedAt: call.endedAt, outcome: call.outcome, failure: call.failure,
      });
      recorded.current.set(call.id, record.id);
      if (call.outcome === 'answered' && store.completeCallbacksFor(call.dialTarget)) notify(t('callbacks.doneToast'), 'success');
    }
    setWrapUpRecordId(snapshot.call?.phase === 'ended' ? recorded.current.get(snapshot.call.id) ?? null : null);
  }), [notify, recordCalls]);

  // Problems reported by the line (microphone refused, hold rejected…) are said once, in plain words.
  const lastError = useRef<string | undefined>(undefined);
  useEffect(() => phone.subscribe(() => {
    const { error, connection } = phone.getSnapshot();
    if (error && error !== lastError.current && connection === 'ready') notify(error, 'danger');
    lastError.current = error;
  }), [notify]);

  // Listening volume and devices follow the settings; the microphone stays at 100 %.
  useEffect(() => {
    let previous = store.getSnapshot().preferences;
    const apply = (initial: boolean) => {
      const next = store.getSnapshot().preferences;
      phone.applyAudio({ volume: next.volume, micGain: next.micGain, ringtone: next.ringtone, ringtoneSound: next.ringtoneSound, echoCancellation: next.echoCancellation, noiseSuppression: next.noiseSuppression });
      if (initial || next.inputDevice !== previous.inputDevice) void phone.setInputDevice(next.inputDevice);
      if (initial || next.outputDevice !== previous.outputDevice) void phone.setOutputDevice(next.outputDevice);
      previous = next;
    };
    apply(true);
    return store.subscribe(() => apply(false));
  }, []);

  const placeCall = useCallback((rawInput: string) => {
    const input = parseDialInput(rawInput);
    const state = phone.getSnapshot();
    if (!input.valid) return notify(t(input.reason === 'empty' ? 'dial.empty' : 'dial.invalid'), 'danger');
    if (state.connection !== 'ready') return notify(t('dial.notConnected'), 'danger');
    // A finished call still showing its wrap-up card is not « busy »: calling from the journal,
    // a contact or a callback closes the card, as « Terminer » would. Tags and notes are already saved.
    if (state.call?.phase === 'ended') phone.dismiss();
    else if (state.call) return notify(t('dial.busy'), 'danger');
    const contact = findContact(store.getSnapshot().contacts, input.dialTarget);
    phone.call(rawInput, input.dialTarget, contact?.name);
    setDial('');
  }, [notify]);

  const reopenRecordings = useCallback(async () => {
    const credentials = lineCredentials.current;
    if (!credentials) return;
    setRecordingsAccess({ state: 'opening' });
    try {
      await recordings.openWithLine(credentials.username, credentials.password);
      setRecordingsAccess({ state: 'open' });
    } catch (error) {
      setRecordingsAccess({ state: 'failed', message: error instanceof Error ? error.message : t('rec.unreachable') });
    }
  }, []);

  const signIn = useMemo(() => createLineLogin(phone, async (credentials, profile) => {
    if (demoPhone) {
      await store.open(profile, false, demoSeed());
      store.setPreferences({ theme: storedTheme() });
    } else {
      setRecordingsAccess({ state: 'opening' });
      setRecordingsAccess(await openLiveWorkspace(store, recordings, credentials, profile, isEmbeddedSession()));
      store.setPreferences({ notifications: notificationsEnabled() });
    }
    applyTheme(store.getSnapshot().preferences.theme);
    const savedLanguage = store.getSnapshot().preferences.language;
    if (savedLanguage) setLanguage(savedLanguage);
    else store.setPreferences({ language: language() });
  }, async credentials => {
    if (!demoPhone && isEmbeddedSession()) await recordings.openWithLine(credentials.username, credentials.password);
  }), []);

  const loginAttempt = useRef<Promise<boolean> | null>(null);
  const login = useCallback((credentials: Credentials): Promise<boolean> => {
    if (loginAttempt.current) return loginAttempt.current;
    setSigningIn(true);
    loginAttempt.current = (async () => {
      try {
        if (!await signIn(credentials)) {
          if (isEmbeddedSession()) await recordings.signOut();
          return false;
        }
        lineCredentials.current = { ...credentials, username: credentials.username.trim() };
        setSessionOpen(true);
        if (demoPhone) void reopenRecordings();
        return true;
      } catch (error) {
        await phone.disconnect();
        store.close();
        lineCredentials.current = null;
        setRecordingsAccess({ state: 'idle' });
        await recordings.signOut();
        throw error;
      } finally { setSigningIn(false); loginAttempt.current = null; }
    })();
    return loginAttempt.current;
  }, [signIn, reopenRecordings]);

  // The line gave up (network lost for good, registration refused): back to sign-in, data kept for the same account.
  useEffect(() => phone.subscribe(() => { if (!phone.getSnapshot().account) setSessionOpen(false); }), []);

  // An incoming call brings the phone forward, whatever was on screen.
  const ringing = useRef<string | null>(null);
  useEffect(() => phone.subscribe(() => {
    const snapshot = phone.getSnapshot();
    const call = snapshot.otherCall?.phase === 'ringing-in' ? snapshot.otherCall : snapshot.call;
    if (call?.phase === 'ringing-in' && ringing.current !== call.id) { ringing.current = call.id; setView('phone'); }
  }), []);

  const logout = useCallback(async () => {
    try { await store.flush(); }
    catch {
      if (!window.confirm(t('settings.unsavedLogout'))) return;
    }
    setSessionOpen(false);
    // An explicit sign-out must not be undone by the browser signing back in on the next reload.
    if (!embedded) void forgetSilentAccess();
    await phone.disconnect();
    store.close();
    recorded.current.clear();
    setView(embedded ? 'phone' : 'journal');
    setDial('');
    setSelectedContactId(null);
    setFavoritesOnly(false);
    lineCredentials.current = null;
    setRecordingsAccess({ state: 'idle' });
    // The recordings session belongs to the person, not to the browser left open.
    void recordings.signOut();
  }, [embedded]);

  const simulateIncoming = useCallback(() => {
    const caller = DEMO_CALLERS[incomingIndex.current++ % DEMO_CALLERS.length]!;
    const contact = findContact(store.getSnapshot().contacts, caller[0]);
    if (demoPhone && !demoPhone.simulateIncoming(caller[0], contact?.name)) notify(t('demo.finishCallFirst'), 'danger');
  }, [notify]);

  const openContact = useCallback((id: string | null) => {
    setSelectedContactId(id);
    if (id) setView('contacts');
  }, []);

  const value = useMemo<AppValue>(() => ({
    phone, store, recordings, announcements, view, setView, dial, setDial, placeCall, login, signingIn, logout, paletteOpen, setPaletteOpen,
    toasts, notify, dismissToast, sessionOpen, wrapUpRecordId, simulateIncoming, selectedContactId, openContact, favoritesOnly, setFavoritesOnly, recordingsAccess, reopenRecordings,
  }), [view, dial, placeCall, login, signingIn, logout, paletteOpen, toasts, notify, dismissToast, sessionOpen, wrapUpRecordId, simulateIncoming, selectedContactId, openContact, favoritesOnly, recordingsAccess, reopenRecordings]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider is missing');
  return value;
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePhone = () => useSyncExternalStore(phone.subscribe, phone.getSnapshot);
// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => useSyncExternalStore(store.subscribe, store.getSnapshot);
