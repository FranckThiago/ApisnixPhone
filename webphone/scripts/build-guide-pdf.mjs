// Builds docs/ApisnixPhone-Guide-utilisateur.pdf from docs/GUIDE_UTILISATEUR.md and its screenshots.
//   node scripts/build-guide-pdf.mjs
// Headless Chrome prints a branded HTML rendering; no extra dependency. When poppler's pdftotext is
// installed, a second pass writes the page numbers into the cover's table of contents.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const DOCS = resolve(import.meta.dirname, '../../docs');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9338;
const OUTPUT = join(DOCS, 'ApisnixPhone-Guide-utilisateur.pdf');
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)(?: "([^"]*)")?\)/g;
const sleep = ms => new Promise(done => setTimeout(done, ms));

const markdown = (await readFile(join(DOCS, 'GUIDE_UTILISATEUR.md'), 'utf8')).replace(/<!--[\s\S]*?-->\n*/g, '');

// Screenshot shape decides its size: desktop captures are wide, phone-panel captures portrait or tall.
const shapes = new Map();
for (const [, , src] of markdown.matchAll(IMAGE)) {
  const png = await readFile(join(DOCS, src));
  const ratio = png.readUInt32BE(16) / png.readUInt32BE(20);
  shapes.set(src, ratio > 1.2 ? 'wide' : ratio < 0.55 ? 'tall' : 'portrait');
}

