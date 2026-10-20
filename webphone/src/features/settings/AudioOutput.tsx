import { Check, Headphones, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useDevices } from './useDevices';
import { useApp, useData, usePhone } from '../../app/AppContext';
import { useI18n } from '../../i18n';

/** Offer only real browser routes; never invent an earpiece or claim to force one. */
function useOutputs() {
  const { store } = useApp();
  const { preferences } = useData();
  const { demo } = usePhone();
  const [devices, refresh] = useDevices(!demo);
  const supported = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  const outputs = devices.outputs.filter(d => d.deviceId !== 'default');
  const system = devices.outputs.find(d => d.deviceId === 'default');
  const selected = preferences.outputDevice;
  const missing = selected !== 'default' && !outputs.some(d => d.deviceId === selected);
  const select = (outputDevice: string) => store.setPreferences({ outputDevice });
  return { supported, outputs, system, selected, missing, select, refresh };
}

export function AudioOutput() {
  const { supported, outputs, system, selected, missing, select, refresh } = useOutputs();
  const { t } = useI18n();
  return <div className="audio-output">
    <label className="setting"><span><b>{t('audio.output')}</b><small>{t(!supported ? 'audio.outputUnsupported' : outputs.length ? 'audio.outputChoice' : 'audio.outputUnavailable')}</small></span>
      <select value={selected} disabled={!supported} onFocus={refresh} onChange={event => select(event.target.value)}>
        <option value="default">{system?.label || t('audio.systemOutput')}</option>
        {missing && <option value={selected} disabled>{t('audio.outputDisconnected')}</option>}
        {outputs.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || t('audio.outputNumber', { number: index + 1 })}</option>)}
      </select>
    </label>
    {supported && <button type="button" className="ghost-call" onClick={refresh}><RotateCcw size={14} />{t('audio.refreshOutputs')}</button>}
  </div>;
}

/** During a call, a single icon like the iPhone audio route button; the routes open in a small menu. */
export function AudioOutputMenu() {
  const { supported, outputs, system, selected, missing, select, refresh } = useOutputs();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const choose = (deviceId: string) => { select(deviceId); setOpen(false); };
  const item = (deviceId: string, label: string, disabled = false) =>
    <button key={deviceId} type="button" role="menuitemradio" aria-checked={selected === deviceId} disabled={disabled} onClick={() => choose(deviceId)}>
      <span>{label}</span>{selected === deviceId && <Check size={15} />}
    </button>;
  return <div className="output-menu" ref={root}>
    <button type="button" className={'output-toggle' + (open ? ' on' : '')} aria-haspopup="menu" aria-expanded={open}
      aria-label={t('audio.output')} title={t('audio.output')} onClick={() => { if (!open) refresh(); setOpen(!open); }}>
      <Headphones size={17} />
    </button>
    {open && <div className="output-list" role="menu" aria-label={t('audio.output')}>
      {supported ? <>
        {item('default', system?.label || t('audio.systemOutput'))}
        {missing && item(selected, t('audio.outputDisconnected'), true)}
        {outputs.map((device, index) => item(device.deviceId, device.label || t('audio.outputNumber', { number: index + 1 })))}
        {!outputs.length && <small>{t('audio.outputUnavailable')}</small>}
        <hr />
        <button type="button" role="menuitem" onClick={refresh}><span>{t('audio.refreshOutputs')}</span><RotateCcw size={14} /></button>
      </> : <small>{t('audio.outputUnsupported')}</small>}
    </div>}
  </div>;
}
