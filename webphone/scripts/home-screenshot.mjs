// The guide's first capture: the cards of the public home page https://apisnix-crm.com, the one leading
// to ApisnixPhone (« Connexion SIP ») framed in red, as in the agent manual. One per language (?lang=).
//   node scripts/home-screenshot.mjs      → docs/guide/00-accueil.png, en/ and es/
// Reads the live public page only: no sign-in, nothing sent. Same DevTools approach as guide-screenshots.mjs.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DOCS = resolve(import.meta.dirname, '../../docs/guide');
const PORT = 9338;
const sleep = ms => new Promise(done => setTimeout(done, ms));

const profile = await mkdtemp(join(tmpdir(), 'apisnix-home-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--hide-scrollbars',
  '--no-first-run', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });

let socket, nextId = 0;
const pending = new Map();
for (let attempt = 0; attempt < 50 && !socket; attempt++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const page = targets.find(target => target.type === 'page');
    if (page) socket = new WebSocket(page.webSocketDebuggerUrl);
  } catch { /* starting */ }
  if (!socket) await sleep(200);
}
await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
socket.onmessage = event => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
};
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

try {
  await send('Page.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
  for (const lang of ['fr', 'en', 'es']) {
    await send('Page.navigate', { url: `https://apisnix-crm.com/?lang=${lang}` });
    await sleep(2500);
    const box = await run(`
      const card = document.querySelector('.card.phone');
      card.style.outline = '4px solid #e2231a'; card.style.outlineOffset = '4px';
      card.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 400));
      const grid = card.parentElement.getBoundingClientRect();
      return { x: grid.x + scrollX, y: grid.y + scrollY, width: grid.width, height: grid.height, label: card.querySelector('strong').textContent, go: card.querySelector('.go').textContent };`);
    const pad = 14;
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad, scale: 1 } });
    const out = join(DOCS, lang === 'fr' ? '' : lang, '00-accueil.png');
    await writeFile(out, Buffer.from(data, 'base64'));
    console.log('✓', lang, out, JSON.stringify({ label: box.label, go: box.go }));
  }
} finally {
  socket.close();
  chrome.kill();
  await sleep(300);
  await rm(profile, { recursive: true, force: true });
}
