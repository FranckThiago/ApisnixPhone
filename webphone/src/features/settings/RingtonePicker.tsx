import { Play, Square, Volume1, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp, useData } from '../../app/AppContext';
import { previewRingtone } from '../../telephony/audio';
import { findRingtone, RINGTONES } from '../../telephony/ringtones';

const GROUPS = [
  { loud: false, title: 'Calmes', hint: 'Bureau tranquille, casque sur les oreilles.', icon: <Volume1 size={15} /> },
  { loud: true, title: 'Bruyantes', hint: 'Open space, casque posé sur le bureau.', icon: <Volume2 size={15} /> },
];

/** Choosing a ringtone plays it, as on a mobile phone; the play button only listens. */
export function RingtonePicker() {
  const { store } = useApp();
  const { preferences } = useData();
  const [playing, setPlaying] = useState<string | null>(null);
  const stopPreview = useRef<(() => void) | null>(null);
  const selected = findRingtone(preferences.ringtoneSound).id;

  // Leaving the settings, or an incoming call opening the phone, silences the preview.
  useEffect(() => () => stopPreview.current?.(), []);

  const listen = (id: string) => {
    stopPreview.current?.();
    const stop = previewRingtone(id, preferences.volume / 100, () => {
      if (stopPreview.current !== stop) return;
      stopPreview.current = null;
      setPlaying(null);
    });
    stopPreview.current = stop;
    setPlaying(id);
  };

  return (
    <fieldset className="ringtones" disabled={!preferences.ringtone} aria-label="Choix de la sonnerie">
      {GROUPS.map(group => (
        <div key={group.title} className="ringtone-group" role="radiogroup" aria-label={`Sonneries ${group.title.toLowerCase()}`}>
          <p>{group.icon}<b>{group.title}</b><small>{group.hint}</small></p>
          <div className="ringtone-grid">
            {RINGTONES.filter(ringtone => ringtone.loud === group.loud).map(ringtone => (
              <div key={ringtone.id} className={'ringtone' + (selected === ringtone.id ? ' selected' : '')}>
                <label>
                  <input type="radio" name="ringtone" value={ringtone.id} checked={selected === ringtone.id}
                    onChange={() => { store.setPreferences({ ringtoneSound: ringtone.id }); listen(ringtone.id); }} />
                  <span><b>{ringtone.label}</b><small>{ringtone.hint}</small></span>
                </label>
                <button type="button" className={'icon-button' + (playing === ringtone.id ? ' playing' : '')}
                  aria-label={playing === ringtone.id ? `Arrêter ${ringtone.label}` : `Écouter ${ringtone.label}`}
                  onClick={() => playing === ringtone.id ? stopPreview.current?.() : listen(ringtone.id)}>
                  {playing === ringtone.id ? <Square size={14} /> : <Play size={15} />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </fieldset>
  );
}
