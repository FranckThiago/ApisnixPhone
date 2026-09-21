import { UserRound } from 'lucide-react';
import { hueFor, initials } from '../domain/format';

export function Avatar({ name, size = 40, ring = false }: { name?: string; size?: number; ring?: boolean }) {
  const hue = name ? hueFor(name) : 225;
  return (
    <span className={'avatar' + (ring ? ' avatar-ring' : '')} aria-hidden="true"
          style={{ width: size, height: size, fontSize: size * 0.36, '--avatar-hue': hue } as React.CSSProperties}>
      {name ? initials(name) : <UserRound size={size * 0.48} />}
    </span>
  );
}
