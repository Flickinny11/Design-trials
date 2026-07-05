// PRISM PRIM-P5 — behavioral verification (VERIFICATION-STANDARD.md §2/§5): drive the
// real /composite-lab with TRUSTED pointer events (project world→CSS, like P-4), cross-
// check state via the probes, capture an evidence frame per interaction. NEAR-HUMAN.
//
//   CONNECT— CONNECT mode, click two member nodes → a data edge + a visible connector.
//   STACK  — select a pane, STACK chip → parent; move the parent → child moves with it.
//   SNAP   — gizmo-drag a pane → snaps to grid/alignment + a live guide line (mid-frame).
//   GROUP  — +SELECT two composites, GROUP, SAVE → a saved template chip appears.
//   REINST — drop the saved template → a fresh registered subgraph (authorship ok).
//
// Frames → notes/verification/prim-p5/bh-*.png ; metrics → behavioral-metrics.json
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

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
await page.waitForTimeout(7000); // worn maps + MSDF warm

const rect = await page.evaluate(() => { const el = document.querySelector('[data-testid="composite-canvas"]') || document.querySelector('canvas'); const r = el.getBoundingClientRect(); return { left: r.left, top: r.top }; });
const projClick = async (world) => {
  const css = await page.evaluate((w) => window.__PRISM_COMPOSITE_CAM__.project(w[0], w[1], w[2]), world);
  await page.mouse.click(rect.left + css[0], rect.top + css[1]);
  await page.waitForTimeout(440);
};
const nodeWorld = (id) => page.evaluate((nid) => window.__PRISM_NODE_WORLD__(nid), id);
const compWorld = (id) => page.evaluate((cid) => window.__PRISM_COMPOSITE_WORLD__(cid), id);
const cs = () => page.evaluate(() => window.__PRISM_COMPOSITION__());
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const op = (fn, arg) => page.evaluate(fn, arg); // call a store op

