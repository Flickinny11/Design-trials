// CANVAS-FINAL — confirm the UNPROVEN media-gen lanes end-to-end against real
// fal (3D / edit / code). Image lane already proven; video proven in the June
// showcase. Records cost to the build ledger. Run:
//   node --env-file=.env.local scripts/canvas-final/fal-lanes-smoke.mjs
import { fal } from '@fal-ai/client';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ledgerPath = join(repoRoot, 'notes', 'verification', 'canvas-final', 'fal-ledger.json');
if (!process.env.FAL_KEY) { console.error('NO FAL_KEY'); process.exit(1); }
fal.config({ credentials: process.env.FAL_KEY });

function load() { return existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : { budget:50, warnAt:[25,40], hardStop:48, total:0, calls:[] }; }
function record(l, e) {
  l.calls.push({ at: new Date().toISOString().slice(0,10), ...e });
  l.total = Math.round(l.calls.reduce((s,c)=>s+(Number(c.estCost)||0),0)*1000)/1000;
  mkdirSync(dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(l, null, 2) + '\n');
  if (l.total >= 40) console.warn(`⚠️  SPEND $${l.total} past $40`);
  else if (l.total >= 25) console.warn(`⚠️  SPEND $${l.total} past $25`);
}
function guard(l, est) { if (l.total + est > (l.hardStop ?? 48)) { console.error(`BUDGET STOP $${l.total}+$${est}`); process.exit(1); } }

const ledger = load();
const out = {};

// 0) base image to drive 3D + edit
console.log('▶ base image (flux-2 512²)…');
guard(ledger, 0.004);
let t = Date.now();
const base = await fal.subscribe('fal-ai/flux-2', {
  input: { prompt: 'a single ornate brass pocket compass on pure black, product render, no text', image_size:{width:512,height:512}, num_images:1 },
  logs: false,
});
const baseUrl = base.data?.images?.[0]?.url;
record(ledger, { model:'fal-ai/flux-2', purpose:'lanes-smoke base image', estCost:0.004, ok:!!baseUrl, ms:Date.now()-t, requestId:base.requestId });
out.image = { ok: !!baseUrl, url: baseUrl };
console.log('   base:', baseUrl);

// 1) 3D (trellis — cheapest)
try {
  console.log('▶ image→3D (trellis)…');
  guard(ledger, 0.02); t = Date.now();
  const r = await fal.subscribe('fal-ai/trellis', { input: { image_url: baseUrl }, logs:false });
  const meshUrl = r.data?.model_mesh?.url ?? r.data?.model_glb?.url ?? r.data?.glb?.url ?? r.data?.model_urls?.glb;
  record(ledger, { model:'fal-ai/trellis', purpose:'lanes-smoke 3D', estCost:0.02, ok:!!meshUrl, ms:Date.now()-t, requestId:r.requestId });
  out.mesh = { ok:!!meshUrl, url: meshUrl, dataKeys:Object.keys(r.data||{}) };
  console.log('   mesh:', meshUrl, 'keys:', Object.keys(r.data||{}));
} catch(e){ out.mesh={ok:false,err:String(e?.message||e)}; console.log('   3D ERR', e?.message); record(ledger,{model:'fal-ai/trellis',purpose:'lanes-smoke 3D FAIL',estCost:0,ok:false}); }

// 2) edit / img2img (flux-2 dev i2i)
try {
  console.log('▶ image edit (flux-2 i2i)…');
  guard(ledger, 0.02); t = Date.now();
  const r = await fal.subscribe('fal-ai/flux-2/dev/image-to-image', {
    input: { prompt:'turn it into glowing blue ice, frosted, cold', image_url: baseUrl, strength:0.85, num_images:1 },
    logs:false,
  });
  const url = r.data?.images?.[0]?.url;
  record(ledger, { model:'fal-ai/flux-2/dev/image-to-image', purpose:'lanes-smoke edit', estCost:0.02, ok:!!url, ms:Date.now()-t, requestId:r.requestId });
  out.edit = { ok:!!url, url, dataKeys:Object.keys(r.data||{}) };
  console.log('   edit:', url);
} catch(e){ out.edit={ok:false,err:String(e?.message||e)}; console.log('   EDIT ERR', e?.message); record(ledger,{model:'fal-ai/flux-2/dev/image-to-image',purpose:'lanes-smoke edit FAIL',estCost:0,ok:false}); }

// 3) code / compose (any-llm)
try {
  console.log('▶ compose (any-llm)…');
  guard(ledger, 0.006); t = Date.now();
  const r = await fal.subscribe('fal-ai/any-llm', {
    input: {
      model:'anthropic/claude-3.5-sonnet',
      system_prompt:'Reply with ONLY a JSON object: {"meshPrimitive":{"kind":"...","params":{}},"materialSpec":{}}',
      prompt:'Compose a glowing brass torus. JSON only.',
    },
    logs:false,
  });
  const output = r.data?.output;
  record(ledger, { model:'fal-ai/any-llm', purpose:'lanes-smoke compose', estCost:0.006, ok:!!output, ms:Date.now()-t, requestId:r.requestId });
  out.code = { ok:!!output, output: typeof output==='string'? output.slice(0,300):output, dataKeys:Object.keys(r.data||{}) };
  console.log('   compose output:', typeof output==='string'? output.slice(0,200): JSON.stringify(r.data).slice(0,200));
} catch(e){ out.code={ok:false,err:String(e?.message||e)}; console.log('   COMPOSE ERR', e?.message); record(ledger,{model:'fal-ai/any-llm',purpose:'lanes-smoke compose FAIL',estCost:0,ok:false}); }

console.log('\n=== LANE SMOKE RESULT ===');
console.log(JSON.stringify(out, null, 2));
console.log(`\nfal spend total: $${load().total} / $50`);
