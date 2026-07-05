import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--headless=new'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto('http://localhost:4860/animation-catalog', { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
await page.waitForTimeout(3000);
const r = await page.evaluate(() => {
  const h = document.querySelector('header.ds-glass');
  if (!h) return 'no header';
  const cs = getComputedStyle(h);
  return { position: cs.position, borderRadius: cs.borderRadius };
});
console.log(JSON.stringify(r));
await browser.close();
