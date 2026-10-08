import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { parseDialInput } from '../domain/numbers';
import { bindPageLifecycle } from '../telephony/pageLifecycle';
import { t, language, setLanguage } from '../i18n';
import { DataStore, findContact } from '../storage/DataStore';
import { indexedDbPersistence } from '../storage/persistence';
import { ServerPersistence } from '../storage/serverPersistence';
import { chime } from '../telephony/audio';
import { DemoPhoneController } from '../telephony/DemoPhoneController';
import { DEMO_CALLERS, demoSeed } from '../telephony/demoSeed';
import { SipPhoneController } from '../telephony/SipPhoneController';
import { browserSipEnvironment, sipConfigFromEnv } from '../telephony/sipEnvironment';
import type { Credentials, PhoneController } from '../telephony/types';
import { createLineLogin } from '../features/auth/lineLogin';
import { openLiveWorkspace, type RecordingsAccess } from '../features/auth/workspace';
import { forgetSilentAccess } from '../features/auth/credentials';
import { DemoRecordingsSource, HttpRecordingsSource } from '../recordings/client';
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
const sipConfig = sipConfigFromEnv(import.meta.env);
const demoPhone = sipConfig ? null : new DemoPhoneController();
const phone: PhoneController = demoPhone ?? new SipPhoneController(sipConfig!, browserSipEnvironment);
const apiBase = String(import.meta.env.VITE_RECORDINGS_URL ?? '/api').replace(/\/$/, '');
const store = new DataStore(demoPhone ? (typeof indexedDB === 'undefined' ? undefined : indexedDbPersistence) : new ServerPersistence(apiBase));
// Same origin by default (`/api` behind the site's reverse proxy); the demonstration never calls the network.
const recordings: RecordingsSource = demoPhone ? new DemoRecordingsSource() : new HttpRecordingsSource(apiBase);

export function AppProvider({ children }: { children: ReactNode }) {
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
  const [view, setView] = useState<View>('journal');
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
  const recorded = useRef(new Set<string>());
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
    const call = phone.getSnapshot().call;
    if (!call) return setWrapUpRecordId(null);
    if (call.phase !== 'ended' || recorded.current.has(call.id) || !call.outcome || !call.endedAt) return;
    recorded.current.add(call.id);
    const record = store.addCall({
      direction: call.direction, dialTarget: call.dialTarget, remoteName: call.remoteName,
      ...(call.direction === 'inbound' ? { receivedNumber: call.rawInput } : {}),
      startedAt: call.startedAt, answeredAt: call.answeredAt, endedAt: call.endedAt, outcome: call.outcome, failure: call.failure,
    });
    setWrapUpRecordId(record.id);
    // Reaching the person fulfils the callbacks promised for that number.
    if (call.outcome === 'answered' && store.completeCallbacksFor(call.dialTarget)) notify(t('callbacks.doneToast'), 'success');
  }), [notify]);

  // Problems reported by the line (microphone refused, hold rejected…) are said once, in plain words.
  const lastError = useRef<string | undefined>(undefined);
  useEffect(() => phone.subscribe(() => {
    const { error, connection } = phone.getSnapshot();
    if (error && error !== lastError.current && connection === 'ready') notify(error, 'danger');
    lastError.current = error;
  }), [notify]);

  // Hearing that the line is ready (or lost) spares a look at the screen, as agents are used to.
  const wasReady = useRef(false);
  useEffect(() => phone.subscribe(() => {
    const isReady = phone.getSnapshot().connection === 'ready';
    if (isReady === wasReady.current) return;
    const { lineSounds, volume } = store.getSnapshot().preferences;
    // Signing out on purpose is silent; only a line that drops by itself is announced.
    if (sessionOpen && lineSounds && (isReady || phone.getSnapshot().connection === 'reconnecting')) chime(isReady ? 'ready' : 'lost', volume / 100);
    wasReady.current = isReady;
  }), [sessionOpen]);

  // Volume, microphone sensitivity and devices follow the settings live, even during a call.
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
      setRecordingsAccess(await openLiveWorkspace(store, recordings, credentials, profile));
    }
    applyTheme(store.getSnapshot().preferences.theme);
    const savedLanguage = store.getSnapshot().preferences.language;
    if (savedLanguage) setLanguage(savedLanguage);
    else store.setPreferences({ language: language() });
  }), []);

  const loginAttempt = useRef<Promise<boolean> | null>(null);
  const login = useCallback((credentials: Credentials): Promise<boolean> => {
    if (loginAttempt.current) return loginAttempt.current;
    setSigningIn(true);
    loginAttempt.current = (async () => {
      try {
        if (!await signIn(credentials)) return false;
        lineCredentials.current = { ...credentials, username: credentials.username.trim() };
        setSessionOpen(true);
        const { lineSounds, volume } = store.getSnapshot().preferences;
        if (lineSounds) chime('ready', volume / 100);
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
    const call = phone.getSnapshot().call;
    if (call?.phase === 'ringing-in' && ringing.current !== call.id) { ringing.current = call.id; setView('phone'); }
  }), []);

  const logout = useCallback(async () => {
    try { await store.flush(); }
    catch {
      if (!window.confirm(t('settings.unsavedLogout'))) return;
    }
    setSessionOpen(false);
    // An explicit sign-out must not be undone by the browser signing back in on the next reload.
    void forgetSilentAccess();
    await phone.disconnect();
    store.close();
    recorded.current.clear();
    setView('journal');
    setDial('');
    setSelectedContactId(null);
    setFavoritesOnly(false);
    lineCredentials.current = null;
    setRecordingsAccess({ state: 'idle' });
    // The recordings session belongs to the person, not to the browser left open.
    void recordings.signOut();
  }, []);

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
    phone, store, recordings, view, setView, dial, setDial, placeCall, login, signingIn, logout, paletteOpen, setPaletteOpen,
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
