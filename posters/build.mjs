// Renders an event poster to a 2000 x 2000 PNG.
//
//   cd posters && npm install && node build.mjs events/pub-night-2.json
//
// The poster is plain HTML and CSS, screenshotted with headless Chromium
// (Playwright). Everything that changes between events lives in the JSON
// file; this script only knows the layout.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import QRCode from 'qrcode';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const eventFile = resolve(process.argv[2] ?? 'events/pub-night-2.json');
const ev = JSON.parse(readFileSync(eventFile, 'utf8'));
const url = (p) => pathToFileURL(resolve(here, p)).href;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// --- QR code: the modules as one SVG path, so it stays sharp at any size ---
const qr = QRCode.create(ev.rsvpUrl, { errorCorrectionLevel: 'M' });
const n = qr.modules.size;
let qrPath = '';
for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.modules.get(x, y)) qrPath += `M${x} ${y}h1v1h-1z`;

const font = (pkg, file) => pathToFileURL(resolve(dirname(require.resolve(`${pkg}/package.json`)), 'files', file)).href;
const face = (family, pkg, file, weight = 400, style = 'normal') =>
  `@font-face{font-family:'${family}';src:url('${font(pkg, file)}') format('woff2');font-weight:${weight};font-style:${style};}`;

const a = ev.art;
const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
${face('Marcellus', '@fontsource/marcellus', 'marcellus-latin-400-normal.woff2')}
${face('Marcellus SC', '@fontsource/marcellus-sc', 'marcellus-sc-latin-400-normal.woff2')}
${face('Spectral', '@fontsource/spectral', 'spectral-latin-400-normal.woff2')}
${face('Spectral', '@fontsource/spectral', 'spectral-latin-400-italic.woff2', 400, 'italic')}
${face('IBM Plex Sans', '@fontsource/ibm-plex-sans', 'ibm-plex-sans-latin-400-normal.woff2')}
${face('IBM Plex Sans', '@fontsource/ibm-plex-sans', 'ibm-plex-sans-latin-500-normal.woff2', 500)}
${face('IBM Plex Sans', '@fontsource/ibm-plex-sans', 'ibm-plex-sans-latin-600-normal.woff2', 600)}
:root{--ink:#0f0f10;--parchment:#f1ece2;--soft:#c6c0b6;--muted:#9a948b;--ember:#e8822f;
  --line:rgba(232,227,218,.16);--display:'Marcellus SC',serif;--title:'Marcellus',serif;
  --text:'Spectral',Georgia,serif;--info:'IBM Plex Sans',sans-serif;}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:2000px;height:2000px;background:var(--ink);color:var(--parchment);overflow:hidden}
.poster{position:relative;width:2000px;height:2000px;overflow:hidden;background:var(--ink)}

/* A blurred, enlarged copy of the art tints the dark ground with the
   painting's own sea colours, so the sharp copy has something to fade into. */
.wash{position:absolute;inset:-120px;background:url('${url(a.file)}') ${a.washPosition ?? '50% 35%'}/cover;
  filter:blur(70px) saturate(1.15) brightness(.5);opacity:.75}
/* The sharp art. The card scan is cropped to the painting by positioning it
   inside a clipping box; the mask fades it out to the right and bottom. */
