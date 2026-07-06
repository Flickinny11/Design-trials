// PROMPT-TO-TEXTURE API (spec §2.4) — SERVER-ONLY. Takes a surface description,
// runs the committed FLUX pipeline (.assetgen/gen-material.sh) to generate ONE
// tileable plate, then derives a MATCHED-LATENT + DELIT PBR set, writes it under
// public/prism-mock/editor/textures/generated/<id>/, and returns a MaterialDef seed.
//
// SECRETS DISCIPLINE (INV-19): the Replicate key lives in .assetgen/replicate.key
// and is read ONLY by the child process — it never enters the graph, the client
// bundle, or this response. This route runs on the Node runtime (child_process).

import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { recordCapabilityUsage } from '@/lib/flight-recorder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// FLIGHT RECORDER (W-FR): mirror each prompt-to-texture invocation into the
// corpus. Additive + fail-open. The prompt is captured as scrubbed content; the
// resulting material-def id is the asset reference. `ok` records success/failure
// so a failed generation is still metered (data honesty).
function recordMaterialGen(input: { prompt: string; ok: boolean; assetRef?: string }): void {
  recordCapabilityUsage({
    touchpoint: 'material-gen',
    otel: {
      'gen_ai.provider.name': 'replicate',
      'gen_ai.operation.name': 'generate_content',
      'gen_ai.request.model': 'flux-2-pro',
      'gen_ai.output.type': 'image',
      'gen_ai.input.messages': [{ role: 'user', parts: [{ type: 'text', content: input.prompt }] }],
    },
    prism: { 'prism.capability.id': 'material-gen.prompt-to-texture', 'prism.cost.unit': 'usd', 'prism.cost.estimated': true },
    capability_id: 'material-gen.prompt-to-texture',
    result_asset_ref: input.assetRef,
    ok: input.ok,
  });
}

type Kind = 'metal' | 'stone' | 'wood' | 'ceramic' | 'fabric' | 'generic';
const KINDS: Kind[] = ['metal', 'stone', 'wood', 'ceramic', 'fabric', 'generic'];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'material';
}

// Infer a kind from the prompt when not given (drives metalness/roughness baselines).
function inferKind(prompt: string): Kind {
  const p = prompt.toLowerCase();
  if (/\b(metal|brass|bronze|copper|steel|gold|chrome|alloy|iron|aluminum|titanium|gunmetal|silver|pewter)\b/.test(p)) return 'metal';
  if (/\b(marble|granite|stone|onyx|slate|travertine|concrete|terrazzo|quartz|rock|mineral)\b/.test(p)) return 'stone';
  if (/\b(wood|oak|walnut|teak|mahogany|bamboo|timber|plank|grain|maple|ebony)\b/.test(p)) return 'wood';
  if (/\b(ceramic|porcelain|glaze|tile|clay|terracotta|stoneware)\b/.test(p)) return 'ceramic';
  if (/\b(fabric|velvet|leather|linen|denim|suede|cloth|wool|silk|textile|canvas|knit)\b/.test(p)) return 'fabric';
  return 'generic';
}

function titleCase(slug: string): string {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export async function POST(req: Request) {
  let body: { prompt?: string; kind?: string; seed?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 }); }
  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return NextResponse.json({ ok: false, error: 'empty prompt' }, { status: 400 });

  const id = slugify(prompt);
  const kind: Kind = body.kind && KINDS.includes(body.kind as Kind) ? (body.kind as Kind) : inferKind(prompt);
  const seed = Number.isFinite(body.seed) ? Number(body.seed) : 7 + (id.length * 7) % 900;

  const assetgen = path.resolve(process.cwd(), '..', '.assetgen');
  const script = path.join(assetgen, 'gen-material.sh');
  if (!existsSync(script)) {
    return NextResponse.json({ ok: false, error: 'gen pipeline not found', script }, { status: 500 });
  }

  const result = await new Promise<{ code: number; out: string; err: string }>((resolve) => {
    const child = spawn('bash', [script, prompt, id, kind, String(seed)], { cwd: assetgen });
    let out = '', err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve({ code: 124, out, err: err + '\nTIMEOUT' }); }, 200000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, out, err }); });
  });

  if (result.code !== 0 || !result.out.includes('MATERIAL-GEN-DONE')) {
    recordMaterialGen({ prompt, ok: false });
    return NextResponse.json({ ok: false, error: 'generation failed', code: result.code, detail: result.err.slice(-400) || result.out.slice(-400) }, { status: 500 });
  }

  // parse the derive step's suggested params.
  let params: Record<string, unknown> = {};
  const m = result.out.match(/PARAMS (\{.*\})/);
  if (m) { try { params = JSON.parse(m[1]); } catch { /* keep empty */ } }

  const dir = `/prism-mock/editor/textures/generated/${id}`;
  recordMaterialGen({ prompt, ok: true, assetRef: `generated.${id}` });
  return NextResponse.json({
    ok: true,
    def: {
      id: `generated.${id}`,
      family: 'Generated',
      label: titleCase(id),
      params,
      maps: { source: 'generated', dir, repeat: [1.5, 1.5] },
    },
  });
}
