import { RotateCcw } from 'lucide-react';
import { useDevices } from './useDevices';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { useI18n } from '../../i18n';

/** Offer only real browser routes; never invent an earpiece or claim to force one. */
export function AudioOutput({ compact = false }: { compact?: boolean }) {
  const { store } = useApp();
  const { preferences } = useData();
  const { demo } = usePhone();
  const { t } = useI18n();
  const [devices, refresh] = useDevices(!demo);
  const supported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  const outputs = devices.outputs.filter(d => d.deviceId !== 'default');
  const system = devices.outputs.find(d => d.deviceId === 'default');
  const missing = preferences.outputDevice !== 'default' && !outputs.some(d => d.deviceId === preferences.outputDevice);
  return <div className={'audio-output' + (compact ? ' audio-output-compact' : '')}>
    <label className="setting"><span><b>{t('audio.output')}</b><small>{t(!supported ? 'audio.outputUnsupported' : outputs.length ? 'audio.outputChoice' : 'audio.outputUnavailable')}</small></span>
      <select value={preferences.outputDevice} disabled={!supported} onFocus={refresh}
        onChange={event => store.setPreferences({ outputDevice: event.target.value })}>
        <option value="default">{system?.label || t('audio.systemOutput')}</option>
        {missing && <option value={preferences.outputDevice} disabled>{t('audio.outputDisconnected')}</option>}
        {outputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || t('audio.outputNumber', { number: index + 1 })}</option>)}
      </select>
    </label>
    {supported && <button type="button" className="ghost-call" onClick={refresh}><RotateCcw size={14} />{t('audio.refreshOutputs')}</button>}
  </div>;
}
