PHASE 3B — SPEC HARDENING (DOCS ONLY). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8  (set explicitly. NOT opusplan — it falls back to Sonnet.
       State the active model on line 1 and confirm it is claude-opus-4-8.)
CONTEXT: 1M window.
MODE: SPEC AUTHORING — you may create/edit/move ONLY documentation files (*.md)
      under Design-trials/kid-kode-landing/docs/prism/ and the two CLAUDE.md docs
      named below, plus a new SPEC-INDEX.md. You may NOT touch source code, hooks,
      scripts, the .ralph-migration-active marker, package.json/lockfiles/deps, and
      you may NOT run/build/deploy the app or commit. Stay on prism-editor-build.
PATHS: git root = Design-trials/ ; app = Design-trials/kid-kode-landing/ (= kkl/).
       Ignore the empty top-level Prototype_Prism/kid-kode-landing/ stub.

================================ DECISIONS (locked) =========================
- RULER: Design-trials/PRISM-INTENT-ANCHOR.md (v2). If any spec/doc/code conflicts
  with it, the anchor wins. Recency only breaks ties between deliberate revisions;
  a loop-ratified spec that mirrors the broken build is SUSPECT, not authoritative.
- CANONICAL-3 specs (the only build-truth specs):
  1) PRISM-RUNTIME-SPEC.md      (you create — see Task A)
  2) PRISM-NODE-EDITOR-SPEC.md  (you create — see Task B)
  3) PRISM-CANVAS-EDITOR-SPEC.md (ALREADY hardened + on disk — ADOPT as-is, Task C)
- Three modes are CORRECT and final: galaxy | canvas | preview-app. They are states
  of ONE continuous view, not panes. (Canvas spec calls preview-app "Preview" — same
  mode; note the equivalence, keep `preview-app` as the toggle id.)
- Preview-app = the SAME scene as canvas with editing handles hidden + live drivers —
  NOT a separate compiled mount. One unified three/webgpu scene, WebGL2 fallback,
  ONE three instance (no CDN-import-map vs bundled-three split).
- Galaxy resting representation = dormant SPHERES (labels, content icons, visual-type
  icon, size∝contents). Built state (artifacts) appears only in canvas/preview-app.
- Caching: content-hash builtSnapshot per node+hub; toggling modes serves cache and
  NEVER rebuilds (anchor §4 / canvas §11). Build is explicit (Build All / Build
  Selected / Build Node). Build plays the anchor §4 pop-transition, then caches.
- Node editor = a node's PURPOSE (backend/functions/integrations/schema/caption).
  Visual exception: image/video/3D artifacts show in its "visual" section; code-based
  artifacts only after build. Visual/spatial/animation editing = canvas, NOT node
  editor. There is NO visual-editor mode inside the node editor.
- Edit path (Decision 3): ONE edit→save→build→VERIFY→preview path with caption-driven
  cold-context repair (small model reads node+hub captions, fixes, re-verifies). The
  current path does NOT work; spec it as to-be-built. The legacy VisualPreview
  regen-API path is SUPERSEDED → future-source (engine-tier regeneration).
