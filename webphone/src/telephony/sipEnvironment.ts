import type { Manager, SipEnvironment } from './SipPhoneController';

/** Real browser bindings. SIP.js is loaded on demand, so the demonstration never ships it. */
export const browserSipEnvironment: SipEnvironment = {
  async createManager(config, credentials, delegate, microphone, remoteAudio) {
    const { Web } = await import('sip.js');
    const manager = new Web.SessionManager(config.wssUrl, {
      aor: `sip:${credentials.username}@${config.domain}`,
      delegate,
      // One call at a time for the first pilot; attended transfer is out of scope.
      maxSimultaneousSessions: 1,
      media: { constraints: { audio: true, video: false }, remote: { audio: remoteAudio } },
      // A refused REGISTER is final: no loop of attempts against the PBX.
      registrationRetry: false,
      reconnectionAttempts: 3,
      reconnectionDelay: 4,
      // RFC 2833 telephone-event over RTP, as the existing WebRTC path does.
      sendDTMFUsingSessionDescriptionHandler: true,
      userAgentOptions: {
        authorizationUsername: credentials.username,
        // In memory for this session only.
        authorizationPassword: credentials.password,
        contactParams: { transport: 'wss' },
        logBuiltinEnabled: false,
        logConfiguration: false,
        // The microphone goes through the application's gain chain.
        sessionDescriptionHandlerFactory: Web.defaultSessionDescriptionHandlerFactory(() => microphone()),
        ...(config.iceServers?.length
          ? { sessionDescriptionHandlerFactoryOptions: { peerConnectionConfiguration: { iceServers: [{ urls: config.iceServers }] } } }
          : {}),
      },
    });
    return manager as unknown as Manager;
  },

  createRemoteAudio() {
    // Lives outside every view, so navigation never cuts the sound.
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.hidden = true;
    document.body.append(audio);
    return audio;
  },

  acquireLine(name) {
    if (!navigator.locks) return Promise.resolve(() => undefined);
    return new Promise(resolve => {
      void navigator.locks.request(name, { ifAvailable: true }, lock => {
        if (!lock) return resolve(null);
        // The lock is held until this promise settles, i.e. until the line is released.
        return new Promise<void>(release => resolve(release));
      });
    });
  },
};

export function sipConfigFromEnv(env: ImportMetaEnv) {
  const domain = String(env.VITE_SIP_DOMAIN ?? '').trim();
  const wssUrl = String(env.VITE_SIP_WSS_URL ?? '').trim();
  const iceServers = String(env.VITE_ICE_SERVERS ?? '').split(',').map(url => url.trim()).filter(Boolean);
  if (env.VITE_APP_MODE !== 'live') return null;
  if (!/^[a-z0-9.-]+$/i.test(domain) || !/^wss:\/\/[^\s]+$/i.test(wssUrl)) throw new Error('VITE_SIP_DOMAIN et VITE_SIP_WSS_URL (wss://) sont requis en mode live.');
  return { domain, wssUrl, iceServers };
}
