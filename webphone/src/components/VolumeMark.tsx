import { Volume, Volume1, Volume2 } from 'lucide-react';
import { volumeTone, type VolumeTone } from '../domain/types';

const ICONS: Record<VolumeTone, typeof Volume2> = { ok: Volume2, warn: Volume1, bad: Volume };

/** Speaker of the listening volume: its waves follow the level; its colour comes from the `tone-*` class around it. */
export function VolumeMark({ volume, size = 16 }: { volume: number; size?: number }) {
  const Icon = ICONS[volumeTone(volume)];
  return <Icon size={size} aria-hidden="true" />;
}