.art{position:absolute;left:${a.left}px;top:${a.top}px;width:${a.boxW}px;height:${a.boxH}px;overflow:hidden;
  -webkit-mask-image:linear-gradient(to right,#000 ${a.fadeRightFrom}%,transparent 100%),linear-gradient(to bottom,#000 ${a.fadeBottomFrom}%,transparent 100%);
  -webkit-mask-composite:source-in;mask-composite:intersect}
.art img{position:absolute;left:${-a.cropX * a.scale}px;top:${-a.cropY * a.scale}px;width:${a.srcW * a.scale}px;
  filter:saturate(1.06) contrast(1.04)}
.shade{position:absolute;inset:0;background:
  linear-gradient(to bottom,rgba(15,15,16,.7) 0,rgba(15,15,16,0) 190px),
  linear-gradient(to bottom,rgba(15,15,16,0) 1090px,rgba(15,15,16,.9) 1275px,var(--ink) 1420px),
  linear-gradient(to right,rgba(15,15,16,0) 800px,rgba(15,15,16,.5) 1200px,rgba(15,15,16,.62) 2000px)}
.grain{position:absolute;inset:0;opacity:.11;mix-blend-mode:overlay}
.frame{position:absolute;inset:44px;border:1px solid rgba(232,227,218,.2)}

.head{position:absolute;top:8px;left:0;right:0;display:flex;justify-content:center}
.head div{display:flex;align-items:center;gap:22px;background:var(--ink);padding:0 44px;border-radius:40px;
  font:400 40px/72px var(--display);letter-spacing:.03em}
.head img{height:62px}

.title{position:absolute;left:1040px;top:118px;width:860px;text-align:center}
.title .logo{width:800px;display:block;margin:0 auto 26px;filter:drop-shadow(0 14px 30px rgba(0,0,0,.6))}
.title .at{font:400 108px/1 var(--title);letter-spacing:.14em;color:var(--ember);text-transform:uppercase;
  text-shadow:0 4px 24px rgba(0,0,0,.6)}
.title .pub{font:400 380px/.86 var(--title);letter-spacing:.01em;text-transform:uppercase;margin-top:6px;
  text-shadow:0 8px 40px rgba(0,0,0,.55)}
.title .pub small{font-size:.8em}
.round{display:flex;align-items:center;justify-content:center;gap:26px;margin-top:30px;
  font:400 58px/1 var(--display);letter-spacing:.3em;color:var(--parchment)}
.round i{flex:0 0 90px;height:1px;background:rgba(232,227,218,.45)}
.round b{font-weight:400;color:var(--ember);letter-spacing:.06em}
.tag{margin-top:36px;font:600 36px/1.5 var(--info);letter-spacing:.24em;text-transform:uppercase}
.tag em{font-style:normal;color:var(--ember)}
.quote{margin:26px auto 0;width:720px;font:italic 400 33px/1.4 var(--text);color:var(--soft)}

.info{position:absolute;left:134px;right:134px;top:1254px;display:grid;grid-template-columns:1fr 1.32fr 1fr;
  border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.info>div{padding:34px 0 36px 42px;border-left:1px solid var(--line)}
.info>div:first-child{padding-left:0;border-left:0}
.k{font:500 23px/1 var(--info);letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}
.v{font:400 54px/1.12 var(--display);margin-top:20px}
.s{font:400 28px/1.3 var(--info);color:var(--soft);margin-top:16px}
.s em{font-style:normal;font-weight:600;color:var(--ember)}

.rsvp{position:absolute;left:134px;top:1602px;display:flex;gap:54px;align-items:center}
.qr{width:272px;height:272px;border-radius:20px;background:#f4f0e8;padding:22px;flex:none}
.qr svg{display:block;width:100%;height:100%}
.rsvp h2{font:400 58px/1.05 var(--display)}
.rsvp p{font:400 35px/1.3 var(--text);color:var(--soft);margin-top:12px}
.chips{display:flex;gap:14px;margin-top:20px}
.chips span{font:500 23px/1 var(--info);letter-spacing:.14em;text-transform:uppercase;color:var(--parchment);
  border:1px solid rgba(232,227,218,.32);border-radius:40px;padding:12px 20px}
.chips span.hot{color:var(--ember);border-color:rgba(232,130,47,.6)}
.discord{display:flex;align-items:center;gap:26px;margin-top:22px;font:400 31px/1 var(--text);color:var(--muted)}
.discord b{font:500 31px/1 var(--info);color:#17171a;background:#f1ece2;border-radius:40px;padding:17px 34px}

.collab{position:absolute;right:120px;top:1612px;width:420px;text-align:center;white-space:nowrap}
.collab div{font:500 21px/1 var(--info);letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
.collab img{display:block;width:236px;margin:14px auto 0;filter:drop-shadow(0 8px 22px rgba(0,0,0,.6))}
.credit{position:absolute;left:134px;bottom:68px;font:400 19px/1 var(--info);letter-spacing:.03em;color:#77726b}
</style></head><body><div class="poster">
  <div class="wash"></div>
  <div class="art"><img src="${url(a.file)}" alt=""></div>
  <div class="shade"></div>
  <svg class="grain" width="2000" height="2000"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 1.4 -.25"/></filter><rect width="2000" height="2000" filter="url(#g)"/></svg>
  <div class="frame"></div>

  <div class="head"><div><img src="${url('../public/art/sta-emblem.png')}" alt="">Sorcery TCG Australia</div></div>

  <div class="title">
    <img class="logo" src="${url('art/sorcery-logo.png')}" alt="Sorcery: Contested Realm">
    <div class="at">at the</div>
    <div class="pub">P<small>ub</small></div>
    <div class="round"><i></i><span>${esc(ev.city)}</span><b>${esc(ev.edition)}</b><i></i></div>
    <div class="tag">${ev.taglineHtml}</div>
    <div class="quote">${esc(ev.quote)}</div>
  </div>


  <div class="info">
    ${ev.columns.map((c) => `<div><div class="k">${esc(c.label)}</div><div class="v">${c.valueHtml}</div><div class="s">${c.noteHtml}</div></div>`).join('')}
  </div>

  <div class="rsvp">
    <div class="qr"><svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><path d="${qrPath}" fill="#141415"/></svg></div>
    <div>
      <h2>${esc(ev.rsvpTitle)}</h2>
      <p>${esc(ev.rsvpNote)}</p>
      <div class="chips">${ev.chips.map((c, i) => `<span class="${i === 0 ? 'hot' : ''}">${esc(c)}</span>`).join('')}</div>
      <div class="discord">Or join us on Discord <b>${esc(ev.discord)}</b></div>
    </div>
  </div>

  ${ev.partner ? `<div class="collab"><div>In collaboration with</div><img src="${url(ev.partner.logo)}" alt="${esc(ev.partner.name)}"></div>` : ''}

  <div class="credit">${esc(ev.credit)}</div>
</div></body></html>`;

const outDir = resolve(here, 'out');
mkdirSync(outDir, { recursive: true });
const name = basename(eventFile, '.json');
const htmlPath = resolve(outDir, `${name}.html`);
writeFileSync(htmlPath, html);

const { chromium } = require('playwright');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2000, height: 2000 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: resolve(outDir, `${name}.png`) });
await page.screenshot({ path: resolve(outDir, `${name}.jpg`), type: 'jpeg', quality: 92 });
await browser.close();
console.log(`wrote out/${name}.png and out/${name}.jpg (QR -> ${ev.rsvpUrl})`);
