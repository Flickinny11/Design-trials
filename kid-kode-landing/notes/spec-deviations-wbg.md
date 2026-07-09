# SHELL W-BG — Spec deviations of record

Authored FIRST per the W-BG mission ("notes/spec-deviations-wbg.md first").
Each entry states the mission language, the deviation, and why it is the
honest engineering call. Anything not listed here is built as specified.

## DEV-1 — "background node" ⇒ background LAYER STACK on `PrismHub.background`

The mission says prompt-to-background output "runs in the prism runtime as a
proper background node". In this repo backgrounds are NOT `PrismNode`s — the
established, judged schema (3DBG A6, W-TPL, W-2D) is a typed
`PrismHubBackgroundLayer[]` stack on `PrismHub.background`, rendered by
`HubBackgroundStack` inside the ONE unified scene. Making generated
backgrounds a `PrismNode` would fork the background architecture (two ways to
own the backdrop → z-fighting, compile ambiguity, INV-R2 risk). Deviation:
generated output is a first-class background **layer stack** (same schema the
library presets emit), which is what "proper" means in this codebase. It runs
in the prism runtime because the runtime renders `hub.background` (verified
in this wave; wired where missing — see report §D8).

## DEV-2 — Tier vocabulary: "tier-1 desktop" ⇒ this repo's T2

The mission asks for "perf numbers (60fps desktop tier-1)". The repo's device
tier vocabulary (3DBG D4, `src/lib/editor/backgrounds/tier.ts`) is
T0 < T1 < T2 with **T2 = desktop/WebGPU full budget**. "Desktop tier-1" is
read as "the top desktop tier", i.e. **T2**. Perf evidence is captured at T2
on the WebGPU backend.

## DEV-3 — Preview thumbs are BAKED real renders, not 60 live canvases

"Each entry: preview thumb (real render)." Mounting 50-60 live WebGPU
canvases in the picker would exhaust GL contexts (W4 gotcha) and tank perf.
Deviation in mechanism, not in substance: every entry's thumb IS a real
render — captured once from the live runtime scene by a capture script
against a lab route, baked to `public/three-d-bg/thumbs/<preset-id>.webp`
(DL13 bake doctrine), and shown as an `<img>` on the card. Hover gives the
genuinely-live preview (the preset applies transiently to the real scene).
The CSS swatch remains only as the loading/absent fallback.

## DEV-4 — Prompt-to-background R2/R3 requires a provider key; honest R1 fallback

R2 (photo-composite plate) and R3 (baked graded plate) call Replicate
server-side. When `REPLICATE_API_TOKEN` is absent (demo checkout), the
generate endpoint does NOT fake a photo result: it plans the route honestly,
reports the downgrade in the response (`downgraded: true`, reason string),
and realizes the request as R1 (procedural synthesis from the grammar
family + hub palette), which needs no external call. This mirrors the W10
"demo-safe when `.assetgen` absent" and W1A "AWAITING-KEYS honest state"
doctrine. On this machine keys ARE present, so the live evidence sequence
exercises the real R2 path.

## DEV-5 — "Saved to the user's library" ⇒ per-tenant server-side JSON store

There is no dedicated asset-library service. Generated backgrounds persist
via the same per-tenant store idiom the rest of the shell uses (W1A I11):
a server-side per-tenant collection keyed by the authenticated tenant, CRUD
via tRPC/route, surfaced in the picker as a "My Library" category. Baked
plate assets live under `public/three-d-bg/generated/` (public URLs only in
graph data, INV-7/INV-R13 — never secrets).

## DEV-6 — Splat family stays at its existing footprint

The mission's family list doesn't name splats, and Tripo/splat generation is
budget-heavy with low background-catalog leverage. The existing splat preset
(`captured-observatory`) is retained and categorized, but the expansion
invests the spend budget in R2 graded plates (FLUX + depth), where the
per-entry visual distinctness is highest. Tripo credits: 0 planned.

## DEV-7 — Palette additions stay inside the DS token universe (INV-9)

New entries need more colour identities than the 4 existing palettes, but
INV-9 (no purple) and the Chrome-Arc token discipline stand. New background
palettes are composed from existing DS token ramps (ice/metal/graphite/
signal hues already in `design-system/tokens`) plus plate-derived tones for
photo entries; zero purple, zero new token invention.
