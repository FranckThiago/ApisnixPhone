import { Mic, RotateCcw, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { MAX_VOLUME } from '../../domain/types';
import { rich, useI18n, type MessageKey } from '../../i18n';
import { MicPipeline, microphoneErrorMessage } from '../../telephony/audio';

interface Devices { inputs: MediaDeviceInfo[]; outputs: MediaDeviceInfo[] }

function useDevices(enabled: boolean): [Devices, () => void] {
  const [devices, setDevices] = useState<Devices>({ inputs: [], outputs: [] });
  const refresh = useRef(() => undefined as void);
  useEffect(() => {
    if (!enabled || !navigator.mediaDevices?.enumerateDevices) return;
    let alive = true;
    const read = () => void navigator.mediaDevices.enumerateDevices().then(all => {
      // Labels stay empty until the microphone was allowed once; unnamed entries are not offered.
      if (alive) setDevices({ inputs: all.filter(d => d.kind === 'audioinput' && d.label && d.deviceId !== 'default'),
                              outputs: all.filter(d => d.kind === 'audiooutput' && d.label && d.deviceId !== 'default') });
    }).catch(() => undefined);
    refresh.current = read;
    read();
    // A headset plugged in or removed shows up without reloading.
    navigator.mediaDevices.addEventListener('devicechange', read);
    return () => { alive = false; navigator.mediaDevices.removeEventListener('devicechange', read); };
  }, [enabled]);
  return [devices, useCallback(() => refresh.current(), [])];
}

type MicAccess = PermissionState | 'unknown';

/** What the browser allows right now; follows a change made from the address bar, without reloading. */
function useMicAccess(enabled: boolean): [MicAccess, (access: MicAccess) => void] {
  const [access, setAccess] = useState<MicAccess>('unknown');
  useEffect(() => {
    if (!enabled || !navigator.permissions?.query) return;
    let alive = true;
    let status: PermissionStatus | undefined;
    const read = () => { if (alive && status) setAccess(status.state); };
    // Some browsers cannot tell for the microphone: the button still asks.
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
      status = result;
      read();
      result.addEventListener('change', read);
    }).catch(() => undefined);
    return () => { alive = false; status?.removeEventListener('change', read); };
  }, [enabled]);
  return [access, setAccess];
}

const ACCESS_HINTS: Record<MicAccess, MessageKey> = { granted: 'mic.granted', prompt: 'mic.prompt', denied: 'mic.denied', unknown: 'mic.unknown' };

/**
 * Asks the browser for the microphone again, for someone who refused it by mistake. Once a refusal
 * is remembered, no page can make the browser ask again: the steps to lift it are shown instead.
 */
