// FINAL SIGN-OFF drive — criterion 9 (mutating; restore live-graph.json with
// git checkout afterwards).
//
// c09: Drag / resize(scale) / rotate mutate the node's `scenePosition`;
//      values persist (autosave -> live-graph.json) and round-trip through
//      save/reload (fresh page load reads the same values back).
//
// All three legs are REAL mouse drags on the live TransformControls handles.
// Handle screen positions are not guessed: the drive samples the rendered
// handle meshes' geometry vertices, transforms them by matrixWorld, and
// projects with the live canvas camera (fov 45 — GraphScene.tsx:3052). The
// TransformControls raycaster tests its picker meshes with the same
// matrixWorld, so pointer-down at a projected rendered-handle point engages
// the real drag path (GraphScene onObjectChange -> updateNode(scenePosition)).
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/canvas-completion');
const GRAPH = path.resolve('public/prism-mock/home/live-graph.json');
const results = { steps: [], legs: {}, consoleErrors: [], pass: false };
const fail = (m) => { results.steps.push({ step: m, ok: false }); throw new Error(m); };
const ok = (m, extra = {}) => results.steps.push({ step: m, ok: true, ...extra });
const readGraph = async () => JSON.parse(await readFile(GRAPH, 'utf8'));

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});

// In-page: find the visible TransformControls handle named `name` for the
// active mode, return projected screen points for a drag along it.
// {start: {x,y}, dir: {x,y}} where dir is the unit screen direction of the
// handle's long axis (for rings, the tangent at the sampled point).
const HANDLE_FN = `
  function __handleDragPoints(name) {
    const groups = window.__PRISM_EDITOR_NODE_GROUPS__;
    const any = groups?.values().next().value;
    if (!any) return { error: 'no groups' };
    let root = any; while (root.parent) root = root.parent;
    let gz = null;
    root.traverse((o) => { if (!gz && (o.type === 'TransformControlsGizmo')) gz = o; });
    if (!gz) return { error: 'no TransformControlsGizmo' };
    // collect candidate meshes with the given axis name that are visible
    const isShown = (o) => { let p = o; while (p) { if (p.visible === false) return false; p = p.parent; } return true; };
    const meshes = [];
    gz.traverse((o) => { if (o.isMesh && o.name === name && isShown(o)) meshes.push(o); });
    if (!meshes.length) return { error: 'no visible handle ' + name };
    const cam = window.__PRISM_EDITOR_GET_CANVAS_CAMERA__?.();
    const canvas = document.querySelector('[data-pane="graph"] canvas');
    const r = canvas.getBoundingClientRect();
    const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
    const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
    const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
    const norm=(a)=>{const l=Math.hypot(a.x,a.y,a.z)||1;return{x:a.x/l,y:a.y/l,z:a.z/l};};
    function project(p) {
      const fwd=norm(sub(cam.target,cam.position));
      const right=norm(cross(fwd,{x:0,y:1,z:0}));
      const up=cross(right,fwd);
      const d=sub(p,cam.position);
      const zv=dot(d,fwd); if(zv<=0.01) return null;
      const f=1/Math.tan((45*Math.PI/180)/2);
      const ndcX=(dot(d,right)/zv)*(f/(r.width/r.height));
      const ndcY=(dot(d,up)/zv)*f;
      return { x: r.left+(ndcX*0.5+0.5)*r.width, y: r.top+(1-(ndcY*0.5+0.5))*r.height };
    }
    // use the mesh with the most vertices (the visual handle), sample world
    // vertices, project all, take centroid + principal screen direction.
    const mesh = meshes.sort((a,b)=>(b.geometry?.attributes?.position?.count??0)-(a.geometry?.attributes?.position?.count??0))[0];
    mesh.updateWorldMatrix(true, false);
    const pos = mesh.geometry.attributes.position;
    const m = mesh.matrixWorld.elements;
    const pts = [];
    const step = Math.max(1, Math.floor(pos.count / 120));
    for (let i = 0; i < pos.count; i += step) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const wx = m[0]*x + m[4]*y + m[8]*z + m[12];
      const wy = m[1]*x + m[5]*y + m[9]*z + m[13];
      const wz = m[2]*x + m[6]*y + m[10]*z + m[14];
      const s = project({ x: wx, y: wy, z: wz });
      if (s) pts.push(s);
    }
    if (pts.length < 3) return { error: 'projection failed' };
    const cx = pts.reduce((a,p)=>a+p.x,0)/pts.length, cy = pts.reduce((a,p)=>a+p.y,0)/pts.length;
    // principal direction via covariance
    let sxx=0, sxy=0, syy=0;
    for (const p of pts) { const dx=p.x-cx, dy=p.y-cy; sxx+=dx*dx; sxy+=dx*dy; syy+=dy*dy; }
    const theta = 0.5 * Math.atan2(2*sxy, sxx-syy);
    const dir = { x: Math.cos(theta), y: Math.sin(theta) };
    // spread along dir so the caller can size the drag
    let mn=1e9, mx=-1e9;
    for (const p of pts) { const t=(p.x-cx)*dir.x+(p.y-cy)*dir.y; if(t<mn)mn=t; if(t>mx)mx=t; }
    return { start: { x: cx, y: cy }, dir, span: mx-mn, count: pts.length, mesh: mesh.name, verts: pos.count };
  }
`;

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 200)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4500);
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);

  // ── select the headline via marquee ───────────────────────────────────────
  await page.click('[data-tool-group="selection"]');
  await page.waitForTimeout(400);
  await page.click('[data-testid="tt-marquee"]');
  await page.waitForTimeout(200);
  await page.mouse.move(620, 370); await page.mouse.down();
  await page.mouse.move(1010, 450, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(700);
  const nodeId = await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState()?.selectedNodeId ?? null);
  if (!nodeId) fail('marquee selection failed (no selectedNodeId)');
  ok('headline selected via marquee', { nodeId });

  // ── enter edit mode via the REAL Inspector Edit toggle ───────────────────
  await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState()?.openInspector?.('visual'));
  await page.waitForTimeout(800);
  await page.click('button[title="Edit transform handles"]');
  await page.waitForTimeout(1200);
  const editorMode = await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState()?.editorMode);
  if (editorMode !== 'edit') fail(`editorMode not 'edit' after Edit toggle: ${editorMode}`);
  await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState()?.closeInspector?.());
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, 'c09-gizmo-mounted.png') });
  ok('edit mode entered via Inspector Edit toggle; gizmo mounted');

  const readSP = async () => page.evaluate((nid) => {
    const n = window.__PRISM_DEBUG_STORES__?.graphSource?.getState()?.nodes.find((x) => x.nodeId === nid);
    const sp = n?.scenePosition ?? {};
    return {
      x: sp.x ?? 0, y: sp.y ?? 0, z: sp.z ?? 0,
      rotationX: sp.rotationX ?? 0, rotationY: sp.rotationY ?? 0, rotationZ: sp.rotationZ ?? 0,
      scaleX: sp.scaleX ?? 1, scaleY: sp.scaleY ?? 1, scaleZ: sp.scaleZ ?? 1,
    };
  }, nodeId);
  const setGizmoMode = async (m) => {
    await page.evaluate((mm) => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState()?.setCanvasGizmoMode?.(mm), m);
    await page.waitForTimeout(600);
  };
  const handlePoints = async (name) => page.evaluate(([src, nm]) => {
    eval(src);
    return __handleDragPoints(nm);
  }, [HANDLE_FN, name]);

  const spStart = await readSP();
  results.legs.start = spStart;

  // ── leg 1: TRANSLATE — real mouse drag on the X arrow ────────────────────
  await setGizmoMode('translate');
  let translated = null;
  for (let attempt = 0; attempt < 3 && !translated; attempt++) {
    const h = await handlePoints('X');
    if (h.error) fail(`translate handle lookup: ${h.error}`);
    const before = await readSP();
    const len = 70;
    await page.mouse.move(h.start.x, h.start.y);
    await page.mouse.down();
    await page.mouse.move(h.start.x + h.dir.x * len, h.start.y + h.dir.y * len, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    const after = await readSP();
    if (Math.abs(after.x - before.x) + Math.abs(after.y - before.y) > 1e-3) translated = { handle: h, before, after };
  }
  if (!translated) fail('real translate drag never engaged the X handle');
  results.legs.translate = { method: 'real-mouse-drag on TransformControls X arrow', ...translated };
  await page.screenshot({ path: path.join(OUT, 'c09-after-drag-translate.png') });
  ok('REAL drag on gizmo X-arrow mutated scenePosition', {
    dx: translated.after.x - translated.before.x, dy: translated.after.y - translated.before.y,
  });

  // ── leg 2: ROTATE — real drag on the Z rotation ring ─────────────────────
  await setGizmoMode('rotate');
  let rotated = null;
  for (const ring of ['Z', 'E', 'X', 'Y']) {
    const h = await handlePoints(ring);
    if (h.error) continue;
    const before = await readSP();
    // tangential drag at the sampled ring point
    await page.mouse.move(h.start.x, h.start.y);
    await page.mouse.down();
    await page.mouse.move(h.start.x + h.dir.x * 55, h.start.y + h.dir.y * 55, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    const after = await readSP();
    const dr = Math.abs(after.rotationX - before.rotationX) + Math.abs(after.rotationY - before.rotationY) + Math.abs(after.rotationZ - before.rotationZ);
    if (dr > 1e-3) { rotated = { ring, handle: h, before, after }; break; }
  }
  if (!rotated) fail('real rotate drag never engaged a rotation ring');
  results.legs.rotate = { method: 'real-mouse-drag on TransformControls rotate ring', ...rotated };
  await page.screenshot({ path: path.join(OUT, 'c09-after-rotate.png') });
  ok(`REAL drag on ${rotated.ring} ring mutated scenePosition.rotation*`, {
    drz: rotated.after.rotationZ - rotated.before.rotationZ,
    drx: rotated.after.rotationX - rotated.before.rotationX,
    dry: rotated.after.rotationY - rotated.before.rotationY,
  });

  // ── leg 3: SCALE (resize) — real drag on an axis scale handle ────────────
  await setGizmoMode('scale');
  let scaled = null;
  for (const hname of ['X', 'Y', 'XYZ']) {
    const h = await handlePoints(hname);
    if (h.error) continue;
    const before = await readSP();
    await page.mouse.move(h.start.x, h.start.y);
    await page.mouse.down();
    await page.mouse.move(h.start.x + h.dir.x * 55, h.start.y + h.dir.y * 55, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    const after = await readSP();
    const ds = Math.abs(after.scaleX - before.scaleX) + Math.abs(after.scaleY - before.scaleY) + Math.abs(after.scaleZ - before.scaleZ);
    if (ds > 1e-3) { scaled = { handle: hname, h, before, after }; break; }
  }
  if (!scaled) fail('real scale drag never engaged a scale handle');
  results.legs.scale = { method: 'real-mouse-drag on TransformControls scale handle', ...scaled };
  await page.screenshot({ path: path.join(OUT, 'c09-after-scale.png') });
  ok(`REAL drag on ${scaled.handle} scale handle mutated scenePosition.scale*`, { sx: scaled.after.scaleX, sy: scaled.after.scaleY });

  // ── persistence: autosave flush -> disk ──────────────────────────────────
  const spFinal = await readSP();
  results.legs.final = spFinal;
  await page.waitForTimeout(4000); // debounced autosave flush
  const g = await readGraph();
  const diskSP = g.nodes.find((n) => n.nodeId === nodeId)?.scenePosition ?? null;
  if (!diskSP) fail('scenePosition missing from live-graph.json after autosave');
  const close = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) < 1e-6;
  const persisted = close(diskSP.x, spFinal.x)
    && close(diskSP.rotationX ?? 0, spFinal.rotationX)
    && close(diskSP.rotationY ?? 0, spFinal.rotationY)
    && close(diskSP.rotationZ ?? 0, spFinal.rotationZ)
    && close(diskSP.scaleX ?? 1, spFinal.scaleX);
  if (!persisted) fail(`disk scenePosition != store: ${JSON.stringify({ diskSP, spFinal })}`);
  results.legs.disk = diskSP;
  ok('scenePosition persisted to live-graph.json (autosave)', { diskSP });

  // ── round-trip: full reload, values read back ────────────────────────────
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4500);
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);
  const spReloaded = await readSP();
  results.legs.reloaded = spReloaded;
  const roundTrips = close(spReloaded.x, spFinal.x)
    && close(spReloaded.rotationX, spFinal.rotationX)
    && close(spReloaded.rotationY, spFinal.rotationY)
    && close(spReloaded.rotationZ, spFinal.rotationZ)
    && close(spReloaded.scaleX, spFinal.scaleX);
  if (!roundTrips) fail(`reload did not round-trip: ${JSON.stringify({ spFinal, spReloaded })}`);
  await page.screenshot({ path: path.join(OUT, 'c09-after-reload-roundtrip.png') });
  ok('values round-trip through save/reload (fresh boot reads them back)', { spReloaded });

  const hardErrors = results.consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
  results.rawConsoleMessages = results.consoleErrors;
  results.consoleErrors = hardErrors;
  results.pass = hardErrors.length === 0;
  await page.close();
} catch (err) {
  results.error = String(err?.message ?? err);
  results.pass = false;
} finally {
  await writeFile(path.join(OUT, 'c09-roundtrip-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ pass: results.pass, error: results.error, steps: results.steps.map((s) => `${s.ok ? 'OK' : 'FAIL'} ${s.step}`) }, null, 2));
process.exit(results.pass ? 0 : 1);
