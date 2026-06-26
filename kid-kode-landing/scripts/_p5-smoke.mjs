// P-5 composition smoke — drives /composite-lab headless to confirm stack + snap.
import { chromium } from 'playwright';

const URL = (process.env.GATE_URL || 'http://localhost:3000') + '/composite-lab';
const OUT = 'notes/verification/prim-p5';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1680, height: 1000 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
const booted = await page.waitForFunction(() => typeof window.__PRISM_COMPOSITION__ === 'function' && window.__PRISM_COMPOSITE_STORE__?.().composites.length > 0, { timeout: 60000 }).then(() => true).catch(() => false);
console.log('booted:', booted);
if (!booted) { console.log('errors:', errors.slice(0, 4)); await browser.close(); process.exit(1); }
await page.waitForTimeout(6000);

const seed = await page.evaluate(() => window.__PRISM_COMPOSITION__());
console.log('seed composites:', seed.compositeCount, 'nodes:', seed.nodeCount, 'mode:', seed.editorMode, 'snap:', seed.snapEnabled, 'grid:', seed.showGrid);

// STACK: stack one pane onto another, confirm child moves with parent.
const stack = await page.evaluate(() => {
  const st = window.__PRISM_COMPOSITE_STORE__();
  const panes = st.composites.filter((c) => c.templateId === 'pane');
  if (panes.length < 2) return { ok: false, reason: 'need 2 panes' };
  const [a, b] = panes;
  const childBefore = st.worldRootOf(a.compositeId);
  const ok = st.stackComposite(a.compositeId, b.compositeId);
  const parentBefore = st.worldRootOf(b.compositeId);
  // move the parent, confirm the child's world follows
  st.moveComposite(b.compositeId, parentBefore.x + 2, parentBefore.y + 1);
  const parentAfter = st.worldRootOf(b.compositeId);
  const childAfter = st.worldRootOf(a.compositeId);
  st.endMove();
  return {
    ok, child: a.compositeId, parent: b.compositeId,
    childBefore, childAfter, parentBefore, parentAfter,
    movedTogether: Math.abs((childAfter.x - childBefore.x) - (parentAfter.x - parentBefore.x)) < 0.001
      && Math.abs((childAfter.y - childBefore.y) - (parentAfter.y - parentBefore.y)) < 0.001,
  };
});
console.log('STACK:', JSON.stringify(stack));

// SNAP: move a free pane near another composite's center, confirm guides emit + snap.
const snap = await page.evaluate(() => {
  const st = window.__PRISM_COMPOSITE_STORE__();
  const card = st.composites.find((c) => c.templateId === 'card');
  const pane = st.composites.find((c) => c.templateId === 'pane' && !c.parentCompositeId);
  if (!card || !pane) return { ok: false };
  const cw = st.worldRootOf(card.compositeId);
  // drop the pane just off the card's center x (within snap eps) → expect x to snap + a guide
  st.moveComposite(pane.compositeId, cw.x + 0.12, cw.y - 2.4);
  const after = window.__PRISM_COMPOSITION__();
  const pw = st.worldRootOf(pane.compositeId);
  st.endMove();
  return { ok: true, cardX: cw.x, paneX: pw.x, snappedX: Math.abs(pw.x - cw.x) < 0.001, guides: after.guideCount };
});
console.log('SNAP:', JSON.stringify(snap));

await page.screenshot({ path: `${OUT}/_smoke-canvas.png` });
await page.evaluate(() => window.__PRISM_COMPOSITE_STORE__().setView('galaxy'));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/_smoke-galaxy.png` });

console.log('errors:', errors.length, errors.slice(0, 4));
await browser.close();
process.exit(stack.ok && stack.movedTogether && snap.snappedX && snap.guides > 0 && errors.length === 0 ? 0 : 2);
