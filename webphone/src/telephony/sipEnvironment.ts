import { MediaAccessClient, observeMedia, relayAvailable, type MediaAccess } from './mediaPath';
import type { CallMediaOptions, Manager, SipEnvironment } from './SipPhoneController';

/** Real browser bindings. SIP.js is loaded on demand, so the demonstration never ships it. */
export const browserSipEnvironment: SipEnvironment = {
  async createManager(config, credentials, delegate, microphone, remoteAudio, recoveryContact) {
    const { Web, UserAgent } = await import('sip.js');
    let registeredOnce = !!recoveryContact;
    let retired = false;
    const mediaAccess = new MediaAccessClient(credentials.username);
    const observers = new Map<string, ReturnType<typeof observeMedia>>();
    let prepared: MediaAccess | undefined;
    let preparation = 0;
    const factory = Web.defaultSessionDescriptionHandlerFactory(() => microphone());
    const prepareMedia = async (): Promise<CallMediaOptions> => {
      const generation = ++preparation;
      let access = await mediaAccess.load();
      if (access?.iceTransportPolicy === 'relay' && !await relayAvailable(access.iceServers)) {
        // Keep TURN as an option, with the original direct path available.
        access = { ...access, iceTransportPolicy: 'all' };
      }
      if (!retired && generation === preparation) prepared = access;
      return { earlyMedia: access?.earlyMedia === true };
    };
    const manager = new Web.SessionManager(config.wssUrl, {
      aor: `sip:${credentials.username}@${config.domain}`,
      delegate: { ...delegate,
        onRegistered: () => { registeredOnce = true; delegate.onRegistered(); },
        onCallAnswered: session => { observers.get(session.id)?.answered(); delegate.onCallAnswered(session); },
        onCallHangup: session => { observers.get(session.id)?.stop(); observers.delete(session.id); prepared = undefined; delegate.onCallHangup(session); },
      },
      // Do not steal the line from another device after an outage.
      registerGuard: async () => {
        if (retired) return true;
        if (!registeredOnce) return false;
        const holds = await holdsLine();
        if (holds === false) delegate.onLineTaken?.();
        return retired || holds === false || holds === null;
      },
      // One call at a time for the first pilot; attended transfer is out of scope.
      maxSimultaneousSessions: 1,
      media: { constraints: { audio: true, video: false }, remote: { audio: remoteAudio } },
      // A refused REGISTER is final: no loop of attempts against the PBX.
      registrationRetry: false,
      // One recovery loop, owned by the controller, including clean socket closes.
      reconnectionAttempts: 0,
      registererOptions: { expires: 300, refreshFrequency: 50 },
      // RFC 2833 telephone-event over RTP, as the existing WebRTC path does.
      sendDTMFUsingSessionDescriptionHandler: true,
      userAgentOptions: {
        authorizationUsername: credentials.username,
        // In memory for this session only.
        authorizationPassword: credentials.password,
        transportOptions: { server: config.wssUrl, keepAliveInterval: 30, traceSip: false },
        ...(recoveryContact ? { contactName: recoveryContact } : {}),
        contactParams: { transport: 'wss' },
        // Recognisable in the PBX's peer list and in supervision.
        userAgentString: 'ApisnixPhoneWeb/0.1.0 SIP.js/0.21.2',
        logBuiltinEnabled: false,
        logConfiguration: false,
        // The original microphone track goes directly to the call, without Web Audio.
        sessionDescriptionHandlerFactory: (session, options) => {
          const access = prepared && prepared.expiresAt > Date.now() + 60_000 ? prepared : undefined;
          const directServers = config.iceServers?.length ? [{ urls: config.iceServers }] : [{ urls: 'stun:stun.l.google.com:19302' }];
          const handler = factory(session, access ? { ...options, peerConnectionConfiguration: {
            iceServers: access.iceTransportPolicy === 'relay' ? access.iceServers : [...directServers, ...access.iceServers],
            iceTransportPolicy: access.iceTransportPolicy,
          } } : options) as InstanceType<typeof Web.SessionDescriptionHandler>;
          const pc = handler.peerConnection;
          if (pc && access) {
            const observer = observeMedia(pc, access.iceTransportPolicy, metrics => { void mediaAccess.report(access, metrics); });
            observers.set(session.id, observer);
            const close = handler.close.bind(handler);
            handler.close = () => { observer.stop(); observers.delete(session.id); close(); };
          }
          return handler;
        },
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
    const holdsLine = () => new Promise<boolean | 'missing' | null>(resolve => {
      const server = UserAgent.makeURI(`sip:${config.domain}`);
      const account = UserAgent.makeURI(`sip:${credentials.username}@${config.domain}`);
      const mine = manager.userAgent.contact.uri.user;
      if (!server || !account || !mine || !transport.isConnected()) return resolve(null);
      const timer = setTimeout(() => resolve(null), 8000);
      const settle = (value: boolean | 'missing' | null) => { clearTimeout(timer); resolve(value); };
      try {
        const core = manager.userAgent.userAgentCore;
        core.request(core.makeOutgoingRequestMessage('REGISTER', server, account, account, {}), {
          onAccept: response => {
            const contacts = response.message.getHeaders('contact');
            // A confirmed empty binding can be repaired; an unanswered query cannot.
            settle(contacts.length ? contacts.some(contact => contact.includes(`sip:${mine}@`)) : 'missing');
          },
          onReject: () => settle(null),
        });
      } catch {
        settle(null);
      }
    });
    const dropSilently = async () => {
      retired = true;
      observers.forEach(observer => observer.stop()); observers.clear();
      // Socket first: SIP.js un-registers while stopping, and that must not reach the PBX.
      const closing = transport.disconnect().catch(() => undefined);
      // Stop SessionManager immediately too, so its native online listener cannot
      // resurrect this retired instance while the socket close is still pending.
      await manager.disconnect().catch(() => undefined);
      await closing;
    };
    const sentAudioPackets = async (session: unknown) => {
      const handler = (session as { sessionDescriptionHandler?: { peerConnection?: RTCPeerConnection } }).sessionDescriptionHandler;
      const stats = await handler?.peerConnection?.getStats();
      if (!stats) return null;
      let packets: number | null = null;
      stats.forEach(report => { if (report.type === 'outbound-rtp' && report.kind === 'audio') packets = (packets ?? 0) + (report.packetsSent ?? 0); });
      return packets;
    };
    return Object.assign(manager, { prepareMedia, contactName: manager.userAgent.contact.uri.user!, dropSilently, holdsLine, sentAudioPackets }) as unknown as Manager;
  },

  createRemoteAudio() {
    // Lives outside every view, so navigation never cuts the sound.
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.hidden = true;
    document.body.append(audio);
    return audio;
  },

  // The page answers for the caller's own address only; a short timeout keeps a slow server from delaying the message.
  async blockStatus(url) {
    const control = new AbortController();
    const timer = setTimeout(() => control.abort(), 4000);
    try {
      const response = await fetch(url, { cache: 'no-store', signal: control.signal });
      if (!response.ok) return null;
      const body = await response.json() as { bloque?: unknown; reste?: unknown; ponderes?: unknown; restants?: unknown; prochain?: unknown };
      const counter = body.restants === undefined ? {} : { weighted: Number(body.ponderes) || 0, left: Number(body.restants) || 0, nextBlock: Number(body.prochain) || 0 };
      return { blocked: body.bloque === true, remaining: Number(body.reste) || 0, ...counter };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  },
};

export function sipConfigFromEnv(env: ImportMetaEnv) {
  const domain = String(env.VITE_SIP_DOMAIN ?? '').trim();
  const wssUrl = String(env.VITE_SIP_WSS_URL ?? '').trim();
  const iceServers = String(env.VITE_ICE_SERVERS ?? '').split(',').map(url => url.trim()).filter(Boolean);
  if (env.VITE_APP_MODE !== 'live') return null;
  if (!/^[a-z0-9.-]+$/i.test(domain) || !/^wss:\/\/[^\s]+$/i.test(wssUrl)) throw new Error('VITE_SIP_DOMAIN et VITE_SIP_WSS_URL (wss://) sont requis en mode live.');
  // The PBX web server says whether this site is blocked (same host as the SIP domain unless overridden).
  const statusUrl = String(env.VITE_BLOCK_STATUS_URL ?? '').trim() || `https://${domain}/agc/apisnix/etat-telephonie.php`;
  return { domain, wssUrl, iceServers, statusUrl };
}
