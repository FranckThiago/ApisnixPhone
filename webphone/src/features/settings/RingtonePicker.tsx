import { Play, Square, Volume1, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp, useData } from '../../app/AppContext';
import { previewRingtone } from '../../telephony/audio';
import { findRingtone, RINGTONES } from '../../telephony/ringtones';
import { useI18n, type MessageKey } from '../../i18n';

const GROUPS: Array<{ loud: boolean; title: MessageKey; hint: MessageKey; icon: ReactNode }> = [
  { loud: false, title: 'ringtones.calm', hint: 'ringtones.calmHint', icon: <Volume1 size={15} /> },
  { loud: true, title: 'ringtones.loud', hint: 'ringtones.loudHint', icon: <Volume2 size={15} /> },
];

/** Choosing a ringtone plays it, as on a mobile phone; the play button only listens. */
export function RingtonePicker() {
  const { store } = useApp();
  const { preferences } = useData();
  const { t } = useI18n();
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
    <fieldset className="ringtones" disabled={!preferences.ringtone} aria-label={t('ringtones.label')}>
      {GROUPS.map(group => (
        <div key={group.title} className="ringtone-group" role="radiogroup" aria-label={t('ringtones.group', { group: t(group.title).toLowerCase() })}>
          <p>{group.icon}<b>{t(group.title)}</b><small>{t(group.hint)}</small></p>
          <div className="ringtone-grid">
            {RINGTONES.filter(ringtone => ringtone.loud === group.loud).map(ringtone => (
              <div key={ringtone.id} className={'ringtone' + (selected === ringtone.id ? ' selected' : '')}>
                <label>
                  <input type="radio" name="ringtone" value={ringtone.id} checked={selected === ringtone.id}
                    onChange={() => { store.setPreferences({ ringtoneSound: ringtone.id }); listen(ringtone.id); }} />
                  <span><b>{t(ringtone.label)}</b><small>{t(ringtone.hint)}</small></span>
                </label>
                <button type="button" className={'icon-button' + (playing === ringtone.id ? ' playing' : '')}
                  aria-label={t(playing === ringtone.id ? 'ringtones.stop' : 'ringtones.listen', { name: t(ringtone.label) })}
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
