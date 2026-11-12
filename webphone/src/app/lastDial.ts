/**
 * Last outgoing input of a line, exactly as typed (route prefixes included).
 * Kept per line in this browser so the dialer can bring it back after a reload.
 */
const key = (line: string) => `apisnixphone.lastDial.${line.trim().toLowerCase()}`;

export function readLastDial(line: string): string {
  try { return (localStorage.getItem(key(line)) ?? '').slice(0, 40); } catch { return ''; }
}

export function writeLastDial(line: string, rawInput: string): void {
  try { localStorage.setItem(key(line), rawInput.slice(0, 40)); } catch { /* private mode: memory only */ }
}
