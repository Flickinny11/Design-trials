STEP 8.6 — ICONS: push more overtly 3D / dimensional / premium (custom only). Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
       FOCUSED session (NOT dynamic workflows).
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** only.
      Verify with /prism-verify; produce EVIDENCE (screenshots + console). Shut down any dev
      server you start. Do NOT commit (leave staged for Logan's design review). Stay on
      prism-editor-build. Run from git root.

Use the EXISTING Prism design language already in the codebase as the reference (do not look
for external skill files — they are not on this machine). Step-3 verification system is LIVE
— USE it. ANTI-STUCK RULE: after ~2 failed attempts, STOP, web-search the current correct
approach, root-cause, retry; NEVER downgrade or take the easy path.

================================ DIRECTIVE (Logan) ========================
The current custom icons are good but too flat. Push them to read as overtly 3D, dimensional,
and PREMIUM — while staying CUSTOM (no stock icon libraries; the guard already blocks them):
- Real depth/extrude, a consistent KEY-LIGHT direction across ALL icons, specular sheen/
  highlight, soft contact shadow, subtle bevel — a cohesive material/lighting language so the
  set looks like one premium family.
- Keep them crisp and legible at toolbar sizes; performant (prefer richly-layered SVG/CSS
  depth + gradients/filters over live per-icon 3D scenes, unless a given icon is trivially
  cheap). It must look 3D, not necessarily be a live 3D render.
- Apply consistently to EVERY icon in the editor (toolbar rail + tool flyouts + TopBar +
  Inspector + mode toggle + Minimap + HubNav). One unified, dimensional, premium set.

================================ OUT OF SCOPE ==============================
Functionality changes (this is purely the icon visual treatment); the deferred toolbar
groups' actual features; the primitive catalog; engine/harness. Keep all wired tools working.
If the guard or a forbidden pattern blocks you, STOP and report.

================================ VERIFY (evidence-based "done") =============
Run /prism-verify in canvas mode:
- DESIGN: SCREENSHOT close-ups of the icon rail, a tool flyout, the TopBar, and the Inspector
  showing the new dimensional treatment, plus the full canvas. (Logan art-directs from these.)
- ASSERT still zero stock-icon-lib imports; build clean; guard still blocks re-adds.
- FUNCTION: wired tools still work (select→move an element; build); console ZERO new errors;
  toggling modes still rebuilds nothing.
The prism-criteria-reviewer subagent (fresh context; diff + criteria only) must sign off.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/STEP8_6-ICONS-3D-REPORT.md: files changed, EVIDENCE (screenshots + assertions
+ console + reviewer verdict). Save screenshots under kkl/notes/verification/step8_6/. NO
commit. End with a PLAIN-LANGUAGE summary of the icon design choices for Logan to react to.
Then STOP. HEAD stays prism-editor-build.
