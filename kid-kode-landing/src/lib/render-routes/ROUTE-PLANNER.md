# Render-route planner — decision table (W-PHOTO D1)

The premium web kills "looks digital" by **choosing the right rendering
strategy per element**, not by forcing one renderer to film quality. This module
(`src/lib/render-routes/`) is the typed decision layer Conductor / prompt-to-node
consult to pick one of four routes for each element.

## The four routes

| route  | pipeline        | what it is                                                                                                    | interaction                                          | realism                                   | bytes                                |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------- | ------------------------------------ |
| **R1** | realtime PBR    | real geometry + PBR + the D4 cinematic floor                                                                  | up to **manipulate** (live rotate/configure/relight) | reaches photoreal via the floor           | geometry-driven (higher)             |
| **R2** | photo composite | photographic imagery cut out, depth-mapped, shadow-plated, graded, assembled as a layered parallax scene (D2) | up to **parallax** (no navigate/edit)                | **photoreal** (photographs are photoreal) | image-cheap (lowest for the realism) |
| **R3** | baked hybrid    | real geometry with **baked** lighting/AO                                                                      | **navigate** (no live relight)                       | high                                      | mesh + lightmap (moderate)           |
| **R4** | gaussian splat  | a captured/generated 3DGS volume flown through (D5)                                                           | **navigate** (no per-part edit)                      | photoreal (captured reality)              | splat files (largest)                |

## The four inputs

- **interaction** — `none < parallax < navigate < manipulate` (how directly the user drives this element).
- **realism** — `stylized < high < photoreal` (the ceiling it must reach to not look digital).
- **byteBudget** — `tight < moderate < generous` (bytes we can spend on assets).
- **motion** — `static < ambient < continuous < responsive` (motion character it must sustain).
- **sourceKind** (optional) — `procedural | photo | capture | mesh` (gates R2/R4).

## How the decision is made

`planRoute(inputs)` **scores all four routes**, disqualifies any that violate a
hard constraint, and returns the best survivor with a rationale + fallback +
confidence. Scoring (not a rigid cascade) means near-ties surface as **low
confidence** — Conductor can then ask the user rather than guess. R1 is never
disqualified, so it is the guaranteed floor.

### Hard disqualifiers (constraint, not preference)

- **R2** is disqualified when interaction ≥ `navigate` — a flat composite cannot be flown through or edited.
- **R4** is disqualified when byteBudget is `tight` (splats are large) **or** interaction is `manipulate` (a splat has no editable parts).
- Any non-R1 route is disqualified when a declared `sourceKind` cannot feed it (e.g. a `mesh` source cannot become a splat).

### Canonical decision matrix

Verified live by `tests/unit/render-routes.test.ts` (the `decision matrix` case
prints this). `conf` = winner's margin over the runner-up; `fb` = fallback.

| element                              | interaction | realism   | bytes    | motion     | source     | → route | conf | fallback |
| ------------------------------------ | ----------- | --------- | -------- | ---------- | ---------- | ------- | ---- | -------- |
| watch configurator                   | manipulate  | photoreal | generous | responsive | —          | **R1**  | 0.95 | R3       |
| layered-photo hero                   | parallax    | photoreal | moderate | continuous | photo      | **R2**  | 0.85 | R1       |
| editorial gallery (still)            | none        | photoreal | tight    | ambient    | photo      | **R2**  | 0.90 | R1       |
| captured-environment fly-through     | navigate    | photoreal | generous | ambient    | capture    | **R4**  | 0.65 | R1       |
| navigable product (mesh, no capture) | navigate    | high      | moderate | ambient    | mesh       | **R3**  | 0.65 | R1       |
| splat under tight budget             | parallax    | photoreal | tight    | ambient    | capture    | **R2**  | 0.90 | R1       |
| stylized procedural particle hero    | parallax    | stylized  | moderate | responsive | procedural | **R1**  | 0.85 | —        |

The two "photoreal but low-interaction" rows land on **R2** because R1 would pay
geometry cost for a look photographs already have. The "photoreal + navigate"
rows split on **byte budget + source**: a real capture with a generous budget →
R4; otherwise the composite (R2) or baked geometry (R3) carries it.

## From a route to a build

`routeToRealization(route)` returns the concrete Prism build hints:

| route | renderMode                      | asset slots                                        | primitives                               | cinematic floor (D4)                                 |
| ----- | ------------------------------- | -------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| R1    | `mesh`                          | `meshUrl`, `materialSpec`                          | `orbit`, `magnetic-cursor`               | `contact-shadow`, `imperfection-veil`, `filmic-post` |
| R2    | `parallax-plane`                | `sourceUrl`, `depthMapUrl`, `compositeManifestUrl` | `layered-photo-scene`, `parallax-scroll` | grade baked at pipeline time                         |
| R3    | `mesh`                          | `meshUrl`, `materialSpec`, `bakedLightmapUrl`      | `depth-rotate`                           | `contact-shadow`                                     |
| R4    | `null` (codeRef / owned canvas) | `splatUrl`                                         | `fly-through`                            | —                                                    |

R4 maps to a **null renderMode** deliberately: the splat viewer is an owned-canvas
component (Spark, WebGL2), never a new engine `RenderMode` (DEV-3, INV-1).

## From intent to a decision (prompt-to-node)

`deriveInputsFromIntent({ text })` turns loose brief/prompt language into
`RouteInputs` by keyword (explicit fields always win, missing fields fall back to
`interaction=none, realism=high, byteBudget=moderate, motion=ambient`). So the
planner is reachable directly from natural-language authoring:

```ts
const inputs = deriveInputsFromIntent({ text: brief.heroDescription });
const decision = planRoute(inputs);
const build = routeToRealization(decision.route);
```
