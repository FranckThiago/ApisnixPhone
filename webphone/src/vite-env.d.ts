/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: 'demo' | 'live';
  readonly VITE_SIP_DOMAIN?: string;
  readonly VITE_SIP_WSS_URL?: string;
  /** Optional comma-separated STUN/TURN URLs without credentials. */
  readonly VITE_ICE_SERVERS?: string;
}
