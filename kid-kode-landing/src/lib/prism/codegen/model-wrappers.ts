// W-VIS D6 — per-model protocol wrappers, grounded in the W-BAKEB fence/prose
// evidence (notes/bakeoff-b/bundles-index.json, design axis):
//
//   claude-haiku-4.5   fenced 40/40 (100%)          -> raw-output wrapper
//   deepseek-v4-flash  fenced 38/39 (97%)           -> raw-output wrapper
//   gemini-3.5-flash   unparsed 22/40 + fenced 8/40 -> raw-output + no-prose wrapper
//   glm-5.2            unparsed 17/33 + fenced 12   -> raw-output + no-prose wrapper
//   kimi-k2.7-code     unparsed 4/17                -> no-prose wrapper
//   claude-sonnet-5    4 transform errors           -> plan-then-code (structure)
//   fable/opus/gpt-oss/mercury: clean               -> checklist-only
//
// Universal upgrades (every model):
//   1. plan-then-code preamble — 5-line comment plan BEFORE the module body;
//   2. constraint checklist ordered AT THE END of the prompt (recency).
//
// The wrapper wraps the USER TURN only — L1/L2 system bytes are untouched.

export interface ProtocolWrapper {
  /** Prepended before the task body. */
  preamble: string;
  /** Appended after the task body — the END-ordered constraint checklist. */
  postamble: string;
}

const PLAN_THEN_CODE = [
  'Before writing the module, plan: open the module with a 5-line comment block',
  'stating (1) the composition (what sits where), (2) the light rig, (3) the',
  'material strategy, (4) the motion, (5) the single focal element. Then write',
  'the complete module implementing that plan.',
].join('\n');

const RAW_OUTPUT = [
  'OUTPUT FORMAT: reply with RAW module source only. Do NOT wrap the code in',
  'markdown fences (no ``` anywhere). Your first output character must be the',
  'first character of the module (a comment slash or the word import).',
].join('\n');

const NO_PROSE = [
  'Do not write ANY prose, explanation, apology, or summary — before, after,',
  'or inside the reply. Code and code comments only. A reply containing prose',
  'fails the deterministic parse gate and is discarded.',
].join('\n');

/** The doctrine constraint checklist, ordered AT THE END of every prompt —
 *  the last thing the model reads before generating. */
export const CONSTRAINT_CHECKLIST = [
  'FINAL CONSTRAINT CHECKLIST — verify each item before you finish:',
  '[ ] Imports ONLY from: three/webgpu, three/tsl, gsap, @/primitives, @/text.',
  '[ ] Exactly one `export default function createNode(config, ctx)` — synchronous, returns THREE.Object3D.',
  '[ ] EVERY spec element implemented (text items, colors incl. accent, effects, interactions, primitives).',
  '[ ] Text rendered via ctx.fontAtlas (MSDF) — never TextGeometry, never baked letterforms.',
  '[ ] Real lighting: key + fill + rim (or the selected preset rig) — no unlit flat fills on 3D surfaces.',
  '[ ] Palette discipline: dark stage, paper text, ONE signal-red accent — no default blue.',
  '[ ] No flat empty regions — the stage is graded/atmospheric, never void (DL16).',
  '[ ] userData.cleanup() disposes every geometry, material, texture, and kills every GSAP timeline.',
  '[ ] No document.*, no window.* (except devicePixelRatio), no addEventListener.',
  '[ ] The @spec-manifest comment maps EVERY listed element id to a real code location.',
].join('\n');

/** Evidence-keyed wrapper table. Keys are contestant ids (bakeoff) and the
 *  production model ids that map to them. */
const WRAPPER_RULES: Record<string, { raw?: boolean; noProse?: boolean }> = {
  'claude-haiku-4.5': { raw: true },
  'deepseek-v4-flash': { raw: true },
  'gemini-3.5-flash': { raw: true, noProse: true },
  'glm-5.2': { raw: true, noProse: true },
  'kimi-k2.7-code': { noProse: true },
};

function normalizeModelId(modelId: string): string {
  const m = modelId.toLowerCase();
  if (m.includes('haiku')) return 'claude-haiku-4.5';
  if (m.includes('deepseek')) return 'deepseek-v4-flash';
  if (m.includes('gemini')) return 'gemini-3.5-flash';
  if (m.includes('glm')) return 'glm-5.2';
  if (m.includes('kimi')) return 'kimi-k2.7-code';
  return m;
}

export function buildProtocolWrapper(modelId: string): ProtocolWrapper {
  const rules = WRAPPER_RULES[normalizeModelId(modelId)] ?? {};
  const preambleParts = [PLAN_THEN_CODE];
  if (rules.raw) preambleParts.push(RAW_OUTPUT);
  if (rules.noProse) preambleParts.push(NO_PROSE);
  return {
    preamble: preambleParts.join('\n\n'),
    postamble: CONSTRAINT_CHECKLIST + (rules.raw ? '\n[ ] Reply is RAW source — zero markdown fences.' : ''),
  };
}

/** Compose a full upgraded user turn: wrapper preamble, task body (spec +
 *  presets + manifest block + exemplars), checklist LAST. */
export function wrapUserTurn(modelId: string, taskBody: string): string {
  const w = buildProtocolWrapper(modelId);
  return `${w.preamble}\n\n${taskBody}\n\n${w.postamble}`;
}
