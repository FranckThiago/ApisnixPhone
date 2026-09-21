// Builds docs/ApisnixPhone-Guide-utilisateur.pdf from docs/GUIDE_UTILISATEUR.md and its screenshots.
//   node scripts/build-guide-pdf.mjs
// Headless Chrome prints a branded HTML rendering; no extra dependency.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DOCS = resolve(import.meta.dirname, '../../docs');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9338;
const sleep = ms => new Promise(done => setTimeout(done, ms));

const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = text => escape(text)
  // Phone-panel captures are tall and narrow: keep them small so the text stays on the same page.
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img class="${/\/07-/.test(src) ? 'tall' : /\/(0[3-69]|16|17)-/.test(src) ? 'portrait' : ''}" src="${pathToFileURL(join(DOCS, src))}" alt="${alt}">`)
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

/** Converts the small Markdown subset the guide uses: headings, paragraphs, lists, tables, quotes, images. */
function toHtml(markdown) {
  const lines = markdown.split('\n');
  const html = [];
  let index = 0;
  const gather = test => { const block = []; while (index < lines.length && test(lines[index])) block.push(lines[index++]); return block; };
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) { html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); index++; continue; }
    if (line.startsWith('|')) {
      const rows = gather(l => l.startsWith('|')).map(row => row.slice(1, -1).split('|').map(cell => cell.trim()));
      const [head, , ...body] = rows;
      const gallery = body.every(row => row.every(cell => cell.startsWith('![')));
      html.push(`<table class="${gallery ? 'gallery' : ''}"><thead><tr>${head.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>`
        + body.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('') + '</tbody></table>');
      continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (index < lines.length && (lines[index].startsWith('- ') || lines[index].startsWith('  '))) {
        if (lines[index].startsWith('- ')) items.push(lines[index].slice(2)); else items[items.length - 1] += ' ' + lines[index].trim();
        index++;
      }
      html.push('<ul>' + items.map(item => `<li>${inline(item)}</li>`).join('') + '</ul>');
      continue;
    }
    if (line.startsWith('>')) { html.push(`<blockquote>${inline(gather(l => l.startsWith('>')).map(l => l.replace(/^> ?/, '')).join(' '))}</blockquote>`); continue; }
    const paragraph = gather(l => l.trim() && !/^(#{1,3} |\||- |>)/.test(l)).join(' ');
    const image = /^!\[[^\]]*\]\([^)]+\)$/.test(paragraph);
    html.push(image ? `<figure>${inline(paragraph)}</figure>` : `<p>${inline(paragraph)}</p>`);
  }
  return html.join('\n');
}

const markdown = await readFile(join(DOCS, 'GUIDE_UTILISATEUR.md'), 'utf8');
const [, ...rest] = markdown.split('\n');
const intro = rest.join('\n').split('\n## ')[0];
const body = '## ' + rest.join('\n').split('\n## ').slice(1).join('\n## ');
const version = /Version décrite : ([^.\n]+(?:\.\d+)*)/.exec(markdown)?.[1] ?? 'ApisnixPhone Web';
const today = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
const logo = pathToFileURL(resolve(DOCS, '../branding/apisnix-mark.png'));

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>ApisnixPhone — guide d’utilisation</title><style>
  @page { size: A4; margin: 17mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 10.6pt/1.55 -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif; color: #141d38; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cover { height: 258mm; display: flex; flex-direction: column; justify-content: center; padding: 0 14mm; border-radius: 6mm; color: #fff; page-break-after: always;
    background: radial-gradient(70% 50% at 15% 8%, #2a3cffaa, transparent 70%), radial-gradient(60% 45% at 95% 95%, #ffd21f40, transparent 70%), #0b1230; }
  .cover img { width: 30mm; height: 30mm; padding: 3mm; border-radius: 7mm; background: #fff; box-shadow: 0 0 0 1mm #ffd21f; }
  .cover h1 { font-size: 34pt; line-height: 1.08; letter-spacing: -1pt; margin: 12mm 0 4mm; border: 0; }
  .cover h1 span { background: linear-gradient(transparent 78%, #ffd21f 78%, #ffd21f 92%, transparent 92%); }
  .cover p { font-size: 13pt; color: #c5ccea; max-width: 120mm; margin: 0 0 3mm; }
  .cover small { margin-top: 22mm; font-size: 10pt; color: #ffd21f; letter-spacing: .6pt; }
  .intro { padding: 4mm 5mm; border-radius: 3mm; background: #fff7d6; border-left: 1.2mm solid #f2b900; margin-bottom: 6mm; }
  .intro p { margin: 0 0 2mm; } .intro p:last-child { margin: 0; }
  h2 { font-size: 16pt; letter-spacing: -.3pt; margin: 9mm 0 3mm; padding-bottom: 1.5mm; border-bottom: .8mm solid #ffd21f; color: #0b1230; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 6mm 0 2mm; page-break-after: avoid; }
  p { margin: 0 0 3mm; } ul { margin: 0 0 3mm; padding-left: 5mm; } li { margin-bottom: 1.2mm; }
  strong { color: #0b1230; } code { font: 9.5pt ui-monospace, Menlo, monospace; padding: .3mm 1.2mm; border-radius: 1mm; background: #eef0ff; color: #1010ff; }
  figure { margin: 4mm 0 5mm; text-align: center; page-break-inside: avoid; }
  img { max-width: 100%; max-height: 118mm; border-radius: 2.5mm; border: .3mm solid #e4e8f2; box-shadow: 0 1.5mm 5mm #10184018; }
  img.portrait { max-height: 92mm; } img.tall { max-height: 150mm; } table.gallery img.portrait { max-height: 105mm; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 9.6pt; page-break-inside: avoid; }
  th { text-align: left; background: #0b1230; color: #fff; padding: 2mm 2.5mm; font-weight: 600; } th:first-child { border-radius: 1.5mm 0 0 0; } th:last-child { border-radius: 0 1.5mm 0 0; }
  td { padding: 2mm 2.5mm; border-bottom: .3mm solid #e4e8f2; vertical-align: top; } tr:nth-child(even) td { background: #f8f9fd; }
  table.gallery th { background: none; color: #5f6b86; text-align: center; } table.gallery td { border: 0; background: none !important; text-align: center; width: 50%; } table.gallery img { max-height: 125mm; }
  blockquote { margin: 3mm 0 5mm; padding: 3.5mm 5mm; border-radius: 3mm; background: #eef0ff; border-left: 1.2mm solid #1010ff; page-break-inside: avoid; }
</style></head><body>
  <section class="cover"><img src="${logo}" alt="APISNIX"><h1>ApisnixPhone<br><span>Guide d’utilisation</span></h1>
    <p>Votre téléphone professionnel dans le navigateur : rien à installer, vous ouvrez la page, vous vous connectez, vous appelez.</p>
    <small>${escape(version)} · ${escape(today)} · APISNIX</small></section>
  <div class="intro">${toHtml(intro)}</div>
  ${toHtml(body)}
</body></html>`;

const work = await mkdtemp(join(tmpdir(), 'apisnix-guide-pdf-'));
const htmlPath = join(work, 'guide.html');
await writeFile(htmlPath, page);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(work, 'profile')}`, '--no-first-run',
  '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
let socket;
try {
  for (let attempt = 0; attempt < 50 && !socket; attempt++) {
    try {
      const target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(item => item.type === 'page');
      if (target) socket = new WebSocket(target.webSocketDebuggerUrl);
    } catch { await sleep(200); }
  }
  await new Promise((done, fail) => { socket.onopen = done; socket.onerror = fail; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => { const message = JSON.parse(event.data); pending.get(message.id)?.(message); pending.delete(message.id); };
  const send = (method, params = {}) => new Promise((done, fail) => {
    pending.set(++id, message => (message.error ? fail(new Error(message.error.message)) : done(message.result)));
    socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(htmlPath).href });
  await sleep(2500);
  const broken = await send('Runtime.evaluate', { expression: '[...document.images].filter(i => !i.complete || !i.naturalWidth).length', returnByValue: true });
  if (broken.result.value) throw new Error(`${broken.result.value} image(s) introuvable(s)`);
  const { data } = await send('Page.printToPDF', {
    printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font:8pt -apple-system,Arial;color:#8f99b0;padding:0 16mm;display:flex;justify-content:space-between"><span>ApisnixPhone — guide d’utilisation</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  const output = join(DOCS, 'ApisnixPhone-Guide-utilisateur.pdf');
  await writeFile(output, Buffer.from(data, 'base64'));
  console.log('✓', output, Math.round(Buffer.from(data, 'base64').length / 1024) + ' Ko');
} finally {
  socket?.close();
  chrome.kill();
  await sleep(300);
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
}
