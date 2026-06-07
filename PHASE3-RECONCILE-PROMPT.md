PHASE 3 — SPEC RECONCILIATION (READ-ONLY). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8   (set explicitly. Do NOT use opusplan — it silently
       falls back to Sonnet for implementation. Confirm the active model is
       claude-opus-4-8 before doing anything, and state it in your first line.)
CONTEXT: use the 1M context window.
MODE: READ-ONLY ANALYSIS. You will make ZERO changes to any spec, source file,
      hook, config, branch, or marker. You will NOT run the app, NOT switch
      branches, NOT commit. Stay on `prism-editor-build`.
THE ONLY FILE YOU MAY CREATE is the report named in OUTPUT below. Nothing else.

================================ DECISIONS (locked) =========================
- The anchor for all judgments is `PRISM-INTENT-ANCHOR.md` (repo root). When a
  spec/doc/the code contradicts the anchor, the ANCHOR is correct.
- "Recency wins" decides between deliberate spec revisions ONLY. It does NOT
  make a spec correct just because it is newest — a recent Ralph loop may have
  rewritten a spec to ratify the broken build. Treat such text as SUSPECT.
- `docs/prism/*` outranks `notes/prism-spec-extract.md`. The CLAUDE.md claim
  that "docs/prism/* are NOT on disk" is FALSE (they exist) — flag it, do not act.
- The PixiJS->Three migration is DONE (settled). Do not reopen it.
- Two specs matter NOW: the RUNTIME spec and the NODE-EDITOR spec. Engine /
  harness / diffusion / caption material is FUTURE-SOURCE (set aside, not junk).
- Do NOT propose or apply fixes. Do NOT pick a winner on any contested point.
  Surface everything for Logan to resolve.

================================ INPUTS TO READ ============================
1. `PRISM-INTENT-ANCHOR.md` (repo root) — the anchor. Read first, in full.
2. Repo specs: everything under `kid-kode-landing/docs/prism/` and
   `kid-kode-landing/notes/` (incl. spec extracts, gap analyses, amendments),
   and `kid-kode-landing/CLAUDE.md` + nested CLAUDE.md files.
3. SOURCE CODE (to verify spec-vs-code against the anchor). At minimum:
   - runtime: src/lib/prism/runtime/** (mount.ts, mount-graph.ts, scene-root,
     adapter, factories/**), src/lib/prism/player/**
   - editor: src/components/editor/** (graph/GraphScene, the view-mode toggle,
     panels), src/lib/editor/** (preview-commit, rebuild-node, clone-*,
     canvas-camera*), src/stores/** (graph source / preview state stores)
   - the page entry: src/app/page.tsx

================================ TASKS ====================================
A. BUCKET every spec/doc into exactly one of:
   - RUNTIME (canonical-candidate)   - NODE-EDITOR (canonical-candidate)
   - FUTURE-SOURCE (engine/harness/diffusion/caption — set aside)
   - ARCHIVE (superseded / duplicate / cruft)
   Give file + one-line reason per item.

B. CONTRADICTION LIST in THREE separate categories. For each entry: quote
   file:line (and the code location where relevant), classify, and state what
   the ANCHOR-correct behavior is. Do NOT propose the fix.
   B1. DOC-vs-DOC   (e.g. the C1–C5 family: canonical-claimant conflicts,
       5-vs-3 view modes, PixiJS-vs-Three stale language, migration status).
   B2. SPEC-vs-INTENT — every place a spec encodes a forbidden pattern from
       anchor §5 (F1 split-screen dual-state; F2 preview-as-separate-screen;
       F3 copied/stand-in artifacts; F4 inert editing; F5 persistent dual
       state) or otherwise contradicts anchor §1–§4 or §6.
   B3. CODE-vs-INTENT — verify against the ACTUAL source: Does clicking Preview
       perform the §3 state transition (nodes leave sphere-state, build, animate
       to coded positions, run their code), or does it just load a different
       view/screen? Do node-editor edits reach the node store and propagate via
       Save-and-Rebuild (anchor §4), or are they inert (F4)? Does a split-screen
       dual-state surface (F1) exist in the code? Quote the code that proves
       each answer.

C. LOOP-RATIFIED-SPEC RISK: list spec sections that appear to have been
   auto-rewritten to describe the current (broken) build rather than intent —
   anything that reads like "the implementation does X, therefore the spec says
   X" where X conflicts with the anchor.

D. MISSING-FOR-INTENT: list behaviors the anchor requires that NO current spec
   defines well enough to build against (these become the hardening to-do).

================================ OUTPUT ===================================
Write ONE file: `kid-kode-landing/notes/SPEC-RECONCILIATION-REPORT.md`
Structured by the sections above (A,B1,B2,B3,C,D). Evidence-based: quote real
lines, never assert. End with a short "TOP CONTRADICTIONS FOR LOGAN TO RESOLVE"
list (the highest-leverage 5–10, intent-violations first). Then STOP.

================================ SCOPE LOCK ===============================
- No edits to any spec/source/hook/config/marker. No commits. No branch switch.
- Do not run, build, or deploy the app.
- Do not attempt to read Logan's Claude.ai project-knowledge docs — you cannot
  see them; Logan handles those separately. Reconcile only what is on disk.
- The ONLY write is the report file above. When it is written, stop and print
  its path + the TOP CONTRADICTIONS list.
