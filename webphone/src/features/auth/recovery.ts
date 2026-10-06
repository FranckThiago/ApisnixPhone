/** Per-tab recovery marker: no credentials or profile data are stored here. */
const KEY = 'apisnixphone.manual-sign-in';
export const MANUAL_SIGN_IN_URL = '/?connexion=manuelle';
export function automaticSignInAllowed(): boolean {
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('connexion') === 'manuelle') return false;
  try { return sessionStorage.getItem(KEY) !== '1'; } catch { return true; }
}
export function requireManualSignIn() {
  try { sessionStorage.setItem(KEY, '1'); } catch { /* The manual URL remains available. */ }
}
export function clearRecoveryMarker() {
  try { sessionStorage.removeItem(KEY); } catch { /* Storage can be disabled. */ }
}
