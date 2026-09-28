import { Mic, RotateCcw, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { MAX_VOLUME } from '../../domain/types';
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

const ACCESS_HINTS: Record<MicAccess, string> = {
  granted: 'Autorisé pour ce site.',
  prompt: 'Pas encore autorisé : le navigateur vous le demandera.',
  denied: 'Bloqué : le navigateur a retenu un refus et ne vous le redemande plus de lui-même.',
  unknown: 'Refusé par erreur ? Redemandez l’autorisation ici.',
};

/**
 * Asks the browser for the microphone again, for someone who refused it by mistake. Once a refusal
 * is remembered, no page can make the browser ask again: the steps to lift it are shown instead.
 */
function MicPermission({ demo, onAllowed }: { demo: boolean; onAllowed(): void }) {
  const { notify } = useApp();
  const [access, setAccess] = useMicAccess(!demo);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState('');

  const ask = async () => {
    // The demo never asks the browser for a permission.
    if (demo) return notify('Démonstration : aucune permission demandée.');
    if (!navigator.mediaDevices?.getUserMedia) return setProblem('Ce navigateur ne donne pas accès au micro sur cette page.');
    setAsking(true);
    setProblem('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // Only the permission was wanted: nothing keeps listening.
      stream.getTracks().forEach(track => track.stop());
      setAccess('granted');
      onAllowed();
      notify('Micro autorisé.');
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
      <div className="setting mic-access"><span><b>Autorisation du micro</b><small>{problem || (demo ? 'Démonstration : aucune autorisation n’est demandée.' : ACCESS_HINTS[access])}</small></span>
        {access === 'granted'
          ? <span className="pill pill-ok"><i />Autorisé</span>
          : <button type="button" className="ghost" disabled={asking} onClick={() => void ask()}>
              {access === 'denied' ? <><RotateCcw size={15} /> Réessayer</> : <><Mic size={15} /> Autoriser le micro</>}</button>}</div>
      {access === 'denied' && (
        <ol className="callout mic-help">
          <li>Cliquez sur l’icône à gauche de l’adresse <b>{location.host}</b> (cadenas, réglages ou micro barré).</li>
          <li>Mettez <b>Microphone</b> sur <b>Autoriser</b>. Sur Safari : menu Safari → Réglages pour ce site web → Microphone.</li>
          <li>Revenez ici : l’autorisation est reconnue, sinon cliquez sur <b>Réessayer</b>. En dernier recours, actualisez la page hors appel.</li>
        </ol>
      )}
    </>
  );
}

/** Opens the microphone only while the test runs, and always releases it. */
function MicTest({ onAllowed }: { onAllowed(): void }) {
  const { preferences } = useData();
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
      <button type="button" className="ghost" onClick={running ? stop : () => void start()}>{running ? <><Square size={15} /> Arrêter le test</> : <><Mic size={16} /> Tester le micro</>}</button>
      <div className={'meter' + (level > 0.92 ? ' clipping' : '')} role="meter" aria-label="Niveau du micro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
        <i style={{ width: `${Math.round(level * 100)}%` }} /></div>
      <small>{error || (running ? (level > 0.92 ? 'Trop fort : baissez la sensibilité.' : 'Parlez normalement : la barre doit rester dans la zone verte.') : 'Le micro n’est écouté que pendant le test.')}</small>
    </div>
  );
}

export function AudioSettings() {
  const { store } = useApp();
  const { preferences } = useData();
  const { demo } = usePhone();
  const [devices, refreshDevices] = useDevices(!demo);
  const set = store.setPreferences.bind(store);
  const sinkSupported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

  return (
    <>
      {demo && <p className="callout">Démonstration : aucun microphone n’est demandé. Les réglages ci-dessous s’appliqueront à votre ligne réelle.</p>}
      <MicPermission demo={demo} onAllowed={refreshDevices} />
      <label className="setting"><span><b>Microphone</b><small>{devices.inputs.length ? 'Pris en compte à l’appel suivant.' : 'Micro du système. La liste apparaît après un premier test autorisé.'}</small></span>
        <select value={preferences.inputDevice} onChange={event => set({ inputDevice: event.target.value })}>
          <option value="default">Micro du système</option>
          {devices.inputs.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select></label>
      <label className="setting"><span><b>Sensibilité du micro</b><small>{preferences.micGain} % — {preferences.micGain === 100 ? 'niveau d’origine' : preferences.micGain > 100 ? 'on vous entend plus fort' : 'on vous entend moins fort'}. À 100 %, votre micro est transmis tel quel. Un changement fait pendant un appel s’applique à l’appel suivant.</small></span>
        <input type="range" min={0} max={200} step={5} value={preferences.micGain} aria-label="Sensibilité du micro" onChange={event => set({ micGain: Number(event.target.value) })} /></label>
      {!demo && <MicTest onAllowed={refreshDevices} />}
      <label className="setting"><span><b>Casque / sortie</b><small>{sinkSupported ? 'Sortie du système par défaut.' : 'Ce navigateur ne permet pas de choisir : la sortie du système est utilisée.'}</small></span>
        <select value={preferences.outputDevice} disabled={!sinkSupported} onChange={event => set({ outputDevice: event.target.value })}>
          <option value="default">Sortie du système</option>
          {devices.outputs.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select></label>
      <label className="setting"><span><b>Volume d’écoute</b><small>{preferences.volume} % — {preferences.volume > 100 ? 'voix et sons amplifiés ; un casque évite l’écho chez votre correspondant' : 'distinct du volume de l’ordinateur'}. Jusqu’à {MAX_VOLUME} %.</small></span>
        <input type="range" min={0} max={MAX_VOLUME} step={5} value={preferences.volume} aria-label="Volume d’écoute" onChange={event => set({ volume: Number(event.target.value) })} /></label>
    </>
  );
}
