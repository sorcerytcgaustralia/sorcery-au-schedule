// Renders poster.html to poster.png (A4 at 300 dpi), poster.pdf and
// poster-social.jpg (1240px wide, for Facebook and Discord).
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
  await browser.close();
})();