- docs/prism/* OUTRANK notes/prism-spec-extract.md. The CLAUDE.md "docs/prism/* not
  on disk" claim is FALSE. Renderer migration is DONE.
- FUTURE-SOURCE (set aside, not junk): engine/harness/diffusion/caption material.
- Do NOT re-encode the rescinded "no scene-level animation outside the primitives
  library" trigger (canvas decision 6 rescinds it).

================================ INPUTS ====================================
Read in full, in this order:
1. Design-trials/PRISM-INTENT-ANCHOR.md (ruler).
2. kkl/docs/prism/PRISM-CANVAS-EDITOR-SPEC.md (adopt; align the other two to it).
3. kkl/notes/SPEC-RECONCILIATION-REPORT.md (the contradiction map + bucketing —
   REUSE it; do not re-derive). Also Design-trials/AUDIT_REPORT.md for corroboration.
4. The existing repo specs/docs it references (docs/prism/*, notes/*, both CLAUDE.md).
5. Source ONLY as reference, to make specs match reality where reality is correct
   (e.g., the single-pane page.tsx, the working preview-store/rebuild plumbing). Do
   not change any source.

================================ TASKS ====================================
A. CREATE kkl/docs/prism/PRISM-RUNTIME-SPEC.md — hardened format mirroring the canvas
   spec's structure (How-to-read; DECISIONS; INVARIANTS; behavior; NUMBERED ATOMIC
   SUCCESS CRITERIA with observable evidence; FORBIDDEN PATTERNS; RE-VERIFY-AT-BUILD-
   TIME). Cover: the one unified three/webgpu scene + WebGL2 fallback + single-three
   invariant; the three-mode state+tooling toggle (replacing the separate compiled
   PrismHost mount); the build action + anchor §4 pop-transition; builtSnapshot
   caching + never-rebuild-on-toggle; capability tiers; `<app>_world` storage role.
   Supersede the relevant parts of PRISM-RENDERER-MIGRATION-SPEC.md and the
   preview-as-compile parts of PRISM-EDITOR-BUILD-SPEC.md (cite the superseded lines).

B. CREATE kkl/docs/prism/PRISM-NODE-EDITOR-SPEC.md — same hardened format. Cover:
   galaxy camera rig (free 3D nav; click hub/node → zoom+lock; deep zoom to any node);
   node presentation (spheres, exterior label = built artifact name, content icons +
   visual-type icon, size∝contents); tethers (animated, color-coded, node↔hub +
   node↔node); hub editor panel (slides from right; page background, page plan, per-
   node info, captions) + the `global` hub; node editor = purpose + the visual-section
   exception; caption storage/display/edit; the ONE edit→save→build→verify→preview
   path with caption-driven cold-repair. Align boundaries with the canvas spec:
   behavior/function wiring lives HERE; visual/animation authoring lives in canvas;
   canvas trigger buttons assign animation drivers only. Respect INV-1 (graph topology
   FROZEN; additive-only schema).

C. ADOPT PRISM-CANVAS-EDITOR-SPEC.md as canonical. Do NOT rewrite it. Add ONLY a short
   top "Reconciliation" note if needed: preview≡preview-app; cross-ref the build pop-
   transition to the runtime spec; confirm the node-editor/canvas boundary matches B.

D. CREATE kkl/docs/prism/SPEC-INDEX.md — precedence (anchor → canonical-3 → supporting
   {CINEMATIC-PRIMITIVES-LIBRARY.md, spec-deviations-prism.md} → future-source →
   archive), a supersession table (what replaces what, with line cites), and the move
   list. Reconcile CINEMATIC-PRIMITIVES-LIBRARY.md against the canvas spec's 300+
   primitive catalog (note overlap/extension; do not delete).

E. RESOLVE doc-level contradictions by editing DOCS only: fix the false "docs/prism/*
   not on disk" claim and the PixiJS / "migration IN PROGRESS" / split-pane language
   in kkl/CLAUDE.md; retire the stale 5-mode text wherever it sits beside 3-mode text;
   add a "SUPERSEDED BY <x> — archived <date>" header to each superseded spec and MOVE
   it to kkl/docs/prism/archive/ (git mv; move, never delete). Do NOT touch the
   .ralph-migration-active marker, hooks, scripts, or code — only NOTE them in the
   index as pending STEP-3 actions.

F. Record the rescinded no-bespoke-animation trigger: find where it's encoded; remove
   it from any SPEC TEXT; if it also lives in a hook rule, NOTE that for step 3 (do not
   edit hooks).

G. CREATE kkl/notes/SPEC-HARDENING-RESIDUALS.md — anything that needs Logan's decision
   that surfaced during hardening (genuine design questions only), each with your
   recommendation. Do not decide these yourself.

================================ SELF-CHECK + OUTPUT ======================
Before finishing: cross-check anchor + canonical-3 for mutual consistency; if any two
canonical specs still conflict, fix the non-canvas one (canvas is adopted as-is) or, if
it needs Logan, log it in G. Then print: the list of files created/edited/moved (with
line counts), the supersession table, and the residuals list. Evidence-based: when you
claim a contradiction, quote the real file:line. Do NOT hardcode dependency versions —
put version/endpoint checks in each spec's RE-VERIFY-AT-BUILD-TIME section (the build
step researches current versions).

================================ SCOPE LOCK ===============================
- Edit/create/move ONLY *.md under docs/prism/ (+ archive/), the two CLAUDE.md docs,
  SPEC-INDEX.md, and notes/SPEC-HARDENING-RESIDUALS.md.
- NO source code, hooks, scripts, markers, package.json/deps. NO app run/build/deploy.
  NO commit (leave staged for Logan's review).
- Do not read Logan's Claude.ai project-knowledge docs (you can't see them).
- When done, stop and print the summary. HEAD stays prism-editor-build.
