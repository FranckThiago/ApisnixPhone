import { CallWaitingPhoneController } from '../../src/telephony/CallWaitingPhoneController';
import { browserSipEnvironment } from '../../src/telephony/sipEnvironment';
import type { Manager } from '../../src/telephony/SipPhoneController';
import type { Web } from 'sip.js';

// Open /tests/browser/callWaiting.html through Vite. Real SIP.js and WebRTC,
// entirely in this page; no external SIP account, no physical microphone.
const output = document.querySelector<HTMLPreElement>('#results')!;
const write = (message: string) => { output.textContent += message + '\n'; };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(test: () => boolean, message: string) {
  for (let n = 0; n < 150; n++) { if (test()) return; await sleep(100); }
  throw new Error(`Timeout: ${message}`);
}
function assert(ok: unknown, message: string) { if (!ok) throw new Error(message); write(`PASS ${message}`); }
const header = (message: string, name: string) => message.split('\r\n').find(s => s.toLowerCase().startsWith(name.toLowerCase() + ':')) ?? '';
const value = (message: string, name: string) => header(message, name).slice(name.length + 1).trim();
const body = (message: string) => message.slice(message.indexOf('\r\n\r\n') + 4);
const pcs = new Map<string, RTCPeerConnection>();
const received = new Map<string, MediaStream>();
const traces: string[] = [];
let socket: LocalSocket;
let context: AudioContext;
function tone(frequency: number) {
  const oscillator = context.createOscillator(), destination = context.createMediaStreamDestination();
  oscillator.frequency.value = frequency; oscillator.connect(destination); oscillator.start();
  return destination.stream;
}
async function gathered(pc: RTCPeerConnection) {
  if (pc.iceGatheringState !== 'complete') await until(() => pc.iceGatheringState === 'complete', 'local ICE');
  return pc.localDescription!.sdp;
}
class LocalSocket extends EventTarget {
  static OPEN = 1;
  readyState = 0; binaryType = '';
  constructor() { super();
    // The local transport endpoint receives the fake server’s SIP messages.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    socket = this; queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }); }
  receive(data: string) { this.dispatchEvent(Object.assign(new Event('message'), { data })); }
  send(message: string) { void this.respond(message).catch(error => write(`SERVER ERROR ${error.message}`)); }
  async respond(message: string) {
    const id = value(message, 'Call-ID'), cseq = value(message, 'CSeq');
    traces.push(`${message.split('\r\n')[0]} ${id} ${cseq}`);
    if (message.startsWith('REGISTER ')) {
      this.response(message, '', true); return;
    }
    if (message.startsWith('SIP/2.0 200') && cseq.endsWith('INVITE')) {
      await pcs.get(id)!.setRemoteDescription({ type: 'answer', sdp: body(message) });
      this.receive([`ACK ${manager.userAgent.contact.uri} SIP/2.0`, `Via: SIP/2.0/WSS pbx.example;branch=z9hG4bK-ack-${id}`,
        'Max-Forwards: 70', header(message, 'From'), header(message, 'To'), header(message, 'Call-ID'), 'CSeq: 1 ACK', 'Content-Length: 0', '', ''].join('\r\n'));
    } else if (message.startsWith('INVITE ')) {
      const pc = pcs.get(id)!;
      await pc.setRemoteDescription({ type: 'offer', sdp: body(message) });
      await pc.setLocalDescription(await pc.createAnswer());
      this.response(message, await gathered(pc));
    } else if (message.startsWith('BYE ')) this.response(message);
    else if (message.startsWith('SIP/2.0 486')) {
      this.receive([`ACK ${manager.userAgent.contact.uri} SIP/2.0`, `Via: SIP/2.0/WSS pbx.example;branch=z9hG4bK-${id}`,
        'Max-Forwards: 70', header(message, 'From'), header(message, 'To'), header(message, 'Call-ID'), 'CSeq: 1 ACK', 'Content-Length: 0', '', ''].join('\r\n'));
    }
  }
  response(request: string, sdp = '', register = false) {
    queueMicrotask(() => this.receive(['SIP/2.0 200 OK', ...['Via', 'From', 'To', 'Call-ID', 'CSeq'].map(h => header(request, h)),
      register ? header(request, 'Contact') : 'Contact: <sip:caller@pbx.example>',
      ...(sdp ? ['Content-Type: application/sdp'] : []), `Content-Length: ${new TextEncoder().encode(sdp).length}`, '', sdp].join('\r\n')));
  }
  close() { this.readyState = 3; queueMicrotask(() => this.dispatchEvent(Object.assign(new Event('close'), { code: 1000, reason: '', wasClean: true }))); }
}
let manager: Manager & Web.SessionManager;
async function invite(id: string, frequency: number) {
  const pc = new RTCPeerConnection({ iceServers: [] }); pcs.set(id, pc);
  pc.ontrack = event => received.set(id, event.streams[0] ?? new MediaStream([event.track]));
  const stream = tone(frequency); stream.getTracks().forEach(track => pc.addTrack(track, stream));
  await pc.setLocalDescription(await pc.createOffer());
  const sdp = await gathered(pc), contact = manager.userAgent.contact.uri.toString();
  socket.receive([`INVITE ${contact} SIP/2.0`, `Via: SIP/2.0/WSS pbx.example;branch=z9hG4bK-${id}`,
    'Max-Forwards: 70', `From: <sip:${id}@pbx.example>;tag=from-${id}`, `To: <${contact}>`,
    `Call-ID: ${id}`, 'CSeq: 1 INVITE', 'Contact: <sip:caller@pbx.example>', 'Content-Type: application/sdp',
    `Content-Length: ${new TextEncoder().encode(sdp).length}`, '', sdp].join('\r\n'));
}
async function rms(id: string) {
  const source = context.createMediaStreamSource(received.get(id)!); const analyser = context.createAnalyser();
  analyser.fftSize = 2048; source.connect(analyser); await sleep(500);
  const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples); source.disconnect();
  return Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
}
document.querySelector<HTMLButtonElement>('#run')!.onclick = async () => {
  const button = document.querySelector<HTMLButtonElement>('#run')!; button.disabled = true; output.textContent = '';
  const nativeSocket = window.WebSocket, nativeCapture = navigator.mediaDevices.getUserMedia;
  let phone: CallWaitingPhoneController | undefined; let captures = 0;
  try {
    context = new AudioContext(); await context.resume();
    const mic = tone(700);
    navigator.mediaDevices.getUserMedia = async () => { captures++; return mic.clone(); };
    window.WebSocket = LocalSocket as unknown as typeof WebSocket;
    phone = new CallWaitingPhoneController({ domain: 'pbx.example', wssUrl: 'wss://pbx.example/ws', callWaitingLines: ['pilot'] }, {
      ...browserSipEnvironment,
      createManager: async (...args) => {
        manager = await browserSipEnvironment.createManager(...args) as Manager & Web.SessionManager;
        return manager;
      },
    });
    phone.applyAudio({ volume: 0, micGain: 100, echoCancellation: true, noiseSuppression: true, ringtone: false, ringtoneSound: 'classic' });
    await phone.connect({ username: 'pilot', password: 'fictional-only' }); await until(() => phone!.getSnapshot().connection === 'ready', 'REGISTER');
    await invite('A', 440); await until(() => phone!.getSnapshot().call?.phase === 'ringing-in', 'A ringing');
    phone.answer(); await until(() => phone!.getSnapshot().call?.phase === 'active' && pcs.get('A')?.connectionState === 'connected', 'A connected');
    assert(await rms('A') > 0.01, 'A receives the synthetic microphone over real WebRTC');
    await invite('B', 880); await until(() => !!phone!.getSnapshot().otherCall, 'B waiting');
    const before = traces.length; phone.answerWaiting();
    await until(() => phone!.getSnapshot().call?.dialTarget === 'B' && phone!.getSnapshot().call?.phase === 'active' && pcs.get('B')?.connectionState === 'connected', 'B connected');
    const transition = traces.slice(before);
    const holdRequest = transition.findIndex(x => x.startsWith('INVITE ') && x.includes(' A '));
    const secondAnswer = transition.findIndex(x => x.startsWith('SIP/2.0 200') && x.includes(' B '));
    assert(holdRequest >= 0 && secondAnswer > holdRequest, 'SIP re-INVITE for A precedes the 200 answer to B');
    assert(phone.getSnapshot().otherCall?.phase === 'held', 'A is confirmed held while B is active');
    assert(captures === 1, 'both calls share one capture with separate native cloned tracks');
    const a1 = await rms('A'), b1 = await rms('B');
    assert(a1 < 0.001 && b1 > 0.01, `only B receives speech (A=${a1.toFixed(5)}, B=${b1.toFixed(5)})`);
    await invite('C', 1000); await sleep(300);
    assert(traces.some(x => x.startsWith('SIP/2.0 486') && x.includes(' C ')), 'third INVITE rejected with SIP 486');
    phone.switchCall(); await until(() => phone!.getSnapshot().call?.dialTarget === 'A' && phone!.getSnapshot().call?.phase === 'active' && !phone!.getSnapshot().switchingCall, 'A resumed');
    const a2 = await rms('A'), b2 = await rms('B');
    assert(a2 > 0.01 && b2 < 0.001, `only A receives speech after switching back (A=${a2.toFixed(5)}, B=${b2.toFixed(5)})`);
    phone.setMuted(true); assert(await rms('A') < 0.001, 'mute silences the selected conversation'); phone.setMuted(false);
    phone.hangup(); await until(() => phone!.getSnapshot().call?.dialTarget === 'B' && phone!.getSnapshot().call?.phase === 'active', 'B resumed after A ends');
    assert(await rms('B') > 0.01, 'closing A does not stop B’s cloned microphone');
    phone.hangup(); await until(() => phone!.getSnapshot().call?.phase === 'ended', 'both ended');
    assert(phone.getSnapshot().completedCalls?.length === 2, 'both ended conversations retained for the journal');
    write('RESULT: PASS — native media and SIP verified locally; physical iPhone/PBX not covered.');
  } catch (error) { write(`RESULT: FAIL — ${error instanceof Error ? error.message : String(error)}`); write(JSON.stringify(phone?.getSnapshot())); write(traces.join("\n")); }
  finally {
    await phone?.disconnect(); pcs.forEach(pc => pc.close()); pcs.clear(); received.clear(); traces.length = 0;
    await context?.close(); navigator.mediaDevices.getUserMedia = nativeCapture; window.WebSocket = nativeSocket;
    button.disabled = false;
  }
};
