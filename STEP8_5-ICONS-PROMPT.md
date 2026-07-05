STEP 8.5 — ICON SYSTEM (custom 3D premium, no stock icons) + full-width keyframe editor. Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
       FOCUSED session (NOT dynamic workflows).
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** + the
      dependency guard. Verify with /prism-verify; produce EVIDENCE (screenshots + console).
      Shut down any dev server you start. Do NOT commit (leave staged for Logan's design
      review). Stay on prism-editor-build. Run from git root.

FIRST: view /mnt/skills/public/frontend-design/SKILL.md and follow it. This is a design
deliverable for the PRISM DESIGN SYSTEM — premium, cohesive, intentional.

Step-3 verification system is LIVE — USE it. ANTI-STUCK RULE: after ~2 failed attempts,
STOP, web-search the current correct approach, root-cause, retry; NEVER downgrade or take
the easy path.

================================ HARD DESIGN RULE (Logan) ==================
NO `lucide-react` and NO stock/third-party icon set ANYWHERE in the app — EVER. Every icon
must be CUSTOM, with a 3D / dimensional, PREMIUM feel, in the Prism visual language (depth,
subtle gradients/lighting/bevel — not flat generic line icons). This applies to the whole
editor, not just the new toolbar.

================================ SCOPE ====================================
1. CUSTOM ICON SET: create a cohesive, custom, 3D-premium icon set (Prism aesthetic) and
   replace EVERY use of `lucide-react` (and any other stock icon library) across the app —
   toolbar, TopBar, Inspector/RightPane, mode toggle, Minimap, HubNav, everywhere. Find all
   usages first (grep `lucide-react` and any icon-lib imports) and replace all of them.
   Keep the icons crisp at toolbar sizes; consistent stroke/volume/lighting language.
2. REMOVE the dependency: drop `lucide-react` from package.json once unused.
3. GUARD IT: add `lucide-react` and stock icon libraries (e.g. react-icons, @heroicons,
   feather, font-awesome) to the dependency-allowlist / forbidden-pattern guard so they can
   never be re-introduced (this is a permanent design-system rule).
4. KEYFRAME EDITOR FULL-WIDTH: when the keyframe editor slides up, it spans the FULL viewport
   width (for finer scrubber/fader control), per Logan. Adjust layout so it reads premium at
   full width.

================================ OUT OF SCOPE (defer) ======================
Implementing the deferred toolbar groups' actual functionality; the primitive catalog;
engine/harness. Keep the existing WIRED tools (transform/select/build) working — just swap
their icons. If the guard or a forbidden pattern blocks you, STOP and report.

================================ VERIFY (evidence-based "done") =============
Run /prism-verify in canvas mode:
- ASSERT zero `lucide-react` (and zero stock-icon-lib) imports remain (grep + build clean);
  the dependency is removed and the guard now blocks it (demonstrate the guard firing on a
  test re-add).
- DESIGN: SCREENSHOT the toolbar + TopBar + Inspector showing the NEW custom 3D-premium
  icons, and the keyframe editor open at FULL WIDTH. (Logan art-directs from these.)
- FUNCTION: the wired tools still work after the icon swap (select→move an element; build);
  console ZERO new errors; toggling modes still rebuilds nothing.
The prism-criteria-reviewer subagent (fresh context; diff + criteria only) must sign off.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/STEP8_5-ICONS-REPORT.md: files changed, EVIDENCE (the no-stock-icons
assertion + guard-fires-on-readd demo + the new-icon screenshots + full-width keyframe
screenshot + console + reviewer verdict). Save screenshots under
kkl/notes/verification/step8_5/. NO commit. End with a PLAIN-LANGUAGE summary calling out the
icon design choices for Logan to react to. Then STOP. HEAD stays prism-editor-build.
