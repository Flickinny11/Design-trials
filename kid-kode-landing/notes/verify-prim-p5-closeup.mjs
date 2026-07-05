// P-5 premium closeups — set up a clean stacked + connected pair and frame it tight,
// so the aesthetic judge can assess connector/tube/glass fidelity up close.
import { chromium } from 'playwright';
const URL = (process.env.GATE_URL || 'http://localhost:3000') + '/composite-lab';
const OUT = 'notes/verification/prim-p5';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1680, height: 1000 });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__PRISM_COMPOSITION__ === 'function' && window.__PRISM_COMPOSITE_STORE__?.().composites.length > 0, { timeout: 60000 });
await page.waitForTimeout(7000);

await page.evaluate(() => {
  const st = window.__PRISM_COMPOSITE_STORE__();
  // two fresh panes side by side, connected, in clean space.
  const p1 = st.instantiateComposite('pane');
  const p2 = st.instantiateComposite('pane');
  const c1 = st.instantiateComposite('cube');
  st.moveComposite(p1, -1.6, 0.8); st.endMove();
  st.moveComposite(p2, 1.8, 0.8); st.endMove();
  st.moveComposite(c1, 0.1, -1.6); st.endMove();
  st.setEditorMode('connect');
  st.pickConnectNode(`${p1}-pane`, 'data'); st.pickConnectNode(`${p2}-pane`, 'data');
  st.pickConnectNode(`${p2}-pane`, 'logic'); st.pickConnectNode(`${c1}-cube`, 'logic');
  st.setEditorMode('select');
  // stack the cube onto p1 to show a stack tie
  st.stackComposite(c1, p1);
  st.select(p2);
});
await page.waitForTimeout(1500);
// frame tight on the connected pair
await page.evaluate(() => window.__PRISM_COMPOSITE_CAM__.set(0.2, 0.6, 9.5, 0.2, 0.2, 0));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/bh-closeup-connectors.png` });
// orbit slightly to show 3D depth of the tubes
await page.evaluate(() => window.__PRISM_COMPOSITE_CAM__.set(-3.5, 1.8, 9, 0.2, 0.2, 0));
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/bh-closeup-3d.png` });
await browser.close();
console.log('closeups captured');
