import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = '/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/verification/editor-experience/F0-FOUNDATION';
fs.mkdirSync(OUT, { recursive: true });

const launch = async () => {
  try { return await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] }); }
  catch { return await chromium.launch({ headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] }); }
};

const b = await launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text().slice(0,200)); });

await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 45000 });
await p.waitForTimeout(7000); // let 3D/GSAP settle

// Full editor view
const full = path.join(OUT, 'full.png');
await p.screenshot({ path: full, fullPage: false });
console.log('FULL:', full);

// Logo crop (top-left ~240x80)
const logo = path.join(OUT, 'logo.png');
await p.screenshot({ path: logo, clip: { x:0, y:0, width:240, height:72 } });
console.log('LOGO:', logo);

// Mode toggle + center top (~600x60 centered)
const toggle = path.join(OUT, 'toggle.png');
await p.screenshot({ path: toggle, clip: { x:320, y:0, width:800, height:60 } });
console.log('TOGGLE:', toggle);

// Bottom nav pills
const nav = path.join(OUT, 'nav-pills.png');
await p.screenshot({ path: nav, clip: { x:0, y:840, width:1440, height:60 } });
console.log('NAV:', nav);

console.log('console_errors=' + errs.length);
errs.slice(0,8).forEach(e => console.log('  ! ' + e));
await b.close();
