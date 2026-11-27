import { afterEach, describe, expect, it } from 'vitest';
import { describeCallRejection } from '../src/telephony/callDiagnostics';
import { setLanguage, t } from '../src/i18n';
const reject = (statusCode: number, header = '', reasonPhrase = '') => describeCallRejection({ statusCode, reasonPhrase, getHeader: () => header });
afterEach(() => setLanguage('fr'));
describe('call diagnostics from explicit server evidence', () => {
  it('keeps an unexplained 480 provisional, without inventing a busy destination', () => {
    expect(reject(480)).toEqual({ outcome: 'failed', failure: t('sip.480', { status: 480 }), awaitingServerOutcome: true });
  });
  it('uses Q.850 busy rather than the lossy 480 status, in every language', () => {
    for (const lang of ['fr', 'en', 'es'] as const) {
      setLanguage(lang);
      expect(reject(480, 'SIP;cause=480;text="Temporarily Unavailable", Q.850;cause=17')).toEqual({ outcome: 'busy', failure: t('sip.busy', { status: 480 }) });
    }
  });
  it.each([
    [19, 'no-answer', 'sip.noAnswer'], [18, 'no-answer', 'sip.notResponding'], [1, 'failed', 'sip.unallocated'],
    [3, 'failed', 'sip.noRoute'], [21, 'declined', 'sip.rejected'], [28, 'failed', 'sip.invalidNumber'],
    [34, 'failed', 'sip.capacity'], [38, 'failed', 'sip.networkDown'], [88, 'failed', 'sip.incompatible'],
  ] as const)('recognises Q.850 %s while preserving the received SIP code', (cause, outcome, key) => {
    expect(reject(480, `Q.850;cause=${cause}`)).toEqual({ outcome, failure: t(key, { status: 480 }) });
  });
  it('does not call a generic 404 an unallocated number or a generic 403 a credit issue', () => {
    expect(reject(404).failure).toBe(t('sip.404', { status: 404 }));
    expect(reject(403).failure).toBe(t('sip.403', { status: 403 }));
    expect(reject(402).failure).toBe(t('sip.402'));
  });
  it('prefers an explicit commercial or local limit reason to a generic rejection cause', () => {
    expect(reject(403, 'Q.850;cause=21;text="Insufficient Balance 19"').failure).toBe(t('sip.creditExhausted', { status: 403 }));
    expect(reject(480, 'Q.850;cause=17', 'Call limit reached').failure).toBe(t('sip.callLimit', { status: 480 }));
    expect(reject(403, '', 'Outside allowed calling hours').failure).toBe(t('sip.callingHours', { status: 403 }));
  });
  it.each(['SIP;cause=17', 'Q.850;cause=170', 'Q.850;cause=017x', 'Q.850;text="not a cause;cause=17"', 'Q.850;cause=17;cause=19', 'SIP;text="Q.850;cause=17"', 'Q.850;cause=17, Q.850;cause=19'])('does not guess from malformed or conflicting causes: %s', header => {
    expect(reject(480, header).awaitingServerOutcome).toBe(true);
  });
  it('reads multiple Reason headers and does not expose arbitrary remote text', () => {
    const message = { statusCode: 480, reasonPhrase: '<script>private text</script>', getHeaders: () => ['SIP;cause=480', 'Q.850;cause=17'] };
    expect(describeCallRejection(message)).toEqual({ outcome: 'busy', failure: t('sip.busy', { status: 480 }) });
    expect(reject(499, '', message.reasonPhrase).failure).toBe(t('sip.other', { status: 499 }));
  });
  it('distinguishes timing, cancellation, refusal and media errors', () => {
    expect(reject(408).outcome).toBe('no-answer');
    expect(reject(487).outcome).toBe('cancelled');
    expect(reject(603).outcome).toBe('declined');
    expect(reject(606).failure).toBe(t('sip.488', { status: 606 }));
    expect(reject(504).failure).toBe(t('sip.504', { status: 504 }));
  });
});
