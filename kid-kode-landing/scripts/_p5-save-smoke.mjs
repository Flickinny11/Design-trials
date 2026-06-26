// P-5 save smoke — stack two panes, connect them, group + save-as-template, then
// re-instantiate and confirm it recreates the assembly as a FRESH registered subgraph.
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
  // zustand getState() returns a SNAPSHOT — its arrays go stale after mutation, but
  // its methods are stable. So call ops on any snapshot, but read fresh each time.
  const S = () => window.__PRISM_COMPOSITE_STORE__();
  const panes = S().composites.filter((c) => c.templateId === 'pane');
  const [a, b] = panes;
  // 1) stack a onto b (a stacked assembly)
  S().stackComposite(a.compositeId, b.compositeId);
  // 2) connect their member nodes
  S().setEditorMode('connect');
  S().pickConnectNode(`${a.compositeId}-pane`, 'data');
  S().pickConnectNode(`${b.compositeId}-pane`, 'data');
  S().setEditorMode('select');
  // 3) multi-select both + group
  S().toggleMultiSelect(a.compositeId);
  S().toggleMultiSelect(b.compositeId);
  const groupId = S().groupSelection();
  // 4) save as template
  const tplId = S().saveAsTemplate('Stack Combo');
  const tpl = S().userTemplates.find((t) => t.templateId === tplId);

  // snapshot before re-instantiate (read fresh)
  const beforeNodes = S().nodes().length;
  const beforeComposites = S().composites.length;
  const beforeConns = S().connections.length;
  // 5) clear selection, then re-instantiate the saved template as a fresh subgraph
  S().clearMultiSelect();
  const newIds = S().instantiateUserTemplate(tplId);
  const after = S();
  const afterNodes = after.nodes().length;
  const afterComposites = after.composites.length;
  const afterConns = after.connections.length;
  // verify the new composites form a real subgraph: members backed + a stack edge + a data edge among the NEW ids
  const newSet = new Set(newIds);
  const newComps = after.composites.filter((c) => newSet.has(c.compositeId));
  const newStacked = newComps.filter((c) => c.parentCompositeId && newSet.has(c.parentCompositeId)).length;
  const newConnCount = afterConns - beforeConns;
  return {
    groupId, tplId, tplComposites: tpl?.composites.length, tplConnections: tpl?.connections.length,
    beforeNodes, afterNodes, beforeComposites, afterComposites, beforeConns, afterConns,
    newIds, newCount: newIds.length, newStacked, newConnCount,
  };
});
console.log('SAVE+REINSTANTIATE:', JSON.stringify(res, null, 1));

// authorship after re-instantiation: every rendered member of the new subgraph backed.
await page.waitForTimeout(3500);
const auth = await page.evaluate(() => window.__PRISM_COMPOSITE_AUTHORSHIP__());
console.log('AUTHORSHIP after re-instantiate: ok=', auth.ok, 'orphans=', auth.orphans.length, 'unrealized=', auth.unrealized.length);
await page.screenshot({ path: `${OUT}/_smoke-save.png` });

console.log('errors:', errors.length, errors.slice(0, 4));
await browser.close();
const ok = res.tplComposites === 2 && res.tplConnections === 1
  && res.afterComposites === res.beforeComposites + 2
  && res.afterNodes === res.beforeNodes + 2
  && res.newStacked === 1 && res.newConnCount === 1
  && auth.ok && errors.length === 0;
process.exit(ok ? 0 : 2);
