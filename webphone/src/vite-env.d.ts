/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: 'demo' | 'live';
  readonly VITE_SIP_DOMAIN?: string;
  readonly VITE_SIP_WSS_URL?: string;
  /** Optional comma-separated STUN/TURN URLs without credentials. */
  readonly VITE_ICE_SERVERS?: string;
  /** Optional page saying whether this site is blocked by the PBX; default `https://<VITE_SIP_DOMAIN>/agc/apisnix/etat-telephonie.php`. */
  readonly VITE_BLOCK_STATUS_URL?: string;
  /** Base URL of the recordings access (agent API of the supervision). Default `/api`, same origin. */
  readonly VITE_RECORDINGS_URL?: string;
}
