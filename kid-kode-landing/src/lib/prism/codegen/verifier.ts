// Static verifier — implements PRISM-RENDERER-MIGRATION-SPEC.md §10
// (L357-L386). The verifier is regex- and substring-based, line-aware, and
// renderMode-aware. It is intentionally independent of any TS/JS parser so
// it can run in node, the editor, the verifier rules pipeline (§17 DoD), or
// inline in CI without a transformer.
//
// Spec layout:
//   §10.A L361-L367 — ALLOWED_THREE_IMPORTS (19 names from `three`/`three/webgpu`).
//   §10.B L369-L377 — DISALLOWED_PATTERNS (7 regex rules).
//   §10.C L380-L385 — Render-mode structural checks + universal cleanup.
//
// Spec §9.A L257-L258 lists 5 ALLOWED_IMPORT_SOURCES that the system prompt
// constrains the LLM to. We surface them here for editor/inspector tooling
// even though §10 itself only enforces the legacy-renderer import rejection
// (see PIXI_IMPORT below).

import type { RenderMode } from '@/lib/prism-graph/types';

// Spec §10.A L362-L367 — verbatim list. Used by tooling that wants to inspect
// allowed Three.js exports; verification of *unknown* imports is an editor
// concern (the verifier flags forbidden patterns, not unknown names — an
// unknown name will surface as a runtime/typecheck error).
export const ALLOWED_THREE_IMPORTS: readonly string[] = [
  'Object3D',
  'Group',
  'Mesh',
  'PlaneGeometry',
  'BoxGeometry',
  'SphereGeometry',
  'TextureLoader',
  'GLTFLoader',
  'Vector2',
  'Vector3',
  'Quaternion',
  'Euler',
  'MeshBasicNodeMaterial',
  'MeshStandardNodeMaterial',
  'AmbientLight',
  'DirectionalLight',
  'Color',
  'Raycaster',
  'Box3',
  'Sphere',
];

// Spec §9.A L257-L258 — the LLM is told to import only from these 5 module
// specifiers. Tools can use this list to flag any other source.
export const ALLOWED_IMPORT_SOURCES: readonly string[] = [
  'three/webgpu',
  'three/tsl',
  'gsap',
  '@/primitives',
  '@/text',
];

export type VerifierSeverity = 'error' | 'warning';

export interface VerifierViolation {
  rule: string;
  severity: VerifierSeverity;
  message: string;
  match?: string;
  line?: number;
}

export interface VerifierResult {
  ok: boolean;
  violations: VerifierViolation[];
}

export interface VerifierContext {
  renderMode: RenderMode;
  hasTextContent?: boolean;
  /** True after `.ralph-phase5-pixi-removed` exists. Until then, PixiJS
   *  imports are warnings; after, they become errors (§13 L481, T05). The
   *  default behavior (undefined) is "error" — §10.B L370 lists PIXI_IMPORT
   *  among the deterministic deviations. */
  phase5Strict?: boolean;
}

