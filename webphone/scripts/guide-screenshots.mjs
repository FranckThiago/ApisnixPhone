// Regenerates the user guide's screenshots from the DEMONSTRATION build (fictional data only).
//   1. VITE_APP_MODE=demo npm run dev -- --port 5185
//   2. node scripts/guide-screenshots.mjs            (French, docs/guide/)
//      GUIDE_LANG=en node scripts/guide-screenshots.mjs  (English, docs/guide/en/; es for Spanish)
// Drives a headless Chrome over the DevTools protocol; no extra dependency. Elements are reached by
// their structure, never by their text, so the same steps work in every language. Node 22.18 or
// later reads the TypeScript dictionaries directly.
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { en } from '../src/i18n/en.ts';
import { es } from '../src/i18n/es.ts';
import { fr } from '../src/i18n/fr.ts';

const URL_APP = process.env.GUIDE_URL ?? 'http://127.0.0.1:5185/';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const LANG = process.env.GUIDE_LANG ?? 'fr';
const WORDS = { fr, en, es }[LANG];
if (!WORDS) throw new Error(`GUIDE_LANG inconnu : ${LANG} (fr, en ou es)`);
const OUT = resolve(import.meta.dirname, '../../docs/guide', LANG === 'fr' ? '' : LANG);
const PORT = 9337;
const sleep = ms => new Promise(done => setTimeout(done, ms));

const profile = await mkdtemp(join(tmpdir(), 'apisnix-guide-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars',
  '--mute-audio', '--no-first-run', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

let socket, nextId = 0;
const pending = new Map();
async function connect() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find(target => target.type === 'page');
      if (page) { socket = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* Chrome is still starting */ }
    await sleep(200);
  }
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  };
}
const send = (method, params = {}) => new Promise((done, fail) => {
  const id = ++nextId;
  pending.set(id, message => (message.error ? fail(new Error(method + ': ' + message.error.message)) : done(message.result)));
  socket.send(JSON.stringify({ id, method, params }));
});
const run = async expression => {
  const result = await send('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? 'page script failed');
  return result.result.value;
};
const viewport = (width, height, mobile = false) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1.5, mobile });
async function shot(name, selector) {
  await sleep(450);
  let clip;
  if (selector) {
    // A stretched column is cropped to what it really contains.
    const box = await run(`const el = document.querySelector(${JSON.stringify(selector)}); const r = el.getBoundingClientRect(); const last = el.lastElementChild?.getBoundingClientRect(); const bottom = last && el.classList.contains('dock') ? Math.min(r.bottom, last.bottom) : r.bottom; return { x: r.x, y: r.y, width: r.width, height: bottom - r.y };`);
    clip = { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 12), width: box.width + 24, height: box.height + 24, scale: 1 };
  }
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip });
  await writeFile(join(OUT, name + '.png'), Buffer.from(data, 'base64'));
  console.log('✓', name);
}

// Helpers living in the page.
const HELPERS = `
  window.__type = (selector, value) => { const el = document.querySelector(selector);
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true })); };
  window.__nav = view => document.querySelector('.nav-' + view + ' .nav-item').click();
  window.__click = (selector, index = 0) => document.querySelectorAll(selector)[index].click();
  window.__text = (selector, text) => [...document.querySelectorAll(selector)].find(b => b.textContent.trim() === text).click();
  window.__wait = ms => new Promise(done => setTimeout(done, ms));`;

try {
  await mkdir(OUT, { recursive: true });
  await connect();
  await send('Page.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await viewport(1440, 900);
  await send('Page.navigate', { url: URL_APP });
  await sleep(1500);
  // The language is the one a person would pick on the sign-in screen, remembered by the browser.
  await run(`localStorage.setItem('apisnixphone.theme', 'light'); localStorage.setItem('apisnixphone.language', ${JSON.stringify(LANG)}); location.reload(); return true;`);
  await sleep(1500);
  await run(HELPERS + 'return true;');

  await shot('01-connexion');
  await run(`__type('.login input[autocomplete=username]', 'camille'); __type('.login input[type=password]', 'demonstration'); document.querySelector('.login form').requestSubmit(); await __wait(2200);`);
  await shot('02-journal');

  await run(`__type('#dial-input', '+33 1 00 00 00 01');`);
  await shot('03-composer', '.dock');

  await run(`__click('.call-button'); await __wait(1500);`);
  await shot('04-sonnerie', '.call-card');
  await run(`await __wait(2600);`);
  await shot('05-en-appel', '.call-card');
  await run(`__click('.call-controls .control', 0); __click('.call-controls .control', 1); await __wait(900);`);
  await shot('06-muet-attente', '.call-card');
  await run(`__click('.call-controls .control', 1); await __wait(800); document.querySelector('.hangup').click(); await __wait(500); __click('.wrapup .tags .tag');
    __type('.wrapup .note', ${JSON.stringify(WORDS['demo.noteQuote'])}); __click('.wrapup > .ghost-call'); await __wait(300);`);
  await shot('07-fin-appel', '.call-card');
  await run(`__text('.scheduler .tag', ${JSON.stringify(WORDS['quick.tomorrow'])}); await __wait(400); __click('.wrapup-actions .done'); await __wait(400);`);

  await run(`document.querySelector('.call-summary').click(); await __wait(400);`);
  await shot('08-journal-detail');
  await run(`document.querySelector('.call-summary').click();`);

  await run(`__nav('settings'); await __wait(400); document.querySelector('.settings-section .lucide-phone-incoming').closest('button').click(); await __wait(900);`);
  await shot('09-appel-entrant', '.call-card');
  await run(`document.querySelector('.round.decline').click(); await __wait(400); __click('.wrapup-actions .done'); await __wait(300);`);

  // Contacts, favourites, search and the dark theme are no longer in the short guide: no capture.
  await run(`__nav('journal'); await __wait(150); __click('.journal-sections button', 1); await __wait(400);`);
  await shot('12-rappels');
  await run(`__nav('settings'); await __wait(400);`);
  await shot('13-reglages');
  await run(`document.querySelector('.ringtones').scrollIntoView({ block: 'center' }); await __wait(200);`);
  await shot('19-sonneries', '.ringtones');

  await run(`__nav('audio'); await __wait(500);`);
  await shot('18-audio');
  await run(`__nav('journal'); await __wait(300);`);

  await viewport(390, 844, true);
  await sleep(500);
  await shot('16-mobile-journal');
  await run(`document.querySelector('.nav-phone .nav-item').click(); await __wait(400);`);
  await shot('17-mobile-telephone');
} finally {
  socket?.close();
  chrome.kill();
  await sleep(300);
  await rm(profile, { recursive: true, force: true }).catch(() => undefined);
}
