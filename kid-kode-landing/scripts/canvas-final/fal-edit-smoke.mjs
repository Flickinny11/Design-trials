import { fal } from '@fal-ai/client';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lp = join(repoRoot,'notes/verification/canvas-final/fal-ledger.json');
fal.config({ credentials: process.env.FAL_KEY });
const base = 'https://v3b.fal.media/files/b/0a9e2a33/aZP8yT_MMEwWsNrc9LMiO_Sy2XM2f7.png';
const t=Date.now();
try {
  const r = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
    input: { prompt:'turn it into glowing blue ice, frosted, cold', image_url: base, strength:0.8, num_images:1 }, logs:false });
  const url = r.data?.images?.[0]?.url;
  console.log('EDIT OK', url, 'ms', Date.now()-t);
  const l = existsSync(lp)? JSON.parse(readFileSync(lp,'utf8')): {total:0,calls:[]};
  l.calls.push({at:'2026-06-13',model:'fal-ai/flux/dev/image-to-image',purpose:'edit endpoint verify',estCost:url?0.02:0,ok:!!url,ms:Date.now()-t,requestId:r.requestId});
  l.total=Math.round(l.calls.reduce((s,c)=>s+(Number(c.estCost)||0),0)*1000)/1000;
  writeFileSync(lp, JSON.stringify(l,null,2)+'\n');
  console.log('spend $'+l.total);
} catch(e){ console.log('EDIT ERR', e?.message, e?.status); }
