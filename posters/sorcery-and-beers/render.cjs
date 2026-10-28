// Renders poster.html to poster.png (A4 at 300 dpi) and poster.pdf, and
// square.html to square.png (2160 x 2160, the 1080 square at 2x for socials).
// Usage: node posters/sorcery-and-beers/render.cjs
const { chromium } = require('playwright');
const path = require('node:path');

const dir = __dirname;
const url = 'file://' + path.join(dir, 'poster.html');

(async () => {
  const browser = await chromium.launch();
  // A4 is 793.7 x 1122.5 CSS px; scale 3.125 gives 2480 x 3508, 300 dpi
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 3.125 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.locator('.poster').screenshot({ path: path.join(dir, 'poster.png') });
  await page.pdf({ path: path.join(dir, 'poster.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  const sq = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 2 });
  await sq.goto('file://' + path.join(dir, 'square.html'), { waitUntil: 'networkidle' });
  await sq.evaluate(() => document.fonts.ready);
  await sq.locator('.square').screenshot({ path: path.join(dir, 'square.png') });
  await browser.close();
})();
