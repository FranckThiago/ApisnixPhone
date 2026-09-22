import type { Manager, SipEnvironment } from './SipPhoneController';

/** Real browser bindings. SIP.js is loaded on demand, so the demonstration never ships it. */
export const browserSipEnvironment: SipEnvironment = {
  async createManager(config, credentials, delegate, microphone, remoteAudio) {
    const { Web, UserAgent } = await import('sip.js');
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
        // Recognisable in the PBX's peer list and in supervision.
        userAgentString: 'ApisnixPhoneWeb/0.1.0 SIP.js/0.21.2',
        logBuiltinEnabled: false,
        logConfiguration: false,
        // The microphone goes through the application's gain chain.
        sessionDescriptionHandlerFactory: Web.defaultSessionDescriptionHandlerFactory(() => microphone()),
        sessionDescriptionHandlerFactoryOptions: {
          // Audio goes through the PBX's public address: do not hold the call back waiting for every ICE candidate.
          iceGatheringTimeout: 2000,
          ...(config.iceServers?.length ? { peerConnectionConfiguration: { iceServers: [{ urls: config.iceServers }] } } : {}),
        },
      },
    });
    const transport = manager.userAgent.transport;
    /**
     * Asks the PBX which device holds the account: a REGISTER without Contact is a query (RFC 3261 §10.2.3),
     * it changes nothing and the answer lists the registered contact. Ours carries a random user part,
     * so the comparison is exact. null = no usable answer: never conclude anything from it.
     */
    const holdsLine = () => new Promise<boolean | null>(resolve => {
      const server = UserAgent.makeURI(`sip:${config.domain}`);
      const account = UserAgent.makeURI(`sip:${credentials.username}@${config.domain}`);
      const mine = manager.userAgent.contact.uri.user;
      if (!server || !account || !mine || !transport.isConnected()) return resolve(null);
      const timer = setTimeout(() => resolve(null), 8000);
      const settle = (value: boolean | null) => { clearTimeout(timer); resolve(value); };
      try {
        const core = manager.userAgent.userAgentCore;
        core.request(core.makeOutgoingRequestMessage('REGISTER', server, account, account, {}), {
          onAccept: response => {
            const contacts = response.message.getHeaders('contact');
            // No contact at all: nobody is registered, which is not « someone else ».
            settle(contacts.length ? contacts.some(contact => contact.includes(`sip:${mine}@`)) : null);
          },
          onReject: () => settle(null),
        });
      } catch {
        settle(null);
      }
    });
    const dropSilently = async () => {
      // Socket first: SIP.js un-registers while stopping, and that must not reach the PBX.
      await transport.disconnect().catch(() => undefined);
      await manager.disconnect().catch(() => undefined);
    };
    const sentAudioPackets = async (session: unknown) => {
      const handler = (session as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } }).sessionDescriptionHandler;
      const stats = await handler?.peerConnection?.getStats();
      if (!stats) return null;
      let packets: number | null = null;
      stats.forEach(report => { if (report.type === 'outbound-rtp' && report.kind === 'audio') packets = (packets ?? 0) + (report.packetsSent ?? 0); });
      return packets;
    };
    return Object.assign(manager, { dropSilently, holdsLine, sentAudioPackets }) as unknown as Manager;
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
      const held = navigator.locks.request(name, { ifAvailable: true }, lock => {
        if (!lock) return resolve(null);
        // The lock is held until this promise settles, i.e. until the line is released.
        // Releasing waits for the lock manager to let go, so a sign-in right after a sign-out
        // does not find its own lock still there.
        return new Promise<void>(release => resolve(() => { release(); return held.then(() => undefined); }));
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
