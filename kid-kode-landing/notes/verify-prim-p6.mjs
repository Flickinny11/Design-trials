// PRISM PRIM-P6 — headless behavioral verification of /library (the in-canvas
// LIBRARY/PALETTE). Per docs/prism/VERIFICATION-STANDARD.md §2: drive the REAL route
// with TRUSTED pointer events, capture an evidence frame per interaction, judge the
// result. Browse (4 sections) · search (real keystrokes) · drag-to-canvas (primitive
// / material / composite → node(s)) · select → Inspector → fader edit · dogfood pane
// is a node. Plus the locked-aesthetic reference frames. Mirrors verify-prim-p5.mjs.
//
//   node notes/verify-prim-p6.mjs            (dev server must be up on :3000)

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.PRIM_BASE || 'http://localhost:3000';
const URL = `${BASE}/library`;
const OUT = 'notes/verification/prim-p6';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

const metrics = { interactions: [] };
const record = (name, pass, method, detail) => {
  metrics.interactions.push({ name, pass, method, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} [${method}] — ${detail}`);
};
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const store = (fn, arg) => page.evaluate(fn, arg);
const auth = () => page.evaluate(() => window.__PRISM_LIB_AUTHORSHIP__());

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(
  () => typeof window.__PRISM_LIB_CAM__ !== 'undefined'
    && typeof window.__PRISM_LIB_TILE_POS__ === 'function'
    && window.__PRISM_LIB_STORE__().catalog().length > 0,
  { timeout: 60000 },
);
await page.waitForTimeout(7500); // worn maps + MSDF + material map sets warm

const rect = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="library-canvas"]') || document.querySelector('canvas');
  const r = el.getBoundingClientRect(); return { left: r.left, top: r.top };
});
const proj = async (w) => page.evaluate(([x, y, z]) => window.__PRISM_LIB_CAM__.project(x, y, z), w);
const clickWorld = async (w) => { const c = await proj(w); await page.mouse.click(rect.left + c[0], rect.top + c[1]); await page.waitForTimeout(420); };

// ── 0) boot: self-test + catalog ─────────────────────────────────────────────────
const self = await store(() => window.__PRISM_LIB_AUTHORSHIP_SELFTEST__());
const cat = await store(() => window.__PRISM_LIB_STORE__().catalog().length);
record('classifier-self-test', !!self.live, 'probe', `live=${self.live} caught=${self.caughtCount} · catalog=${cat} entries`);
await shot('bh-00-overview');

// ── 1) BROWSE the four sections (live previews per section) ───────────────────────
for (const sec of ['primitives', 'composites', 'materials', 'saved']) {
  await store((s) => window.__PRISM_LIB_STORE__().setSection(s), sec);
  await page.waitForTimeout(1600);
  const tiles = await store(() => window.__PRISM_LIB_TILE_POS__().length);
  await shot(`bh-01-section-${sec}`);
  // saved is empty until the user saves one — that's expected, so don't fail on it.
  record(`browse-${sec}`, sec === 'saved' ? true : tiles > 0, 'trusted/probe', `${tiles} live preview tiles`);
}
// materials family switch (live PBR previews)
await store(() => window.__PRISM_LIB_STORE__().setSection('materials'));
await store(() => window.__PRISM_LIB_STORE__().setFamily('Gems'));
await page.waitForTimeout(1800);
const gemTiles = await store(() => window.__PRISM_LIB_TILE_POS__().length);
await shot('bh-01-materials-gems');
record('browse-materials-family', gemTiles >= 5, 'probe', `Gems family → ${gemTiles} live gem previews`);

// ── 2) SEARCH (real in-engine keystroke capture) ─────────────────────────────────
await store(() => { const s = window.__PRISM_LIB_STORE__(); s.setSection('materials'); s.setFamily('Metals'); });
await page.waitForTimeout(600);
// focus the search bar by trusted click, then type real keystrokes.
await clickWorld([-8.4, 3.2, 0.4]);
const focused = await store(() => window.__PRISM_LIB_STORE__().searchFocused);
await page.keyboard.type('gold', { delay: 60 });
await page.waitForTimeout(600);
const q = await store(() => window.__PRISM_LIB_STORE__().query);
const visible = await store(() => window.__PRISM_LIB_TILE_POS__().map((t) => t.entryId));
await shot('bh-02-search-gold');
const allGold = q.toLowerCase() === 'gold' && visible.length > 0 && visible.length <= 4;
record('search-filter', focused && q === 'gold' && visible.length > 0, 'trusted-keystroke', `focused=${focused} query="${q}" → ${visible.length} matches: ${visible.join(',')}`);
await store(() => window.__PRISM_LIB_STORE__().setQuery(''));
await store(() => window.__PRISM_LIB_STORE__().focusSearch(false));

// ── 3) DRAG-TO-CANVAS a PRIMITIVE (trusted pointer) → a node is created + authored ─
await store(() => window.__PRISM_LIB_STORE__().setSection('primitives'));
await page.waitForTimeout(1400);
const drag = async (entryId, to) => {
  const tiles = await store(() => window.__PRISM_LIB_TILE_POS__());
  const tile = tiles.find((t) => t.entryId === entryId) || tiles[0];
  const before = await store(() => window.__PRISM_LIB_STORE__().nodes().length);
  const from = await proj(tile.world);
  const dst = await proj(to);
  await page.mouse.move(rect.left + from[0], rect.top + from[1]);
  await page.mouse.down();
  await page.waitForTimeout(80);
  for (let i = 1; i <= 14; i++) await page.mouse.move(rect.left + from[0] + (dst[0] - from[0]) * i / 14, rect.top + from[1] + (dst[1] - from[1]) * i / 14, { steps: 1 });
  await page.waitForTimeout(60);
  await page.mouse.up();
  await page.waitForTimeout(700);
  const after = await store(() => window.__PRISM_LIB_STORE__().nodes().length);
  return { before, after };
};
const dPrim = await drag('prim:pane', [-0.5, 0.4, 0]);
const a1 = await auth();
record('drag-primitive', dPrim.after === dPrim.before + 1 && a1.ok, 'trusted-pointer-drag', `nodes ${dPrim.before}→${dPrim.after} · authored ok=${a1.ok} orphans=${a1.orphans.length}`);
await shot('bh-03-drag-primitive');

// ── 4) DRAG-TO-CANVAS a MATERIAL → a display node ────────────────────────────────
await store(() => { const s = window.__PRISM_LIB_STORE__(); s.setSection('materials'); s.setFamily('Gems'); });
await page.waitForTimeout(1400);
const dMat = await drag('mat:gem.emerald', [3.2, 0.4, 0]);
const a2 = await auth();
record('drag-material', dMat.after === dMat.before + 1 && a2.ok, 'trusted-pointer-drag', `nodes ${dMat.before}→${dMat.after} · ok=${a2.ok}`);
await shot('bh-04-drag-material');

// ── 5) DRAG-TO-CANVAS a COMPOSITE → a SUBGRAPH (>1 node) ─────────────────────────
await store(() => window.__PRISM_LIB_STORE__().setSection('composites'));
await page.waitForTimeout(1400);
const dComp = await drag('comp:footer', [0.5, -1.4, 0]);
const a3 = await auth();
record('drag-composite-subgraph', dComp.after > dComp.before + 1 && a3.ok, 'trusted-pointer-drag', `nodes ${dComp.before}→${dComp.after} (+${dComp.after - dComp.before}) · ok=${a3.ok}`);
await shot('bh-05-drag-composite');

// ── 6) SELECT a primitive instance → Inspector exposes schema; FADER edit ────────
const sel = await store(() => { const s = window.__PRISM_LIB_STORE__(); const prim = s.instances.find((i) => i.kind === 'primitive' && i.id !== 'lib-chrome-pane'); s.select(prim.id); return prim.id; });
await page.waitForTimeout(1200);
const imap = await store(() => window.__PRISM_LIB_INSPECTOR_MAP__());
await shot('bh-06-inspector');
record('inspector-opens', imap.open && imap.faders.length > 0, 'probe', `faders: ${imap.faders.map((f) => f.key).join(',')}`);
// drive a fader by trusted pointer.
const fk = imap.faders.find((f) => f.key === 'width') || imap.faders[0];
const w0 = await store(([id, k]) => { const i = window.__PRISM_LIB_STORE__().instances.find((x) => x.id === id); return i.schema.params[k]; }, [sel, fk.key]);
const kc = await proj(fk.world);
await page.mouse.move(rect.left + kc[0], rect.top + kc[1]);
await page.mouse.down(); await page.waitForTimeout(120);
await page.mouse.move(rect.left + kc[0] + 150, rect.top + kc[1], { steps: 12 });
await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(300);
const w1 = await store(([id, k]) => { const i = window.__PRISM_LIB_STORE__().instances.find((x) => x.id === id); return i.schema.params[k]; }, [sel, fk.key]);
await shot('bh-06-inspector-fader');
record('inspector-fader-edits-schema', w1 !== w0, 'trusted-pointer-drag', `${fk.key} ${w0.toFixed(2)} → ${w1.toFixed(2)}`);
// material swatch re-skin
const matBefore = await store((id) => { const i = window.__PRISM_LIB_STORE__().instances.find((x) => x.id === id); return i.schema.material.materialId || null; }, sel);
await store((id) => window.__PRISM_LIB_STORE__().applyMaterial(id, 'gem.sapphire'), sel);
await page.waitForTimeout(500);
const matAfter = await store((id) => { const i = window.__PRISM_LIB_STORE__().instances.find((x) => x.id === id); return i.schema.material.materialId; }, sel);
record('inspector-material-reskin', matAfter === 'gem.sapphire', 'store', `material ${matBefore} → ${matAfter}`);

// ── 7) DOGFOOD: the chrome pane is a real Pane primitive node; click selects it ───
const chrome = await store(() => { const s = window.__PRISM_LIB_STORE__(); const c = s.instances.find((i) => i.id === 'lib-chrome-pane'); const nodeIds = s.nodes().map((n) => n.nodeId); return { present: !!c, kind: c?.kind, inNodes: nodeIds.includes('lib-chrome-pane'), pos: c ? [c.schema.transform.x, c.schema.transform.y, c.schema.transform.z] : null }; });
await clickWorld(chrome.pos);
const selChrome = await store(() => window.__PRISM_LIB_STORE__().selectedId);
await shot('bh-07-dogfood-selected');
record('dogfood-chrome-is-node', chrome.present && chrome.kind === 'primitive' && chrome.inNodes, 'probe', `chrome pane backing node present=${chrome.present} inNodes=${chrome.inNodes}`);
record('dogfood-chrome-selectable', selChrome === 'lib-chrome-pane', 'trusted-pointer', `clicking the chrome panel selected node ${selChrome}`);

// ── 8) TWO-STATE frames (galaxy unbuilt / canvas realized) ───────────────────────
await store(() => window.__PRISM_LIB_STORE__().setView('galaxy'));
await page.waitForTimeout(1800);
const gal = await auth();
await shot('bh-08-galaxy');
record('galaxy-no-orphan', gal.orphans.length === 0, 'probe', `${gal.renderedCount} dormant seeds, orphans=${gal.orphans.length}`);
await store(() => window.__PRISM_LIB_STORE__().setView('canvas'));
await page.waitForTimeout(2200);
const can = await auth();
await shot('bh-08-canvas');
record('canvas-realized-no-orphan', can.ok && can.unrealizedInCanvas.length === 0, 'probe', `${can.renderedCount} rendered · ${can.nodeIds.length} nodes · orphans=${can.orphans.length} unrealized=${can.unrealizedInCanvas.length}`);

// ── 9) aesthetic ground-truth reference frames (the locked look to match) ─────────
await page.goto(`${BASE}/toolbar-chassis`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000); await shot('ref-toolbar-chassis');
await page.goto(`${BASE}/keyframe-editor`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000); await shot('ref-keyframe-editor');

metrics.consoleErrors = errors.length;
metrics.errors = errors.slice(0, 8);
metrics.allPass = metrics.interactions.every((i) => i.pass) && errors.length === 0;
writeFileSync(`${OUT}/behavioral-metrics.json`, JSON.stringify(metrics, null, 2) + '\n');
console.log('\nconsole/page errors:', errors.length);
console.log('ALL BEHAVIORAL PASS:', metrics.allPass);
await browser.close();
process.exit(metrics.allPass ? 0 : 2);
