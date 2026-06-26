// P-5 connect smoke — confirm picking two member nodes creates a connection + edge,
// and a visible connector renders.
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
await page.waitForFunction(() => typeof window.__PRISM_COMPOSITION__ === 'function' && window.__PRISM_COMPOSITE_STORE__?.().composites.length > 0, { timeout: 60000 });
await page.waitForTimeout(6000);

const res = await page.evaluate(() => {
  const st = window.__PRISM_COMPOSITE_STORE__();
  st.setEditorMode('connect');
  // pick two pane member nodes
  const panes = st.composites.filter((c) => c.templateId === 'pane');
  const n1 = panes[0] ? `${panes[0].compositeId}-pane` : null;
  // pick a card cta node + a pane node for a richer cross-composite connection
  const card = st.composites.find((c) => c.templateId === 'card');
  const n2 = panes[1] ? `${panes[1].compositeId}-pane` : null;
  const before = window.__PRISM_COMPOSITION__();
  st.pickConnectNode(n1, 'data');
  const armed = window.__PRISM_COMPOSITION__().pendingConnectFrom;
  st.pickConnectNode(n2, 'data');
  const after = window.__PRISM_COMPOSITION__();
  // a second connection — logic kind — from card cta to a nav tab
  const navTabNode = (() => {
    const nav = st.composites.find((c) => c.templateId === 'nav-header');
    return nav ? `${nav.compositeId}-tab-page-home` : null;
  })();
  const ctaNode = card ? `${card.compositeId}-cta` : null;
  if (ctaNode && navTabNode) { st.pickConnectNode(ctaNode, 'logic'); st.pickConnectNode(navTabNode, 'logic'); }
  const final = window.__PRISM_COMPOSITION__();
  return { n1, n2, armed, beforeCount: before.connectionCount, afterCount: after.connectionCount, finalCount: final.connectionCount, edgeKinds: final.edgeKinds, connections: final.connections };
});
console.log('CONNECT:', JSON.stringify(res, null, 1));
await page.evaluate(() => window.__PRISM_COMPOSITE_STORE__().setEditorMode('select'));
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/_smoke-connect.png` });
console.log('errors:', errors.length, errors.slice(0, 4));
await browser.close();
const ok = res.armed === res.n1 && res.afterCount === res.beforeCount + 1 && res.finalCount >= 2 && res.edgeKinds.data >= 1 && res.edgeKinds.logic >= 1 && errors.length === 0;
process.exit(ok ? 0 : 2);
