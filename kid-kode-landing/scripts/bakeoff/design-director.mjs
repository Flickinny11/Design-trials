#!/usr/bin/env node
// W-BAKE D1 — design-director pass (OD12a): Fable 5 authors the 20 visual
// corpus cases' full visualSpecs ONCE, with concrete values (hex ramps, type
// scale, spacing rhythm, camera+light params, material refs, cubic-bezier
// curves, contrast minimums). Output + full CLI transcript are committed under
// notes/bakeoff/corpus/visual/. The corpus then FREEZES (I-B2).
//
// Route: the claude CLI (`--print --model claude-fable-5`) — the founder's
// authenticated Anthropic route on this machine (.constellation/ OpenRouter
// key does not exist on disk; disclosed in the report). Cost is ledgered from
// the CLI's total_cost_usd.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
const VISUAL_DIR = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual');
const skeletons = JSON.parse(readFileSync(path.join(VISUAL_DIR, 'skeletons.json'), 'utf8'));
const world = readFileSync(path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'functional', 'l2-world.txt'), 'utf8');

const DESIGN_LAW = [
  'DESIGN LAW (DL1-DL16, abridged for authoring):',
  'DL1 dark-first. DL2 palette: RED/BLACK/WHITE discipline — ink/near-black surfaces, paper text, one signal red accent.',
  'DL3 typography: grotesque/neo-grotesque discipline; committed MSDF families available: Inter, Space Grotesk, Lora, Bebas Neue, JetBrains Mono.',
  'DL4 no flat glassmorphism. DL6 motion with weight (weighted settle, overshoot then rest).',
  'DL7 engineered precision over soft blur. DL9 AI-slop tells forbidden (no default-blue drift, no generic gradients).',
  'DL10/DL11 rendered materiality: real PBR values, never CSS-style flatness. DL12 primary buttons are physical objects.',
  'DL16 rich, never void: no flat empty backgrounds; every region carries texture, depth, or structure.',
].join('\n');

function directorPrompt(cases) {
  return [
    'You are the DESIGN DIRECTOR for the Prism model bakeoff (W-BAKE, OD12a).',
    'Author the definitive visualSpec for each corpus case below. These specs are FROZEN and every',
    'contestant model must execute them exactly, so every value must be CONCRETE and unambiguous.',
    '',
    'THE WORLD (all cases live in this app world; stay within its token discipline):',
    world,
    '',
    DESIGN_LAW,
    '',
    'FOR EACH CASE return an object with:',
    '- caseId: (copy exactly)',
    '- visualSpec.colors: concrete hex ramp — background, surface, ink, paper, accent, plus any gradient stops as [{at,hex}].',
    '- visualSpec.typography: family (from the committed MSDF set), fontSize px, fontWeight, letterSpacing em, lineHeight for each text role used.',
    '- visualSpec.effects: ONE string, densely concrete: geometry/construction (sizes in scene units), material params (roughness/metalness/clearcoat/emissive hex+intensity), spacing rhythm (base unit multiples), motion (property, from->to, duration ms, cubic-bezier(x1,y1,x2,y2)), depth/lighting interaction.',
    '- visualSpec.textContent: array of { text, role, typography: { fontSize, fontWeight } } — REAL copy for the Nova Atelier world. ASCII ONLY (no em-dashes, no smart quotes, no bullets, no arrows).',
    '- sceneSpec.camera: { position:[x,y,z], lookAt:[x,y,z], fov } framing the element well (element is centered at origin, roughly 2-4 scene units wide).',
    '- sceneSpec.lights: array of { type: "ambient"|"directional"|"point"|"spot", color: hex, intensity, position?:[x,y,z] } — a deliberate rig (key/fill/rim where 3D).',
    '- sceneSpec.background: hex for the stage clear color (dark-first).',
    '- sceneSpec.motionNote: one line on what should visibly move.',
    '- contrastMinimum: e.g. "4.5:1 body text on surface; 3:1 large display".',
    '',
    'CASES:',
    JSON.stringify(cases, null, 2),
    '',
    'OUTPUT: STRICT JSON ONLY, no markdown fences, shaped exactly:',
    '{ "cases": [ { "caseId": "...", "visualSpec": {...}, "sceneSpec": {...}, "contrastMinimum": "..." } ] }',
  ].join('\n');
}

function runDirector(cases, label) {
  const prompt = directorPrompt(cases);
  const out = execFileSync(
    'claude',
    [
      '--print',
      '--model', 'claude-fable-5',
      '--settings', '{"hooks":{},"disableAllHooks":true}',
      '--disallowedTools', '*',
      '--no-session-persistence',
      '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--output-format', 'json',
      prompt,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900000 },
  );
  const envelope = JSON.parse(out);
  writeFileSync(path.join(VISUAL_DIR, `design-director-transcript-${label}.json`), JSON.stringify({
    ranAt: new Date().toISOString(),
    model: 'claude-fable-5',
    route: 'claude-cli-print',
    promptChars: prompt.length,
    totalCostUsd: envelope.total_cost_usd,
    durationApiMs: envelope.duration_api_ms,
    usage: envelope.usage,
    result: envelope.result,
  }, null, 2));
  let text = (envelope.result ?? '').trim();
  if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(text);
  return { cases: parsed.cases, costUsd: envelope.total_cost_usd };
}

mkdirSync(VISUAL_DIR, { recursive: true });
const half = Math.ceil(skeletons.length / 2);
const batches = [skeletons.slice(0, half), skeletons.slice(half)];
const allCases = [];
let totalCost = 0;
for (let i = 0; i < batches.length; i += 1) {
  console.log(`design-director batch ${i + 1}/${batches.length} (${batches[i].length} cases)...`);
  const r = runDirector(batches[i], `batch${i + 1}`);
  allCases.push(...r.cases);
  totalCost += r.costUsd ?? 0;
  console.log(`  -> ${r.cases.length} cases authored, cost $${(r.costUsd ?? 0).toFixed(4)}`);
}
writeFileSync(path.join(VISUAL_DIR, 'design-director-output.json'), JSON.stringify({
  author: 'claude-fable-5 (design director, OD12a)',
  route: 'claude-cli-print',
  authoredAt: new Date().toISOString(),
  totalCostUsd: totalCost,
  cases: allCases,
}, null, 2));
console.log(`wrote design-director-output.json (${allCases.length} cases, total $${totalCost.toFixed(4)})`);