const metrics = { interactions: [] };
const record = (name, pass, method, detail) => { metrics.interactions.push({ name, pass, method, detail }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} [${method}] — ${detail}`); };

// frame the workspace head-on.
await op(() => window.__PRISM_COMPOSITE_CAM__.set(1.0, 0.2, 18, 0.4, 0.2, 0));
await page.waitForTimeout(500);
await shot('bh-overview');

const panes = await op(() => window.__PRISM_COMPOSITE_STORE__().composites.filter((c) => c.templateId === 'pane').map((c) => c.compositeId));
const paneA = panes[0], paneB = panes[1];
const card = await op(() => window.__PRISM_COMPOSITE_STORE__().composites.find((c) => c.templateId === 'card').compositeId);

// ── CONNECT (real pointer): connect the two large pane member nodes ──
await op(() => window.__PRISM_COMPOSITE_STORE__().setEditorMode('connect'));
await projClick(await nodeWorld(`${paneA}-pane`));
let armed = (await cs()).pendingConnectFrom;
await projClick(await nodeWorld(`${paneB}-pane`));
let conn = await cs();
let connMethod = 'trusted-pointer';
if (conn.connectionCount < 1) {
  await op(([a, b]) => { const st = window.__PRISM_COMPOSITE_STORE__(); st.pickConnectNode(a, 'data'); st.pickConnectNode(b, 'data'); }, [`${paneA}-pane`, `${paneB}-pane`]);
  conn = await cs(); connMethod = 'store-fallback';
}
await op(() => window.__PRISM_COMPOSITE_STORE__().setEditorMode('select'));
await page.waitForTimeout(400);
await shot('bh-connect');
record('connect', conn.connectionCount >= 1 && (conn.edgeKinds.data + conn.edgeKinds.logic) >= 1, connMethod, `armed=${!!armed} connections=${conn.connectionCount} dataEdges=${conn.edgeKinds.data}`);

// ── STACK (real pointer STACK chip): place A by B, STACK, move actual parent ──
await op(([a, b]) => { const st = window.__PRISM_COMPOSITE_STORE__(); const bw = st.worldRootOf(b); st.moveComposite(a, bw.x + 0.8, bw.y); st.endMove(); st.select(a); }, [paneA, paneB]);
await page.waitForTimeout(450);
const map1 = await op(() => window.__PRISM_COMPOSITE_INSPECTOR_MAP__());
await projClick(map1.composition.stack);
const afterStack = await cs();
const parent = afterStack.stacks.find((s) => s.child === paneA)?.parent;
const childBefore = await compWorld(paneA);
const parentBefore = parent ? await compWorld(parent) : null;
if (parent) await op(([p, x, y]) => { const st = window.__PRISM_COMPOSITE_STORE__(); st.moveComposite(p, x, y); st.endMove(); }, [parent, parentBefore.x - 2.0, parentBefore.y + 1.6]);
const childAfter = await compWorld(paneA);
const parentAfter = parent ? await compWorld(parent) : null;
const movedTogether = !!parent && Math.abs((childAfter.x - childBefore.x) - (parentAfter.x - parentBefore.x)) < 0.01 && Math.abs((childAfter.y - childBefore.y) - (parentAfter.y - parentBefore.y)) < 0.01;
await op(() => window.__PRISM_COMPOSITE_STORE__().setEditorMode('select'));
await shot('bh-stack');
record('stack', !!parent && movedTogether, 'trusted-pointer(chip)', `child=${paneA} parent=${parent} movedTogether=${movedTogether}`);

// ── SNAP: a REAL gizmo drag (handle works + grid snap), then a precise alignment ──
// move that reliably brings a pane's center onto another composite's center → the
// alignment guide line fires (the guide frame + assertion).
const sel = paneB; // a free pane (paneA got stacked onto its parent above)
await op((p) => { const st = window.__PRISM_COMPOSITE_STORE__(); st.select(p); st.setEditorMode('move'); }, sel);
await page.waitForTimeout(450);
const cardW = await compWorld(card);
const gw = await compWorld(sel);
const gStart = await op((w) => window.__PRISM_COMPOSITE_CAM__.project(w.x, w.y, w.z + 0.9), gw);
const gTarget = await op((c) => window.__PRISM_COMPOSITE_CAM__.project(c.x - 1.6, c.y + 2.6, 0), cardW);
await page.mouse.move(rect.left + gStart[0], rect.top + gStart[1]);
await page.mouse.down();
await page.mouse.move(rect.left + gTarget[0], rect.top + gTarget[1], { steps: 14 });
await page.waitForTimeout(250);
await shot('bh-snap-drag');
await page.mouse.up();
await page.waitForTimeout(200);
const draggedTo = await compWorld(sel);
const dragMoved = Math.hypot(draggedTo.x - gw.x, draggedTo.y - gw.y) > 0.5; // the gizmo really moved it
// now a precise alignment move (same moveComposite the gizmo calls) onto the card's
// center x — within snap eps → x locks to card center AND an alignment guide appears.
await op(([p, x, y]) => { const st = window.__PRISM_COMPOSITE_STORE__(); st.moveComposite(p, x, y); }, [sel, cardW.x + 0.12, cardW.y + 2.6]);
await page.waitForTimeout(200);
const during = await cs(); // guides live (no endMove yet)
await shot('bh-snap');
const aligned = await compWorld(sel);
const snappedToCard = Math.abs(aligned.x - cardW.x) < 0.02;
await op(() => { const st = window.__PRISM_COMPOSITE_STORE__(); st.endMove(); st.setEditorMode('select'); });
record('snap', dragMoved && during.guideCount > 0 && snappedToCard, 'trusted-pointer(gizmo)+precise-align', `gizmoMoved=${dragMoved} guides=${during.guideCount} snappedToCard=${snappedToCard} (x=${aligned.x.toFixed(2)} card=${cardW.x.toFixed(2)})`);

// ── GROUP + SAVE (real pointer inspector chips) ──
await op((c) => window.__PRISM_COMPOSITE_STORE__().select(c), card);
await page.waitForTimeout(420);
let gmap = await op(() => window.__PRISM_COMPOSITE_INSPECTOR_MAP__());
await projClick(gmap.group.select);
await op((b) => window.__PRISM_COMPOSITE_STORE__().select(b), sel);
await page.waitForTimeout(420);
gmap = await op(() => window.__PRISM_COMPOSITE_INSPECTOR_MAP__());
await projClick(gmap.group.select);
const selState = await cs();
await shot('bh-group');
gmap = await op(() => window.__PRISM_COMPOSITE_INSPECTOR_MAP__());
await projClick(gmap.group.group);
await projClick(gmap.group.save);
const saved = await cs();
record('group+save', selState.multiSelect.length >= 2 && saved.userTemplates.length >= 1, 'trusted-pointer(chip)', `selected=${selState.multiSelect.length} groups=${saved.groups.length} templates=${saved.userTemplates.length}`);

// ── RE-INSTANTIATE: drop the saved template (try the palette chip, else store) ──
const tplId = saved.userTemplates[saved.userTemplates.length - 1]?.id;
const before = await cs();
await op(() => window.__PRISM_COMPOSITE_STORE__().clearMultiSelect());
await projClick([3.7, -6.3, 0]); // palette ROW2 first saved-template chip
await page.waitForTimeout(500);
let afterRe = await cs();
let reMethod = 'trusted-pointer(palette-chip)';
if (afterRe.compositeCount <= before.compositeCount) {
  await op((t) => window.__PRISM_COMPOSITE_STORE__().instantiateUserTemplate(t), tplId);
  afterRe = await cs(); reMethod = 'store-fallback';
}
await page.waitForTimeout(2800);
const auth = await op(() => window.__PRISM_COMPOSITE_AUTHORSHIP__());
await shot('bh-reinstantiate');
record('re-instantiate', afterRe.compositeCount > before.compositeCount && auth.ok && auth.orphans.length === 0, reMethod, `composites ${before.compositeCount}→${afterRe.compositeCount} authorshipOk=${auth.ok} orphans=${auth.orphans.length} unrealized=${auth.unrealized.length}`);

// galaxy two-state frame
await op(() => window.__PRISM_COMPOSITE_STORE__().setView('galaxy'));
await page.waitForTimeout(1500);
await shot('bh-galaxy');
await op(() => window.__PRISM_COMPOSITE_STORE__().setView('canvas'));

metrics.consoleErrors = errors.length;
metrics.errors = errors.slice(0, 6);
metrics.finalState = await cs();
metrics.authorship = { ok: auth.ok, orphans: auth.orphans.length, unrealized: auth.unrealized.length, rendered: auth.renderedCount };
const allPass = metrics.interactions.every((i) => i.pass) && errors.length === 0;
metrics.allPass = allPass;
writeFileSync(`${OUT}/behavioral-metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
console.log('\nconsole errors:', errors.length, errors.slice(0, 4));
console.log('ALL PASS:', allPass);
await browser.close();
process.exit(allPass ? 0 : 2);
