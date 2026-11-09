import { AudioLines, Pause, Play, Volume2, VolumeX, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatDuration } from '../../domain/format';
import { useI18n } from '../../i18n';

export function RecordingPlayer({ src, label, onClose, onError }: {
  src: string;
  label: string;
  onClose(): void;
  onError(): void;
}) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const toggle = () => {
    const media = audio.current;
    if (!media) return;
    if (media.paused) void media.play().catch(() => { /* Media errors are handled by the audio element. */ });
    else media.pause();
  };

  return (
    <section className="recording-player" aria-label={t('rec.playing', { label })}>
      <audio ref={audio} src={src} autoPlay preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={event => setPosition(event.currentTarget.currentTime)}
        onDurationChange={event => {
          const seconds = event.currentTarget.duration;
          setDuration(Number.isFinite(seconds) ? seconds : 0);
        }} onError={onError} />
      <div className="recording-player-title">
        <span className="recording-player-icon"><AudioLines size={19} aria-hidden="true" /></span>
        <div><small>{t('rec.playerTitle')}</small><strong title={label}>{label}</strong></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label={t('rec.closePlayer')}><X size={18} /></button>
      </div>
      <div className="recording-player-controls">
        <button className="recording-player-toggle" type="button" onClick={toggle}
          aria-label={t(playing ? 'rec.pause' : 'rec.listen')}>{playing ? <Pause size={17} /> : <Play size={17} />}</button>
        <span className="mono">{formatDuration(position)}</span>
        <input className="recording-player-position" type="range" min={0} max={duration || 1} step={0.1}
          value={Math.min(position, duration)} disabled={!duration}
          aria-label={t('rec.position')} aria-valuetext={formatDuration(position)} onChange={event => {
            const next = event.currentTarget.valueAsNumber;
            if (audio.current) audio.current.currentTime = next;
            setPosition(next);
          }} />
        <span className="mono">{duration ? formatDuration(duration) : '—'}</span>
        <select aria-label={t('rec.speed')} value={speed} onChange={event => {
          const rate = Number(event.currentTarget.value);
          if (audio.current) audio.current.playbackRate = rate;
          setSpeed(rate);
        }}>
          {[0.75, 1, 1.25, 1.5, 2].map(rate => <option value={rate} key={rate}>{rate}×</option>)}
        </select>
        <div className="recording-player-volume">
          <button type="button" className="icon-button" aria-label={t('rec.mute')} aria-pressed={muted}
            onClick={() => { if (audio.current) audio.current.muted = !muted; setMuted(!muted); }}>
            {muted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={volume} aria-label={t('rec.playerVolume')}
            onChange={event => {
              const level = event.currentTarget.valueAsNumber;
              if (audio.current) { audio.current.volume = level; audio.current.muted = false; }
              setVolume(level);
              setMuted(false);
            }} />
        </div>
      </div>
    </section>
  );
}
