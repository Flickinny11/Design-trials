import { chromium } from 'playwright';
const url = process.env.URL || 'http://localhost:3000';
const out = process.env.OUT || '/tmp/prism-before.png';
let b;
try { b = await chromium.launch({ channel: 'chrome', headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] }); }
catch { b = await chromium.launch({ headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] }); }
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errs = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,140)); });
try {
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(6000);
  await p.screenshot({ path: out });
  console.log('OK title=' + JSON.stringify(await p.title()));
  console.log('console_errors=' + errs.length);
  errs.slice(0,6).forEach(e => console.log('  ! ' + e));
} catch (e) { console.log('SHOT_FAIL ' + e.message); }
await b.close();
