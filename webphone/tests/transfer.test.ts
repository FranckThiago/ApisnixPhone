import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Session,URI,SessionReferOptions,Notification} from 'sip.js';
import {confirmedTransfer} from '../src/telephony/transfer';

function fixture() {
  let options:SessionReferOptions={};
  const refer=vi.fn(async(_uri:URI,o:SessionReferOptions)=>{options=o;return {} as never;});
  const session={refer} as unknown as Pick<Session,'refer'>;
  const request=()=>confirmedTransfer(session,{} as URI,1000);
  const accept=vi.fn(async()=>undefined);
  const notify=(body:string)=>options.onNotify?.({request:{body},accept} as unknown as Notification);
  return {request,refer,notify,accept,get options(){return options;}};
}
describe('confirmed call transfers',()=>{
  beforeEach(()=>vi.useFakeTimers());afterEach(()=>vi.useRealTimers());
  it('does not complete on REFER acceptance or a provisional NOTIFY',async()=>{
    const f=fixture(),done=vi.fn();const result=f.request().then(done);f.options.requestDelegate?.onAccept?.({} as never);f.notify('SIP/2.0 180 Ringing\r\n');await Promise.resolve();expect(done).not.toHaveBeenCalled();
    f.notify('SIP/2.0 200 OK\r\n');await result;expect(done).toHaveBeenCalledOnce();expect(f.accept).toHaveBeenCalledTimes(2);
  });
  it('rejects a busy destination, a rejected REFER and a missing final result',async()=>{
    const busy=fixture(),p1=expect(busy.request()).rejects.toThrow();busy.notify('SIP/2.0 486 Busy Here');await p1;
    const refused=fixture(),p2=expect(refused.request()).rejects.toThrow();refused.options.requestDelegate?.onReject?.({} as never);await p2;
    const timeout=fixture(),p3=expect(timeout.request()).rejects.toThrow();timeout.notify('SIP/2.0 100 Trying');await vi.advanceTimersByTimeAsync(1001);await p3;
    timeout.notify('SIP/2.0 200 OK');expect(timeout.accept).toHaveBeenCalledTimes(2);
  });
  it('rejects transport errors without an unhandled rejection',async()=>{const f=fixture();f.refer.mockRejectedValueOnce(new Error('transport'));await expect(f.request()).rejects.toThrow();});
});
