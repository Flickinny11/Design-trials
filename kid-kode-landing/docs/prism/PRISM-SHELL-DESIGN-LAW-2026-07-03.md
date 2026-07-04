# PRISM SHELL DESIGN LAW — 2026-07-03 ADDENDUM

> Founder-directed 2026-07-03 (verbatim anchors below). Governs ALL shell/app-
> builder UI surfaces from this date, alongside PRISM-MASTER-SPEC.md DESIGN LAW
> and DESIGN-REFERENCES.md. Where they conflict on shell surfaces, THIS wins.
> Engine-interior assets (canvas/galaxy/preview, incl. MSDF font atlases) stay
> governed by their existing specs; migrating them is a separate founder-gated
> decision — no mid-chain font/material swaps inside the engine.

## Founder anchors (verbatim)
"premium premium premium - it's not just simply css and stuff like
glassmorphism and other outdated methods of design are forbidden as is also
grotesque fonts - the UI must be premium as of today's standards, nothing
flat, no ai slop, must have custom unique 3D icons that use geometric shapes
and the color red and black and white and 3D and shading - NO icon packs can
be used whatsoever. must use ambient light refractions and photorealistic 3D
textures and premium color palettes and designs as of today July 3, 2026...
fast, feel fast, responsive, works great on mobile and desktop."

## Laws (numbered; each violation = judge MUST-FIX)

- **DL1 — Dark-first.** The dark theme is designed FIRST; light adapts from
  it. True-black OLED base; hierarchy via elevation + subtle grey steps, not
  color noise. (2026 professional default; >80% mobile users run dark.)
- **DL2 — Palette.** RED / BLACK / WHITE is the identity. The canonical
  material + icon system is the prototype's shared `premium.ts`
  (red/black/white photoreal, smoked cube, chrome bezel — commits 9632880e,
  66272881). The shell EXTENDS this system; it never invents a parallel one.
- **DL3 — Typography.** Grotesque / neo-grotesque display faces (Inter,
  Helvetica, Arial class) are FORBIDDEN on shell surfaces. The 2026 premium
  pairing governs: expressive neo-serif display + data-grade monospace
  utility (metadata, numerals, buttons), variable-font, kinetic restraint
  (weight/width may respond to scroll on heroes only). Exact faces chosen at
  shell W0 WITH rendered evidence frames for founder sign-off.
- **DL4 — No flat glassmorphism.** CSS backdrop-blur "frosted card" treatments
  are FORBIDDEN. Depth and glass come from REAL rendered material —
  TSL/WebGPU refraction-glass, specular + refraction responding to camera,
  hover, and surrounding content. If light doesn't move, it doesn't ship.
- **DL5 — Icons.** NO icon packs or icon libraries, ever (lucide, heroicons,
  phosphor, material — all forbidden). Every icon is a custom 3D geometric
  form in red/black/white with true shading, from the premium.ts system.
  No emoji anywhere in product or code output.

- **DL6 — Motion with weight.** Micro-interactions carry physical weight —
  ease, settle, gravity; NOTHING LINEAR on hero interactions. Motion exists to
  communicate state and cause/effect (drop targets gravitate, saves settle),
  never as confetti. Artificial confirm-pauses permitted where they build
  trust.
- **DL7 — Engineered precision over soft blur.** Crisp 1px hairlines, exact
  geometry, deliberate spacing. Blurred drop-shadow stacks and 2024-style
  soft-UI padding are out. Bento/modular blocks only where content hierarchy
  is natural — never as decoration.
- **DL8 — Performance is a design law.** Shell first paint is instant-feeling
  on 4G mobile; heavy 3D showpieces lazy-load behind meaningful first paint.
  Prism is the justified WebGL case (the brand IS the 3D experience) but a
  showpiece may never block LCP. Desktop AND mobile verified every wave.
- **DL9 — AI-slop tells are forbidden.** Purple-gradient-on-dark template
  look, stock hero blobs, templated shadow ramps, generic SaaS hero grids,
  emoji bullets, lorem imagery. A judge screenshot matching any tell is an
  automatic MUST-FIX.
- **DL10 — Photoreal texture mandate.** Ambient light refraction and
  photorealistic 3D texture appear on every showpiece surface and key
  control; working surfaces stay clean-but-premium so they remain usable
  (materiality on showpieces + key controls, restraint elsewhere).

## 2026 context (research retrieved 2026-07-03)
Taste leaders are dismantling flat Liquid-Glass/glassmorphism in favor of
clarity-with-craft; dark-first workflows are the professional norm;
neo-serif + monospace pairing is the premium typographic signature displacing
grotesques; motion has consolidated into state-communicating systems with
physical weight; WebGL ships where the brand is the experience, gated on
performance budgets. Sources: tubikstudio.com (Liquid Glass dismantling,
craft-with-authorship), fireart.studio (tactile precision, neo-serif +
monospace, kinetic type), midrocket.com (dark-first default), pixelmatters.com
(refined optical depth, motion systems), studiomeyer.io (WebGL performance
reality check), haddingtoncreative/envato (calm premium, restraint).

---
*Addendum authored 2026-07-03 under direct founder instruction (this date's
session). Applies to shell surfaces immediately; referenced by tonight's
FINISH-F3/F4 + MASTERPIECE prompts for any shell-adjacent chrome they touch.*
