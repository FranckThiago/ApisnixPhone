import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { parseDialInput } from '../domain/numbers';
import { DataStore, findContact } from '../storage/DataStore';
import { indexedDbPersistence, persistChoice } from '../storage/persistence';
import { chime } from '../telephony/audio';
import { DemoPhoneController } from '../telephony/DemoPhoneController';
import { DEMO_CALLERS, demoSeed } from '../telephony/demoSeed';
import { SipPhoneController } from '../telephony/SipPhoneController';
import { browserSipEnvironment, sipConfigFromEnv } from '../telephony/sipEnvironment';
import type { Credentials, PhoneController } from '../telephony/types';
import { forgetSilentAccess } from '../features/auth/credentials';
import { storedTheme } from './theme';

export type View = 'journal' | 'contacts' | 'favorites' | 'callbacks' | 'settings' | 'phone';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'danger';
}

interface AppValue {
  phone: PhoneController;
  store: DataStore;
  view: View;
  setView(view: View): void;
  dial: string;
  setDial(value: string): void;
  placeCall(rawInput: string): void;
  /** Resolves to true once the line is registered and the session is open. */
  login(credentials: Credentials): Promise<boolean>;
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
}

const AppContext = createContext<AppValue | null>(null);

// One controller for the whole page life: it must survive every view change.
// `live` needs the public connection settings; anything else is the demonstration, which never touches the network.
const sipConfig = sipConfigFromEnv(import.meta.env);
const demoPhone = sipConfig ? null : new DemoPhoneController();
const phone: PhoneController = demoPhone ?? new SipPhoneController(sipConfig!, browserSipEnvironment);
const store = new DataStore(typeof indexedDB === 'undefined' ? undefined : indexedDbPersistence);

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>('journal');
  const [dial, setDial] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [wrapUpRecordId, setWrapUpRecordId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
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
      startedAt: call.startedAt, answeredAt: call.answeredAt, endedAt: call.endedAt, outcome: call.outcome,
    });
    setWrapUpRecordId(record.id);
    // Reaching the person fulfils the callbacks promised for that number.
    if (call.outcome === 'answered' && store.completeCallbacksFor(call.dialTarget)) notify('Rappel effectué : il a été marqué comme fait.', 'success');
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
    if (lineSounds && (isReady || phone.getSnapshot().connection === 'reconnecting')) chime(isReady ? 'ready' : 'lost', volume / 100);
    wasReady.current = isReady;
  }), []);

  // Volume, microphone sensitivity and devices follow the settings live, even during a call.
  useEffect(() => {
    let previous = store.getSnapshot().preferences;
    const apply = (initial: boolean) => {
      const next = store.getSnapshot().preferences;
      phone.applyAudio({ volume: next.volume, micGain: next.micGain, ringtone: next.ringtone, echoCancellation: next.echoCancellation, noiseSuppression: next.noiseSuppression });
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
    if (!input.valid) return notify(input.reason === 'empty' ? 'Saisissez un numéro à appeler.' : 'Ce numéro contient des caractères non autorisés.', 'danger');
    if (state.connection !== 'ready') return notify('La ligne n’est pas connectée.', 'danger');
    if (state.call) return notify('Un appel est déjà en cours.', 'danger');
    const contact = findContact(store.getSnapshot().contacts, input.dialTarget);
    phone.call(rawInput, input.dialTarget, contact?.name);
    setDial('');
  }, [notify]);

  const login = useCallback(async (credentials: Credentials) => {
    await phone.connect(credentials);
    // The real line answers in two steps: the socket opens, then the PBX accepts the registration.
    // Wait for the final word, otherwise the first click leaves the person on the sign-in screen.
    await new Promise<void>(resolve => {
      const settled = () => !['connecting', 'registering'].includes(phone.getSnapshot().connection);
      if (settled()) return resolve();
      const stop = phone.subscribe(() => { if (settled()) { stop(); resolve(); } });
    });
    const { account, connection } = phone.getSnapshot();
    if (connection !== 'ready' || !account) return false;
    const profile = `${account.domain}:${account.username}`;
    await store.open(profile, persistChoice.get(profile), demoPhone ? demoSeed() : undefined);
    store.setPreferences({ theme: storedTheme() });
    setSessionOpen(true);
    return true;
  }, []);

  // The line gave up (network lost for good, registration refused): back to sign-in, data kept for the same account.
  useEffect(() => phone.subscribe(() => { if (!phone.getSnapshot().account) setSessionOpen(false); }), []);

  // An incoming call brings the phone forward, whatever was on screen.
  const ringing = useRef<string | null>(null);
  useEffect(() => phone.subscribe(() => {
    const call = phone.getSnapshot().call;
    if (call?.phase === 'ringing-in' && ringing.current !== call.id) { ringing.current = call.id; setView('phone'); }
  }), []);

  const logout = useCallback(async () => {
    setSessionOpen(false);
    // An explicit sign-out must not be undone by the browser signing back in on the next reload.
    void forgetSilentAccess();
    await phone.disconnect();
    store.close();
    recorded.current.clear();
    setView('journal');
    setDial('');
    setSelectedContactId(null);
  }, []);

  const simulateIncoming = useCallback(() => {
    const caller = DEMO_CALLERS[incomingIndex.current++ % DEMO_CALLERS.length]!;
    const contact = findContact(store.getSnapshot().contacts, caller[0]);
    if (demoPhone && !demoPhone.simulateIncoming(caller[0], contact?.name)) notify('Terminez l’appel en cours avant d’en simuler un autre.', 'danger');
  }, [notify]);

  const openContact = useCallback((id: string | null) => {
    setSelectedContactId(id);
    if (id) setView('contacts');
  }, []);

  const value = useMemo<AppValue>(() => ({
    phone, store, view, setView, dial, setDial, placeCall, login, logout, paletteOpen, setPaletteOpen,
    toasts, notify, dismissToast, sessionOpen, wrapUpRecordId, simulateIncoming, selectedContactId, openContact,
  }), [view, dial, placeCall, login, logout, paletteOpen, toasts, notify, dismissToast, sessionOpen, wrapUpRecordId, simulateIncoming, selectedContactId, openContact]);

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
