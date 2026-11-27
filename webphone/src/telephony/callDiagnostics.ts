import type { CallOutcome } from '../domain/types';
import { t, type MessageKey } from '../i18n';

export interface RejectedCallMessage {
  statusCode?: number;
  reasonPhrase?: string;
  getHeader?(name: string): string | undefined;
  getHeaders?(name: string): string[];
}
export interface CallDiagnostic { outcome: CallOutcome; failure?: string; awaitingServerOutcome?: boolean }
const STATUSES: Record<number, MessageKey> = {
  400: 'sip.400', 401: 'sip.401', 402: 'sip.402', 403: 'sip.403', 404: 'sip.404',
  407: 'sip.401', 408: 'sip.408', 410: 'sip.410', 415: 'sip.488', 423: 'sip.400',
  430: 'sip.430', 439: 'sip.430', 470: 'sip.470', 480: 'sip.480', 481: 'sip.481',
  482: 'sip.482', 483: 'sip.482', 484: 'sip.484', 485: 'sip.485', 486: 'sip.486',
  487: 'sip.487', 488: 'sip.488', 491: 'sip.491', 493: 'sip.488',
  500: 'sip.500', 501: 'sip.501', 502: 'sip.502', 503: 'sip.503', 504: 'sip.504',
  580: 'sip.488', 600: 'sip.486', 603: 'sip.603', 604: 'sip.404', 606: 'sip.488',
};
const OUTCOMES: Record<number, CallOutcome> = { 486: 'busy', 600: 'busy', 603: 'declined', 408: 'no-answer', 487: 'cancelled' };
/** Q.850 cause values, not SIP status numbers. See RFC 3398 §7.2.4.1. */
const CAUSES: Record<number, [MessageKey, CallOutcome]> = {
  1: ['sip.unallocated', 'failed'], 2: ['sip.noRoute', 'failed'], 3: ['sip.noRoute', 'failed'],
  17: ['sip.busy', 'busy'], 18: ['sip.notResponding', 'no-answer'], 19: ['sip.noAnswer', 'no-answer'],
  20: ['sip.absent', 'failed'], 21: ['sip.rejected', 'declined'], 22: ['sip.numberChanged', 'failed'],
  27: ['sip.destinationDown', 'failed'], 28: ['sip.invalidNumber', 'failed'],
  34: ['sip.capacity', 'failed'], 38: ['sip.networkDown', 'failed'], 41: ['sip.temporaryNetwork', 'failed'],
  42: ['sip.capacity', 'failed'], 44: ['sip.capacity', 'failed'], 47: ['sip.capacity', 'failed'],
  57: ['sip.serviceDenied', 'failed'], 58: ['sip.mediaUnavailable', 'failed'],
  65: ['sip.mediaUnavailable', 'failed'], 88: ['sip.incompatible', 'failed'], 102: ['sip.timeout', 'failed'],
};

/** Split protocol/parameter lists without interpreting delimiters inside quoted text. */
function fields(value: string, separator: string): string[] {
  const parts: string[] = [];
  let quoted = false, escaped = false, begin = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\' && quoted) { escaped = true; continue; }
    if (char === '"') quoted = !quoted;
    if (char === separator && !quoted) { parts.push(value.slice(begin, i).trim()); begin = i + 1; }
  }
  if (!quoted) parts.push(value.slice(begin).trim());
  return parts;
}

/** No raw operator text is displayed or saved. A bare SIP status cannot prove a commercial restriction. */
export function describeCallRejection(message: RejectedCallMessage): CallDiagnostic {
  const status = message.statusCode ?? 0;
  const outcome = OUTCOMES[status] ?? 'failed';
  if (status < 400 || status > 699) return { outcome };
  const headers = (message.getHeaders?.('Reason') ?? [message.getHeader?.('Reason') ?? '']).slice(0, 8).join(',').slice(0, 8192);
  const reasons = [message.reasonPhrase ?? '', ...Array.from(headers.matchAll(/\btext\s*=\s*"([^"\r\n]*)"/gi), m => m[1]!)].map(value =>
    value.slice(0, 1024).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
  const matches = (pattern: RegExp) => reasons.some(reason => pattern.test(reason));
  const result = (key: MessageKey, classified: CallOutcome = outcome): CallDiagnostic => ({ outcome: classified, failure: t(key, { status }) });

  // Explicit operator policy beats lossy interworking causes such as generic Q.850 21.
  if (matches(/^(?:Temporarily Unavailable \(Call limit\)|Call limit(?: reached)?)$/i)) return result('sip.callLimit');
  if (matches(/^(?:insufficient (?:balance|credit|funds)|(?:balance|credit) (?:exhausted|depleted)|no (?:credit|funds)|out of credit|(?:credit|solde) (?:insuffisant|epuise|fini))(?:\s+\d+)?[.!]?$/i)) return result('sip.creditExhausted');
  if (matches(/^No Rates Found(?: for (?:Customer|Account) \d+)?$/i)) return result('sip.noRates');
  if (matches(/^No Routes (?:Found|For the Call)$/i)) return result('sip.noRoute');
  if (matches(/^Loss to Destination [0-9+]+ Exceeds Max Loss$/i)) return result('sip.routePolicy');
  if (matches(/^(?:outside (?:of )?(?:allowed )?(?:calling hours|time window)|time restriction|calling hours restriction)$/i)) return result('sip.callingHours');
  if (matches(/^(?:destination (?:not allowed|not permitted|blocked)|destination restriction)$/i)) return result('sip.destinationDenied');
  if (status === 470 && matches(/^Consent Needed$/i)) return result('sip.consentNeeded');

  // Accept cause only from the Q.850 protocol; SIP;cause=17 has no such meaning.
  const causes = fields(headers, ',').flatMap(header => {
    const [protocol, ...parameters] = fields(header, ';');
    if (protocol?.toUpperCase() !== 'Q.850') return [];
    const values = parameters.filter(parameter => /^cause\s*=/i.test(parameter));
    if (values.length !== 1 || !/^cause\s*=\s*\d{1,3}$/i.test(values[0]!)) return [];
    return [Number(values[0]!.split('=')[1]!.trim())];
  });
  const known = [...new Set(causes.filter(cause => cause in CAUSES))];
  if (known.length === 1) { const [key, classified] = CAUSES[known[0]!]!; return result(key, classified); }
  // Exact known phrases only: do not turn an arbitrary sentence containing "busy" into a diagnosis.
  if (matches(/^(?:User busy|Busy Here|Busy Everywhere|Line busy|Ligne occupee)$/i)) return result('sip.busy', 'busy');
  if (matches(/^(?:No answer|No answer from (?:the )?user|No user responding)$/i)) return result('sip.noAnswer', 'no-answer');
  if (matches(/^(?:Unallocated(?: \(unassigned\))? number|Unassigned number)$/i)) return result('sip.unallocated');
  const key = STATUSES[status] ?? 'sip.other';
  return { ...result(key), ...(status === 480 ? { awaitingServerOutcome: true } : {}) };
}
