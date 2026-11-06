// Local test fixture only. No production credentials, registration or requests.
let networkDelay=100, networkFailure=false, networkCount=0;
const originalFetch=window.fetch.bind(window);
window.fetch=(url,options={})=> {
 if(!String(url).includes('connection-check.php')) return originalFetch(url,options);
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{
   networkCount++;
   document.getElementById('probe-count').textContent=String(networkCount);
   networkFailure?reject(new Error('Simulated outage')):resolve(new Response(null,{status:204}));
  },networkDelay);
  options.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Aborted'));},{once:true});
 });
};
window.addEventListener('DOMContentLoaded',()=>{
 const panel=document.createElement('div');panel.id='network-fixture';
 panel.style='position:fixed;right:8px;top:8px;z-index:100000;background:white;color:#111;padding:8px;border:1px solid #aaa;border-radius:8px;font:12px system-ui;max-width:350px';
 panel.innerHTML='<b>Simulation locale · aucun appel</b> <span id="probe-count">0</span><br><button data-delay="100">Rapide 100 ms</button> <button data-delay="650">Lent 650 ms</button> <button data-delay="350">Limite 350 ms</button> <button id="outage">Coupure</button> <button id="offline">Hors ligne</button> <button id="restore">Rétablir</button>';
 panel.querySelectorAll('[data-delay]').forEach(button=>button.onclick=()=>{networkDelay=Number(button.dataset.delay);networkFailure=false;});
 panel.querySelector('#outage').onclick=()=>{networkDelay=50;networkFailure=true;};
 panel.querySelector('#offline').onclick=()=>{networkFailure=true;dispatchEvent(new Event('offline'));};
 panel.querySelector('#restore').onclick=()=>{networkDelay=100;networkFailure=false;dispatchEvent(new Event('online'));};
 document.body.append(panel);
});
