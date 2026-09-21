import { Globe2, Hash } from 'lucide-react';
import type { NumberInfo } from '../domain/numbers';

// Local SVG files: emoji flags do not render reliably on every Windows.
const flags = import.meta.glob('/node_modules/country-flag-icons/3x2/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

export function Flag({ info, size = 20 }: { info: NumberInfo; size?: number }) {
  const url = info.country ? flags[`/node_modules/country-flag-icons/3x2/${info.country}.svg`] : undefined;
  if (url) return <img className="flag" src={url} width={size} height={Math.round(size * 2 / 3)} alt={info.countryName ?? info.country} />;
  const Icon = info.kind === 'internal' ? Hash : Globe2;
  return <Icon className="flag-fallback" size={size - 4} aria-label={info.kind === 'internal' ? 'Numéro interne' : 'Pays non déterminé'} />;
}