function MicPermission({ demo, onAllowed }: { demo: boolean; onAllowed(): void }) {
  const { notify } = useApp();
  const { t } = useI18n();
  const [access, setAccess] = useMicAccess(!demo);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState('');

  const ask = async () => {
    // The demo never asks the browser for a permission.
    if (demo) return notify(t('settings.demoNoPermission'));
    if (!navigator.mediaDevices?.getUserMedia) return setProblem(t('mic.noAccess'));
    setAsking(true);
    setProblem('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Only the permission was wanted: nothing keeps listening.
      stream.getTracks().forEach(track => track.stop());
      setAccess('granted');
      onAllowed();
      notify(t('mic.allowedToast'));
    } catch (failure) {
      const name = failure instanceof DOMException ? failure.name : '';
      if (name === 'NotAllowedError' || name === 'SecurityError') setAccess('denied');
      else setProblem(microphoneErrorMessage(failure));
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      <div className="setting mic-access"><span><b>{t('mic.permission')}</b><small>{problem || t(demo ? 'mic.demoNoAsk' : ACCESS_HINTS[access])}</small></span>
        {access === 'granted'
          ? <span className="pill pill-ok"><i />{t('mic.allowed')}</span>
          : <button type="button" className="ghost" disabled={asking} onClick={() => void ask()}>
              {access === 'denied' ? <><RotateCcw size={15} /> {t('action.retry')}</> : <><Mic size={15} /> {t('mic.allow')}</>}</button>}</div>
      {access === 'denied' && (
        <ol className="callout mic-help">
          <li>{rich('mic.help1', { host: <b>{location.host}</b> })}</li>
          <li>{rich('mic.help2', { microphone: <b>{t('mic.help2Microphone')}</b>, allow: <b>{t('mic.help2Allow')}</b> })}</li>
          <li>{rich('mic.help3', { retry: <b>{t('action.retry')}</b> })}</li>
        </ol>
      )}
    </>
  );
}

/** Opens the microphone only while the test runs, and always releases it. */
function MicTest({ onAllowed }: { onAllowed(): void }) {
  const { preferences } = useData();
  const { t } = useI18n();
  const [level, setLevel] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const pipeline = useRef<MicPipeline | null>(null);
  const frame = useRef(0);

  const stop = () => {
    cancelAnimationFrame(frame.current);
    pipeline.current?.close();
    pipeline.current = null;
    setRunning(false);
    setLevel(0);
  };
  useEffect(() => stop, []);
  useEffect(() => { pipeline.current?.setGain(preferences.micGain); }, [preferences.micGain]);

  const start = async () => {
    setError('');
    const mic = new MicPipeline({ deviceId: preferences.inputDevice, gain: preferences.micGain,
                                  echoCancellation: preferences.echoCancellation, noiseSuppression: preferences.noiseSuppression });
    try {
      await mic.open(true);
    } catch (failure) {
      mic.close();
      return setError(microphoneErrorMessage(failure));
    }
    pipeline.current = mic;
    setRunning(true);
    onAllowed();
    const meter = mic.createMeter();
    const tick = () => { if (meter) setLevel(meter()); frame.current = requestAnimationFrame(tick); };
    tick();
  };

  return (
    <div className="mic-test">
      <button type="button" className="ghost" onClick={running ? stop : () => void start()}>{running ? <><Square size={15} /> {t('mic.stopTest')}</> : <><Mic size={16} /> {t('mic.test')}</>}</button>
      <div className={'meter' + (level > 0.92 ? ' clipping' : '')} role="meter" aria-label={t('mic.level')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
        <i style={{ width: `${Math.round(level * 100)}%` }} /></div>
      <small>{error || t(running ? (level > 0.92 ? 'mic.tooLoud' : 'mic.speak') : 'mic.onlyDuringTest')}</small>
    </div>
  );
}

export function AudioSettings() {
  const { store } = useApp();
  const { preferences } = useData();
  const { demo } = usePhone();
  const { t } = useI18n();
  const [devices, refreshDevices] = useDevices(!demo);
  const set = store.setPreferences.bind(store);
  const sinkSupported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

  return (
    <>
      {demo && <p className="callout">{t('audio.demo')}</p>}
      <MicPermission demo={demo} onAllowed={refreshDevices} />
      <label className="setting"><span><b>{t('audio.microphone')}</b><small>{t(devices.inputs.length ? 'audio.nextCall' : 'audio.systemMicHint')}</small></span>
        <select value={preferences.inputDevice} onChange={event => set({ inputDevice: event.target.value })}>
          <option value="default">{t('audio.systemMic')}</option>
          {devices.inputs.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select></label>
      <label className="setting"><span><b>{t('audio.sensitivity')}</b><small>{t('audio.sensitivityHint', { value: preferences.micGain,
          state: t(preferences.micGain === 100 ? 'audio.gainOriginal' : preferences.micGain > 100 ? 'audio.gainLouder' : 'audio.gainSofter') })}</small></span>
        <input type="range" min={0} max={200} step={5} value={preferences.micGain} aria-label={t('audio.sensitivity')} onChange={event => set({ micGain: Number(event.target.value) })} /></label>
      {!demo && <MicTest onAllowed={refreshDevices} />}
      <label className="setting"><span><b>{t('audio.output')}</b><small>{t(sinkSupported ? 'audio.outputDefault' : 'audio.outputUnsupported')}</small></span>
        <select value={preferences.outputDevice} disabled={!sinkSupported} onChange={event => set({ outputDevice: event.target.value })}>
          <option value="default">{t('audio.systemOutput')}</option>
          {devices.outputs.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select></label>
      <label className="setting"><span><b>{t('volume.label')}</b><small>{t('audio.volumeHint', { value: preferences.volume, max: MAX_VOLUME,
          state: t(preferences.volume > 100 ? 'audio.volumeAmplified' : 'audio.volumeNormal') })}</small></span>
        <input type="range" min={0} max={MAX_VOLUME} step={5} value={preferences.volume} aria-label={t('volume.label')} onChange={event => set({ volume: Number(event.target.value) })} /></label>
    </>
  );
}
