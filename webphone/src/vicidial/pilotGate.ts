/** Experiments must never replace the frame authorization gate of a release. */
export function pilotEnabled(development: boolean, mode: unknown, hostname: string) {
  return development && mode !== 'live' && ['127.0.0.1', 'localhost', '[::1]'].includes(hostname);
}
