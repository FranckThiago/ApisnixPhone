import { PROTOCOL, phoneEvent, safeOrigin, type PhoneEvent, type ResultCode } from './protocol';
export type { PhoneEvent, PublicCall, PublicState } from './protocol';
export interface EmbedOptions {
  container: HTMLElement;
  /** Origin of the hosted phone; the SDK owns the /embed path. */
  url: string;
  /** Optional public phone identifier, never a password. */
  phone?: string;
  title?: string;
  onEvent?: (event: PhoneEvent) => void;
  onError?: (code: 'handshake-timeout') => void;
}

/** Mount once and keep mounted during a call. Hiding the container is safe. */
export function createApisnixPhone(options: EmbedOptions) {
  const origin = safeOrigin(options.url, true);
  if (!origin) throw new Error('invalid-phone-origin');
  if (options.phone && !/^[a-zA-Z0-9_.-]{1,100}$/.test(options.phone)) throw new Error('invalid-phone-id');
  const frame = document.createElement('iframe');
  const url = new URL('/embed', origin);
  if (options.phone) url.searchParams.set('phone', options.phone);
  frame.src = url.href;
  frame.title = options.title ?? 'ApisnixPhone';
  frame.allow = `microphone ${origin}; autoplay ${origin}`;
  frame.referrerPolicy = 'no-referrer';
  frame.style.cssText = 'display:block;width:100%;height:100%;border:0;';
  const channel = crypto.randomUUID();
  const pending = new Map<string, { resolve: (code: ResultCode) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  let ready = false;
  let destroyed = false;
  let handshake: ReturnType<typeof setInterval>;
  let deadline: ReturnType<typeof setTimeout>;
  const send = (data: Record<string, unknown>) => frame.contentWindow?.postMessage({ ...data, protocol: PROTOCOL, channel }, origin);
  const hello = () => send({ type: 'hello' });
  const receive = (event: MessageEvent<unknown>) => {
    if (destroyed || event.origin !== origin || event.source !== frame.contentWindow || !phoneEvent(event.data) || event.data.channel !== channel) return;
    const message = event.data;
    if (message.type === 'ready') {
      if (ready) return;
      ready = true;
      clearInterval(handshake); clearTimeout(deadline);
    }
    if (!ready) return;
    if (message.type === 'result') {
      const request = pending.get(message.requestId);
      if (request) { clearTimeout(request.timer); pending.delete(message.requestId); request.resolve(message.code); }
    }
    options.onEvent?.(message);
  };
  window.addEventListener('message', receive);
  const startHandshake = () => {
    clearInterval(handshake); clearTimeout(deadline);
    handshake = setInterval(hello, 250);
    deadline = setTimeout(() => {
      clearInterval(handshake);
      options.onError?.('handshake-timeout');
    }, 12_000);
    hello();
  };
  const loaded = () => {
    // A loaded document must authenticate the channel again, including after reload.
    ready = false;
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('phone-reloaded')); }
    pending.clear();
    startHandshake();
  };
  frame.addEventListener('load', loaded);
  options.container.append(frame);
  startHandshake();
  return {
    prepareCall(number: string): Promise<ResultCode> {
      if (destroyed || !ready) return Promise.reject(new Error('phone-not-ready'));
      if (typeof number !== 'string' || number.length > 40) return Promise.resolve('invalid-number');
      const requestId = crypto.randomUUID();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('command-timeout')); }, 5000);
        pending.set(requestId, { resolve, reject, timer });
        send({ type: 'prepare-call', requestId, number });
      });
    },
    /** Removing the iframe disconnects its line and can end an ongoing call. */
    destroy() {
      destroyed = true; clearInterval(handshake); clearTimeout(deadline);
      window.removeEventListener('message', receive); frame.removeEventListener('load', loaded);
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('phone-destroyed')); }
      pending.clear(); frame.remove();
    },
  };
}