const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const image = (alt, src, height) => `<img class="${shapes.get(src)}"${height ? ` style="height:${height}mm;width:auto;max-height:none"` : ''} src="${pathToFileURL(join(DOCS, src))}" alt="${escape(alt)}">`;
const inline = text => escape(text)
  // French spacing: guillemets and : ; ? ! never end up alone at a line edge.
  .replace(/« /g, '« ').replace(/ ([»:;?!])/g, ' $1')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/`([^`]+)`/g, '<code>$1</code>');

/** Splits the small Markdown subset the guide uses into headings, image lines and ready HTML blocks. */
function toBlocks(source) {
  const lines = source.split('\n');
  const blocks = [];
  let index = 0;
  const gather = test => { const block = []; while (index < lines.length && test(lines[index])) block.push(lines[index++]); return block; };
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    const heading = /^(#{1,3}) (.+)$/.exec(line);
    if (heading) { blocks.push({ heading: heading[2], level: heading[1].length }); index++; continue; }
    if (line.startsWith('|')) {
      const [head, , ...body] = gather(l => l.startsWith('|')).map(row => row.slice(1, -1).split('|').map(cell => cell.trim()));
      blocks.push({ html: `<table><thead><tr>${head.map(cell => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>`
        + body.map(row => `<tr>${row.map(cell => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('') + '</tbody></table>' });
      continue;
    }
    if (line.startsWith('- ')) {
      const items = [];
      while (index < lines.length && (lines[index].startsWith('- ') || lines[index].startsWith('  '))) {
        if (lines[index].startsWith('- ')) items.push(lines[index].slice(2)); else items[items.length - 1] += ' ' + lines[index].trim();
        index++;
      }
      blocks.push({ html: '<ul>' + items.map(item => `<li>${inline(item)}</li>`).join('') + '</ul>' });
      continue;
    }
    if (line.startsWith('>')) { blocks.push({ html: `<blockquote>${inline(gather(l => l.startsWith('>')).map(l => l.replace(/^> ?/, '')).join(' '))}</blockquote>` }); continue; }
    const paragraph = gather(l => l.trim() && !/^(#{1,3} |\||- |>)/.test(l)).join(' ');
    if (!paragraph.replace(IMAGE, '').trim()) { blocks.push({ images: [...paragraph.matchAll(IMAGE)].map(([, alt, src, title]) => ({ alt, src, title })) }); continue; }
    blocks.push({ html: `<p>${inline(paragraph)}</p>` });
  }
  return blocks;
}

/**
 * An image line titled "gauche" or "droite" takes that side; the text up to the next heading or image sits beside it.
 * A height in the title ("gauche 90mm", "60mm") overrides the default size of every image on the line.
 */
function toHtml(source) {
  const blocks = toBlocks(source);
  const html = [];
  for (let index = 0; index < blocks.length; index++) {
    const { heading, level, images, html: block } = blocks[index];
    if (heading) { html.push(`<h${level}${level === 2 ? ` id="s${sections.indexOf(heading)}"` : ''}>${inline(heading)}</h${level}>`); continue; }
    if (!images) { html.push(block); continue; }
    const [, place, height] = /^(gauche|droite)? ?(?:(\d+)mm)?$/.exec(images[0].title ?? '') ?? [];
    const figure = images.length === 1 ? `<figure>${image(images[0].alt, images[0].src, height)}</figure>`
      : `<figure class="row">${images.map(({ alt, src }) => `<div>${image(alt, src, height)}<figcaption>${escape(alt)}</figcaption></div>`).join('')}</figure>`;
    const side = { gauche: 'left', droite: 'right' }[place];
    if (!side) { html.push(figure); continue; }
    const text = [];
    while (blocks[index + 1]?.html) text.push(blocks[++index].html);
    html.push(`<div class="split ${side}">${figure}<div class="text">${text.join('')}</div></div>`);
  }
  return html.join('\n');
}

const [, ...rest] = markdown.split('\n');
const intro = rest.join('\n').split('\n## ')[0];
const body = '## ' + rest.join('\n').split('\n## ').slice(1).join('\n## ');
const sections = [...body.matchAll(/^## (.+)$/gm)].map(match => match[1]);
const version = /Version décrite : ([^.\n]+(?:\.\d+)*)/.exec(markdown)?.[1] ?? 'ApisnixPhone Web';
const today = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
const logo = pathToFileURL(resolve(DOCS, '../branding/apisnix-mark.png'));

const contents = pages => sections.map((title, index) => {
  const [, number, name] = /^(?:(\d+)\. )?(.+)$/.exec(title);
  return `<a href="#s${index}"><span class="n">${number ?? '•'}</span><span class="t">${inline(name)}</span><span class="p">${pages?.[index] ?? ''}</span></a>`;
}).join('');

const page = pages => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>ApisnixPhone — guide d’utilisation</title><style>
  @page { size: A4; margin: 17mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 10.6pt/1.55 -apple-system, "Helvetica Neue", "Segoe UI", Arial, sans-serif; color: #141d38; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cover { height: 258mm; display: flex; flex-direction: column; justify-content: space-between; padding: 20mm 14mm 12mm; border-radius: 6mm; color: #fff; page-break-after: always;
    background: radial-gradient(70% 50% at 15% 8%, #2a3cffaa, transparent 70%), radial-gradient(60% 45% at 95% 95%, #ffd21f40, transparent 70%), #0b1230; }
  .cover img { width: 30mm; height: 30mm; padding: 3mm; border-radius: 7mm; background: #fff; box-shadow: 0 0 0 1mm #ffd21f; }
  .cover h1 { font-size: 34pt; line-height: 1.08; letter-spacing: -1pt; margin: 12mm 0 4mm; border: 0; }
  .cover h1 span { background: linear-gradient(transparent 78%, #ffd21f 78%, #ffd21f 92%, transparent 92%); }
  .cover p { font-size: 13pt; color: #c5ccea; max-width: 120mm; margin: 0 0 8mm; }
  .cover small { font-size: 10pt; color: #ffd21f; letter-spacing: .6pt; }
  .toc { padding: 5mm 6mm 4mm; border-radius: 4mm; background: #ffffff12; border: .3mm solid #ffffff22; }
  .toc h2 { margin: 0 0 3mm; padding: 0; border: 0; color: #ffd21f; font-size: 10pt; letter-spacing: 1.2pt; text-transform: uppercase; }
  .toc nav { columns: 2; column-gap: 10mm; }
  .toc a { display: flex; align-items: baseline; gap: 2.5mm; padding: 1.3mm 0; border-bottom: .2mm dotted #ffffff30; color: #fff; text-decoration: none; font-size: 10.2pt; break-inside: avoid; }
  .toc .n { width: 5mm; color: #ffd21f; font-weight: 700; text-align: right; } .toc .t { flex: 1; } .toc .p { color: #c5ccea; font-variant-numeric: tabular-nums; }
  .intro { padding: 4mm 5mm; border-radius: 3mm; background: #fff7d6; border-left: 1.2mm solid #f2b900; margin-bottom: 6mm; }
  .intro p { margin: 0 0 2mm; } .intro p:last-child { margin: 0; }
  h2 { font-size: 16pt; letter-spacing: -.3pt; margin: 8mm 0 3mm; padding-bottom: 1.5mm; border-bottom: .8mm solid #ffd21f; color: #0b1230; page-break-after: avoid; }
  h3 { font-size: 12pt; margin: 6mm 0 2mm; page-break-after: avoid; }
  p { margin: 0 0 3mm; } ul { margin: 0 0 3mm; padding-left: 5mm; } li { margin-bottom: 1.2mm; }
  strong { color: #0b1230; } code { font: 9.5pt ui-monospace, Menlo, monospace; padding: .3mm 1.2mm; border-radius: 1mm; background: #eef0ff; color: #1010ff; }
  figure { margin: 4mm 0 5mm; text-align: center; page-break-inside: avoid; }
  img { max-width: 100%; max-height: 118mm; border-radius: 2.5mm; border: .3mm solid #e4e8f2; box-shadow: 0 1.5mm 5mm #10184018; }
  figure.row { display: flex; justify-content: center; gap: 5mm; } figure.row img { height: 64mm; max-height: none; }
  figcaption { margin-top: 1.5mm; font-size: 8.8pt; color: #5f6b86; }
  .split { display: flex; align-items: center; gap: 7mm; margin: 2mm 0 4mm; page-break-inside: avoid; }
  .split.right { flex-direction: row-reverse; }
  .split figure { flex: none; margin: 0; } .split .text { flex: 1; min-width: 0; } .split .text > :last-child { margin-bottom: 0; }
  .split img.wide { width: 94mm; } .split img.portrait { height: 76mm; } .split img.tall { height: 96mm; } .split figure.row img { height: 66mm; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0 5mm; font-size: 9.6pt; page-break-inside: avoid; }
  th { text-align: left; background: #0b1230; color: #fff; padding: 2mm 2.5mm; font-weight: 600; } th:first-child { border-radius: 1.5mm 0 0 0; } th:last-child { border-radius: 0 1.5mm 0 0; }
  td { padding: 2mm 2.5mm; border-bottom: .3mm solid #e4e8f2; vertical-align: top; } tr:nth-child(even) td { background: #f8f9fd; }
  td:first-child { width: 38%; }
  blockquote { margin: 3mm 0 5mm; padding: 3.5mm 5mm; border-radius: 3mm; background: #eef0ff; border-left: 1.2mm solid #1010ff; page-break-inside: avoid; }
</style></head><body>
  <section class="cover"><div><img src="${logo}" alt="APISNIX"><h1>ApisnixPhone<br><span>Guide d’utilisation</span></h1>
    <p>Votre téléphone professionnel dans le navigateur : rien à installer, vous ouvrez la page, vous vous connectez, vous appelez.</p>
    <small>${escape(version)} · ${escape(today)} · APISNIX</small></div>
    <div class="toc"><h2>Sommaire</h2><nav>${contents(pages)}</nav></div></section>
  <div class="intro">${toHtml(intro)}</div>
  ${toHtml(body)}
</body></html>`;

/** Finds the page of each section heading in the printed PDF, or null without pdftotext. */
function sectionPages(pdf) {
  const result = spawnSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  const printed = result.stdout.split('\f').map(text => text.normalize('NFKC').replace(/[’]/g, "'").replace(/\s+/g, ' '));
  // The cover lists every title, so the search starts on the second page.
  return sections.map(title => {
    const found = printed.findIndex((text, index) => index > 0 && text.includes(title.replace(/[’]/g, "'")));
    return found > 0 ? found + 1 : '';
  });
}

const work = await mkdtemp(join(tmpdir(), 'apisnix-guide-pdf-'));
const htmlPath = join(work, 'guide.html');
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
  const print = async html => {
    await writeFile(htmlPath, html);
    await send('Page.navigate', { url: pathToFileURL(htmlPath).href });
    await sleep(2500);
    const broken = await send('Runtime.evaluate', { expression: '[...document.images].filter(i => !i.complete || !i.naturalWidth).length', returnByValue: true });
    if (broken.result.value) throw new Error(`${broken.result.value} image(s) introuvable(s)`);
    const { data } = await send('Page.printToPDF', {
      printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;font:8pt -apple-system,Arial;color:#8f99b0;padding:0 16mm;display:flex;justify-content:space-between"><span>ApisnixPhone — guide d’utilisation</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    });
    await writeFile(OUTPUT, Buffer.from(data, 'base64'));
  };
  // Placeholder numbers keep the cover the same size in both passes.
  await print(page(sections.map(() => '00')));
  const pages = sectionPages(OUTPUT);
  if (pages) await print(page(pages)); else { await print(page(null)); console.warn('pdftotext absent : sommaire sans numéros de page'); }
  console.log('✓', OUTPUT, Math.round((await readFile(OUTPUT)).length / 1024) + ' Ko', pages ? `· sommaire p. ${pages.join(', ')}` : '');
} finally {
  socket?.close();
  chrome.kill();
  await sleep(300);
  await rm(work, { recursive: true, force: true }).catch(() => undefined);
}