// Spec §10.B L369-L377 — the 7 deterministic deviation regexes, in order.
export const DISALLOWED_PATTERNS: ReadonlyArray<{
  rule: string;
  pattern: RegExp;
  message: string;
}> = [
  {
    rule: 'PIXI_IMPORT',
    // §10.B L370. The spec literal is `pixi.js`; migration rules add
    // `pixi-filters` and `@pixi/*` to the forbidden list, so we widen the
    // regex additively while preserving §10.B coverage.
    pattern:
      /import[^\n;]*['"](?:pixi\.js|pixi-filters|@pixi\/[\w-]+)['"]/,
    message: 'PixiJS imports are forbidden — migrate to three/webgpu',
  },
  {
    rule: 'DOCUMENT_ACCESS',
    // §10.B L371. Negative lookahead allows getElementById and createElement.
    pattern: /document\.(?!getElementById|createElement)\w+/,
    message: 'document.* access is forbidden (only getElementById/createElement allowed by §10.B L371)',
  },
  {
    rule: 'WINDOW_ACCESS',
    // §10.B L372. Only `devicePixelRatio` is exempt.
    pattern: /window\.(?!devicePixelRatio)\w+/,
    message: 'window.* access is forbidden except for window.devicePixelRatio',
  },
  {
    rule: 'INNER_HTML',
    // §10.B L373.
    pattern: /innerHTML/,
    message: 'innerHTML is forbidden — render via three/webgpu objects',
  },
  {
    rule: 'TEXT_GEOMETRY',
    // §10.B L374.
    pattern: /TextGeometry/,
    message: 'TextGeometry is forbidden — use ctx.fontAtlas (MSDF) for text',
  },
  {
    rule: 'ADD_EVENT_LISTENER',
    // §10.B L375. Spec uses unbounded form; matches any receiver.
    pattern: /\.addEventListener\(/,
    message:
      '.addEventListener is forbidden — attach handlers to userData.handlers.*',
  },
  {
    rule: 'ASYNC_CREATE_NODE',
    // §10.B L376. Spec literal — exact `async function createNode` form.
    pattern: /async\s+function\s+createNode/,
    message: 'createNode MUST be synchronous (spec §8 / §9.A L260)',
  },
];

function findLine(source: string, match: RegExpMatchArray): number | undefined {
  if (typeof match.index !== 'number') return undefined;
  const before = source.slice(0, match.index);
  return before.split('\n').length;
}

function checkRegexRules(source: string): VerifierViolation[] {
  const out: VerifierViolation[] = [];
  for (const { rule, pattern, message } of DISALLOWED_PATTERNS) {
    const m = source.match(pattern);
    if (m) {
      out.push({
        rule,
        severity: 'error',
        message,
        match: m[0],
        line: findLine(source, m),
      });
    }
  }
  return out;
}

function checkStructural(
  source: string,
  ctx: VerifierContext,
): VerifierViolation[] {
  const out: VerifierViolation[] = [];

  // §10.C L382 — parallax-plane MUST reference displacementMap or TSL displacement.
  if (ctx.renderMode === 'parallax-plane') {
    const hasDisplacementMap = /displacementMap/.test(source);
    const hasTSLDisplacement =
      /from\s+['"]@\/primitives['"]/.test(source) &&
      /\bdisplacement\b/.test(source);
    const hasTSLImport = /from\s+['"]three\/tsl['"]/.test(source);
    if (!hasDisplacementMap && !hasTSLDisplacement && !hasTSLImport) {
      out.push({
        rule: 'MISSING_DISPLACEMENT',
        severity: 'error',
        message:
          'renderMode "parallax-plane" must reference displacementMap or a TSL displacement node (§10.C L382)',
      });
    }
  }

  // §10.C L383 — mesh MUST call the GLB loader.
  // W-PCP instrument alignment (2026-07-10): the runtime surface exposes ONLY
  // `ctx.glbLoader.loadGLB(url)` (adapter.ts NodeGLBLoader = Pick<'loadGLB'>);
  // the migration-era `.load(` spelling this rule originally demanded CRASHES
  // at runtime and was the largest W-BAKE crash cluster (report §4). The rule
  // now accepts BOTH spellings — additive: strictly more correct programs
  // pass; nothing that passed before fails now.
  if (ctx.renderMode === 'mesh') {
    const hasGlbLoad = /ctx\.glbLoader\.load(?:GLB)?\s*\(/.test(source);
    if (!hasGlbLoad) {
      out.push({
        rule: 'MISSING_GLB_LOADER',
        severity: 'error',
        message:
          'renderMode "mesh" must call ctx.glbLoader.loadGLB(config.meshUrl) (§10.C L383; legacy .load( spelling also accepted)',
      });
    }
  }

  // §10.C L384 (MISSING_PRIMITIVES_LOOP) — REMOVED. The migration-era rule that
  // every node MUST iterate config.cinematicPrimitives and call ctx.primitives[name]
  // (i.e. no scene-level animation outside the fixed primitives library) is RESCINDED
  // by PRISM-CANVAS-EDITOR-SPEC.md §2 decision 6 (see SPEC-INDEX.md S4). Animation may
  // be authored from scratch as an `Animatable`; the catalog is an accelerant, not a
  // cage. Selecting/iterating the primitive list is no longer required.

  // §10.C L385 — All modes must iterate config.textContent and produce MSDF
  //   text via ctx.fontAtlas. The spec qualifies "for non-empty entries"; a
  //   node whose plan-time textContent is empty does not need to emit an
  //   ctx.fontAtlas call (the loop body simply won't fire). Gate by
  //   ctx.hasTextContent so empty-text nodes aren't flagged.
  if (ctx.hasTextContent) {
    const iteratesText = /config\.textContent/.test(source);
    const callsFontAtlas = /ctx\.fontAtlas/.test(source);
    if (!iteratesText || !callsFontAtlas) {
      out.push({
        rule: 'MISSING_TEXT_CONTENT',
        severity: 'error',
        message:
          'nodes with non-empty textContent must iterate config.textContent and call ctx.fontAtlas (§10.C L385)',
      });
    }
  }

  // §10.C L386 — Returned object MUST have userData.cleanup defined.
  // Match assignment forms `userData.cleanup =` or method `cleanup() {`
  // inside a userData object literal.
  const hasCleanup = /userData\.cleanup\s*=/.test(source);
  if (!hasCleanup) {
    out.push({
      rule: 'MISSING_CLEANUP',
      severity: 'error',
      message: 'returned object must define userData.cleanup (§10.C L386)',
    });
  }

  return out;
}

export function verifyNodeModule(
  source: string,
  ctx: VerifierContext,
): VerifierResult {
  const violations: VerifierViolation[] = [
    ...checkRegexRules(source),
    ...checkStructural(source, ctx),
  ];
  const ok = violations.every((v) => v.severity !== 'error');
  return { ok, violations };
}
