import { chromium } from 'playwright';
const b=await chromium.launch({channel:'chrome',headless:true});
const p=await b.newPage({viewport:{width:240,height:240},deviceScaleFactor:2});
await p.goto('file:///tmp/f2icons/home.html');
await p.waitForTimeout(300);
await p.screenshot({path:'notes/verification/editor-experience/F2-IDENTITY/after/10-home-glyph-160.png'});
await b.close();console.log('DONE');
