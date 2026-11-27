import type { View } from '../app/AppContext';
import type { Workspace } from './client';

/** Screens every phone has, which a supervisor may switch off for the team in Gestion. */
export type PhoneScreen = 'journal' | 'contacts' | 'audio';

/** On unless the server says the team's manager switched it off; unknown (not loaded, offline) means on. */
export function screenOn(workspace: Workspace | null | undefined, key: PhoneScreen): boolean {
  return workspace?.policy.features?.[key] !== false;
}

/** The view to show instead of one that was switched off; the same view when it is allowed. */
export function allowedView(view: View, workspace: Workspace | null | undefined): View {
  const journal = screenOn(workspace, 'journal');
  if (view === 'journal' && !journal) return 'callbacks';
  if ((view === 'contacts' && !screenOn(workspace, 'contacts')) || (view === 'audio' && !screenOn(workspace, 'audio')))
    return journal ? 'journal' : 'callbacks';
  return view;
}
