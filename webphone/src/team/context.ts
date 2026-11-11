import { createContext, useContext } from 'react';
import type { Objective, Review, Workspace } from './client';

export type TeamValue = {
  workspace: Workspace | null;
  reviews: Review[];
  objectives: Objective[];
  error: string;
  version: number;
  refresh(): Promise<void>;
  request<T>(path: string, body?: unknown): Promise<T>;
};

export const TeamContext = createContext<TeamValue | null>(null);

export function useTeam() {
  const value = useContext(TeamContext);
  if (!value) throw new Error('TeamProvider missing');
  return value;
}
