import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp, useData, usePhone } from '../../app/AppContext';
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
  return [devices, () => refresh.current()];
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
      await mic.open();
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
      <label className="setting"><span><b>Microphone</b><small>{devices.inputs.length ? 'Changement possible même pendant un appel.' : 'Micro du système. La liste apparaît après un premier test autorisé.'}</small></span>
        <select value={preferences.inputDevice} onChange={event => set({ inputDevice: event.target.value })}>
          <option value="default">Micro du système</option>
          {devices.inputs.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select></label>
      <label className="setting"><span><b>Sensibilité du micro</b><small>{preferences.micGain} % — {preferences.micGain === 100 ? 'niveau d’origine' : preferences.micGain > 100 ? 'on vous entend plus fort' : 'on vous entend moins fort'}. Agit en direct pendant l’appel.</small></span>
        <input type="range" min={0} max={200} step={5} value={preferences.micGain} aria-label="Sensibilité du micro" onChange={event => set({ micGain: Number(event.target.value) })} /></label>
      {!demo && <MicTest onAllowed={refreshDevices} />}
      <label className="setting"><span><b>Casque / sortie</b><small>{sinkSupported ? 'Sortie du système par défaut.' : 'Ce navigateur ne permet pas de choisir : la sortie du système est utilisée.'}</small></span>
        <select value={preferences.outputDevice} disabled={!sinkSupported} onChange={event => set({ outputDevice: event.target.value })}>
          <option value="default">Sortie du système</option>
          {devices.outputs.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
        </select></label>
      <label className="setting"><span><b>Volume d’écoute</b><small>{preferences.volume} % — distinct du volume de l’ordinateur.</small></span>
        <input type="range" min={0} max={100} value={preferences.volume} aria-label="Volume d’écoute" onChange={event => set({ volume: Number(event.target.value) })} /></label>
    </>
  );
}
