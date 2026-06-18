# P3 Evidence — Identity: logo, icons, typography (2026-06-18)

Verified live in real Chrome (DevTools MCP), canvas mode, tier t2. tsc 0-new (baseline **9**), 0 console errors.
Per RE-VERIFY-DECISIONS.md.

## C15 — bespoke 3D Prism logo (replaces the flat gold star)
- New `src/components/editor/icons/PrismLogo.tsx`: a glassy, brass-bevelled prism that refracts an incoming ice
  beam into a warm Observatory-palette dispersion fan (brass→amber→ice — **no purple**, by brand law). Faux-3D in
  the icon system's single-key-light language (lit top-left edge, shadowed flank, translucent refractive body,
  specular). ALIVE: GSAP idle dispersion shimmer (fan opacity/scale breathe + entry glint twinkle) + hover (beam
  brighten, fan spread, specular streak sweeps the face, 1.07 lift). prefers-reduced-motion guarded.
- Wired into `TopBar.tsx` nameplate inside an **ink housing** (radial ink + brass keyline + brass glow) — matches the
  favicon identity (`src/app/icon.svg` = brass prism refracting a beam). Verified: `svg[aria-label="Prism"]` present;
  14× magnified frame `logo-14x.png` shows the brass prism + dispersion fan clearly. Frames: `logo-magnified.png`, `logo-14x.png`, `masthead-normal.png`.
- Palette = frozen DS brass/ice ramp (f7e9c6/cd9f55/8f6930/ddba77 + a9c2d1 on ink), identical to the favicon.

## C14 — icons: true-3D, animated on hover, MANY idle-animated, de-slopped
- The icon system was already a milled-3D extruded compositor (Icon.tsx). Added MOTION via `icons/icons.css`
  (imported globally in layout.tsx): EVERY `.prism-icon` gets a premium hover micro-interaction (rise toward light
  + brighten + brass glow) triggered by hovering the glyph OR any interactive ancestor (button/role/.ds-press).
  Base contact-shadow routed through `--icon-filter` CSS var so hover/idle COMPOSE (not clobbered by inline filter).
- Curated MANY idle-animated (data-anim): twinkle (sparkle/wand/diamond/snow) + glowpulse (bulb/zap). Live proof:
  **39 .prism-icon on page; idle anims RUNNING — prism-twinkle 3.4s, prism-glowpulse 2.6s**; spin (refresh) / nudge
  (play/arrowRight) correctly hover-only (animationName:none at rest); `.prism-icon` base + `:hover` rules present
  in loaded stylesheets. prefers-reduced-motion disables.
- De-slop: re-authored the generic Lucide-grade `zap` lightning bolt → a distinctive "energized generation" mark (a
  bold faceted bolt + small spark top-right; the AI-prompt-energize motif). Other glyphs are hand-authored milled
  solids (no third-party icon lib in package.json), rendered in the premium extruded style — not stock.

## C16 — typography (Switzer RETIRED)
- `layout.tsx`: display localFont → **Bricolage Grotesque** (`public/fonts/ui/Bricolage-Variable.woff2`, wght 200–800);
  ui localFont → **Inter** (`public/fonts/Inter-Variable.ttf`, neutral workhorse). Mono = JetBrains Mono.
- Live proof: `document.fonts` shows `display:loaded` + `ui:loaded`; the "Prism" wordmark computed font-family resolves
  to the `display` (Bricolage) family. Switzer no longer referenced in layout.tsx.
- Prompt-to-texture dogfood on display text: the SCENE headline ("Time, machined.") already supports real
  texture-fill (shipped TextFillPreviewStrip, 10 candidates of the user's own text). Chrome DOM display text uses the
  Bricolage signature voice; deeper per-glyph DOM texture is a stretch deferred to P10/backlog (DOM text can't carry a
  GPU texture without MSDF — the scene text path covers the dogfood mandate).
