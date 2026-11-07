import type { Session, URI } from 'sip.js';

/** A 202 response only accepts REFER. The final sipfrag NOTIFY proves the result. */
export function confirmedTransfer(session: Pick<Session,'refer'>, destination: URI, timeout=45000): Promise<void> {
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);if(ok)resolve();else reject(new Error('Transfer not confirmed'));};
    const timer=setTimeout(()=>finish(false),timeout);
    try {
      void session.refer(destination,{
        requestDelegate:{onReject:()=>finish(false)},
        onNotify:notification=>{
          void notification.accept().catch(()=>undefined);
          const status=Number(/^SIP\/2\.0\s+(\d{3})\b/m.exec(notification.request.body||'')?.[1]);
          if(status>=200&&status<300)finish(true);
          else if(status>=300)finish(false);
        },
      }).catch(()=>finish(false));
    }catch{finish(false);}
  });
}
