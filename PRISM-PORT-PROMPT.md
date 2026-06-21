# PRISM PRODUCTION PORT — master brief (de-brassed)
_Supersedes every brass reference in EDITOR-EXPERIENCE-PROMPT.md. Its DESIGN LAW + phase
structure remain binding; its "Observatory Brass"/"true-3D brass hero" lines are DEAD
(Logan condemned brass 2026-06-18). Model: inherit session (Fable 5 / Opus-4-8, 1M).
ULTRACODE. Branch `prism-editor-build`. Git root `/Users/loganbaird/Prototype_Prism/Design-trials`,
app `kid-kode-landing/`. `unset NODE_ENV` before any node/npm._

## CONTEXT
The redesign slice is **GATE-PASSED** (`redesign-slice/SLICE-REPORT.md`: 2 of 3 fresh-context
reviewers PASS, all axes ≥4, "not generic", zero brass). This brief ports that approved identity
INTO the production editor, **REPLACING (not re-skinning)** the condemned brass identity. Logan
gates each increment with **go / check**.

## IDENTITY — the locked, approved design language
- **Palette:** substrate void `#0d1117` / graphite `#161b22` / fog `#1f2530`; metals chrome
  `#dfe2e6`, titanium `#b8bcc0`, mercury `#e0e4ea`; anodized `#2d5fa3` (surface TINT, never
  emission); arc-cyan `#1ec8ff` (emission / active state ONLY); warning-arc `#ff8c1e`. ZERO
  brass/gold/amber. No pure `#fff`/`#000`. No purple.
- **Type:** Sora (display / wordmark / buttons) + JetBrains Mono (HUD labels, all-caps, tracking
  +0.2em). No grotesque anywhere.
- **Material law (DESIGN.md):** every surface has measurable Z-thickness; made of machined
  chrome/titanium/anodized/mercury, not painted; dual-bezel edges (top highlight + bottom
  shadow) + stacked-shadow depth (NEVER a single drop-shadow); emission only on active state;
  transitions material-physical (morph/displace/absorb), never optical fade; easing out-expo /
  out-quart only — NO bounce/elastic/back.
- **Token source of truth:** `/Users/loganbaird/OpenDesign/design-systems/prism/tokens.css`
  (+ `DESIGN.md`). Map the production `--ds-brass-*` ramp + `DS.brass*` onto these.
- **Production-quality recipe reference:** `redesign-slice/index.html` — real `WebGLRenderer` +
  ACESFilmic + procedural studio IBL (`PMREMGenerator.fromScene(env, 0.012)`, no external HDRI);
  transmission works in a full WebGL scene; restrained `UnrealBloomPass` + radial
  chromatic-aberration + SMAA; NO clearcoat over metal (that was the "plastic" read).

## DOGFOODING (EDITOR-EXPERIENCE DESIGN LAW — still binding)
Our chrome must be the single best ad for what Prism builds. Build surfaces with the SAME toolkit
the primitives use — TSL/WebGPU shaders, the refraction-glass system, GSAP/Theatre motion, the
410 primitives, `docs/prism/DESIGN-REFERENCES.md` deps, prompt-to-texture, fal.ai for hero
assets — NOT Tailwind/CSS approximations and NOT `backdrop-filter`. Every chrome surface needs:
photoreal 3D depth, visible beveled edges that catch light, cast + contact/AO shadows,
ambient + key/fill/rim lighting, scene-sampling refraction + semi-translucency, smooth OKLCH
gradients, animated expand/collapse + hover/press micro-interactions.

## HARD FAILS (machine veto + reviewer veto)
brass/gold/amber · grotesque fonts · flat surfaces · single drop-shadow fake depth ·
glassmorphism/`backdrop-filter` · Lucide/Feather/Heroicons/emoji icons · naked 1px edges ·
CSS-faked 3D · bouncy/elastic easing · purple · star-glyph logo.
Enforced by `scripts/anti-default-scan.mjs` (must exit 0 on touched surfaces) AND 3 fresh-context
reviewers (author ≠ judge).

## METHOD (every increment)
1. **Map** — run the scanner; read targets + canonical refs.
2. **Port** — replace, not re-skin; schema changes additive; `tsc` 0-new; never downgrade a dep;
   never fake — evidence is captured frames + real interaction.
3. **Verify (computer-use)** — Playwright screenshots of the LIVE app at `http://localhost:3000`,
   console-clean, real click-through for functional checks.
4. **Gate** — 3 fresh-context reviewers (render / industrial / anti-default lenses), all axes ≥4,
   majority decides, + scanner == 0. Iterate to pass (cap ~6); fix the named gap, don't rebuild.
5. **Checkpoint** + one line to `notes/MONITOR-FEED.md` + evidence in
   `notes/verification/editor-experience/<phase>/`.

## INCREMENT LADDER (Logan gates each with go/check)
- **F0 FOUNDATION [this increment]:** de-brass tokens (`globals.css`, `tokens.ts`) + favicon
  `icon.svg` + `design-system/page.tsx` + `walkthrough.css`; bespoke **dispersive PRISM logo**
  replaces the gold star; Sora + JetBrains Mono wired. Scanner → 0.
- **F1 CHROME MATERIAL:** replace the brass `chrome-layer`/`useChromeSlab` material with the
  slice's chrome/titanium/anodized/arc-cyan refractive material across toolbars/panels/flyouts/
  buttons (TSL, lit IBL, real depth, scene-sampling refraction).
- **F2 IDENTITY DEPTH:** every icon custom true-3D + animated-on-hover; MSDF type with
  prompt-to-texture; kill all remaining flat surfaces.
- **F3 EXPERIENCE RE-VERIFY:** P1–P8 functional correctness intact on the new skin (staging/build,
  gizmo, text, backgrounds, undo, declutter choreography).
- **F4 DEMO APP (P9):** complete the **5-hub navigable 3D prototype app** — header, footer, nav,
  multiple sections, content blocks, CTAs, imagery — every element a real premium app has, in 3D.
  Must smoke the best SliderRevolution templates.
- **F5 SIGN-OFF (P10):** advocate-driven interactive verification on desktop + mobile +
  constrained; click every control; 0 MUST-FIX.

STOP after each increment. Report to Logan. Await "go".
