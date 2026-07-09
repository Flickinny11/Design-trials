# WUXV P4 — Designer Usability Study: Prism Editor ("Yuki")

(Verbatim final report of the fresh-context persona agent. Committed
unsoftened per wave law. Frames in this directory.)

**Persona: Yuki, 29, senior product/visual designer.** Session at 1440×900, all interaction via mouse/keyboard/eyes.

## 1. JOURNEY LOG

| # | Intent | Action | Result | Feel |
|---|--------|--------|--------|------|
| 1 | Orient | Loaded localhost:3010 | Landed on a running luxury watch site "ORRERY No.7 — Time, machined." in Preview App view | Immediately legible; premium |
| 2 | See modes | Clicked Galaxy | 7-step guided tour auto-opened: "Three views, one living scene" | Delighted — real onboarding |
| 3 | Learn modes | Stepped tour 1→6 | Galaxy=app-as-universe (free camera), Canvas=compose one hub (14-tool toolbar), Preview App=running app | Crystal-clear mental model |
| 4 | Work freely | Tried Galaxy/Canvas after tour ended | **Button state flipped but canvas stayed frozen on the watch preview** | Confused — first friction |
| 5 | Recover | Reloaded page | Chrome remounted, but tour re-triggered from step 1 | Mildly annoyed (tour not persisted) |
| 6 | Dismiss | Clicked SKIP | Clean Galaxy view: 6 hub-clusters + minimap (56 elements) | Back on track |
| 7 | New hub | Clicked "New hub from template" | Picker: 16 named templates, 9 category chips, search, R1/R2 badges | Impressed by the catalog |
| 8 | Test filters | Gallery chip → search "particle" | Filter narrowed to 2; search matched family tags | Fast, correct |
| 9 | Instantiate | Selected Meridian, named it "Client Lookbook", Create | Auto-dropped a 17-node photographic teal diorama page as a new planet + auto-entered Canvas | Genuinely wowed |
| 10 | Section | "Add a section" → Stat Band → Drop | Hub went 17→23 elements; new node auto-selected | Worked; landed off-screen below |
| 11 | Backgrounds | Toolbar "Background" | 60-background catalog, 8 categories, real thumbnails, tier + 2D-OK metadata | Rich, designer-grade |
| 12 | Hover preview | Hovered cards on Meridian hero | No visible change — opaque photo hero occluded the bg layer | Hmm, dead-end here |
| 13 | Hover (retry) | Switched to Arrival hub, hovered North Aurora | Background live-swapped to a clean field; reverted on un-hover | The promise IS real |
| 14 | Apply | Clicked Canopy Light | Scene became a photographic god-ray forest; "· on" marker persisted | Dramatic, committed |
| 15 | Generate | Typed "slow drifting aurora over deep indigo, calm, cinematic" → Generate | Completed near-instantly; applied "Verdant Light (R1 · cinematic-video)"; logged to MY LIBRARY | Fast, but green not indigo |
| 16 | 2D/3D | Tilted 3D diorama, flipped MODE→2D | Scene flattened to a face-on flat page; flip back restored depth | Clear, reversible, useful |
| 17 | Ship check | Preview App | Watch site running with my generated aurora bg live | "One scene, three views" is true |

**Counters:** Actions ~55 · Hesitations 3 · Backtracks 2 (reload; hub-switch to find visible bg) · Dead ends 1 (hover-preview on a photo-hero hub).

## 2. COUNTERS PER TASK
- **T1 Orient:** actions 9 · hesitations 1 · backtracks 1 · dead ends 0
- **T2 Templates:** actions 12 · hesitations 0 · backtracks 0 · dead ends 0
- **T3 Backgrounds:** actions 13 · hesitations 1 · backtracks 1 · dead ends 1
- **T4 Prompt-to-bg:** actions 5 · hesitations 0 · backtracks 0 · dead ends 0
- **T5 2D/3D:** actions 6 · hesitations 0 · backtracks 0 · dead ends 0
- **T6 Verdict:** actions 3 · hesitations 0

## 3. CRAFT NOTES

**Praise:**
- **Template instantiation is the standout.** Meridian dropped a complete photographic diorama that reads as an actual photograph, not a digital gradient — teal monochrome held together across depth layers (`wuxv-p4-17`, `wuxv-p4-18`). This is the difference between "AI page builder" and "design tool."
- **Copy is written by people who care.** Element captions like *"Hero headline — molten brass poured into real MSDF letterforms; light sweeps it on entry, it drifts with scroll and recedes as you descend"* (`wuxv-p4-04` inspector). Template descriptions are evocative and accurate. Rare craft.
- **Background catalog is genuinely designer-grade** (`wuxv-p4-21`): 60 entries, real rendered thumbnails (not swatches), motion tags (drift/flow/calm/pulse), performance tiers (T0-T2), 2D-OK flags, an 11-swatch palette re-tint + Density/Drift/Depth/Glow sliders per background. That's a real color-and-motion vocabulary.
- **Hover = transient live preview, apply = commit** (`wuxv-p4-26/27/28` triptych; `wuxv-p4-30` applied god-ray forest). Non-destructive scrubbing is exactly right for exploration.
- **2D/3D flatten is clean and honest** (`wuxv-p4-34` tilted diorama → `wuxv-p4-35` flat page → `wuxv-p4-36` restored). Explanation sits right next to the control.
- **Iconography has escape hatches:** toolbar icons carry numbered tooltips ("07 Background") and labeled panels, so the icon-only rail isn't mystery meat.

**Sins:**
- **The hero's focal 3D object never resolves** — a tiny unresolved speck sits dead-center in the watch hero across every frame (`wuxv-p4-01`, `wuxv-p4-07`, `wuxv-p4-37`). For a luxury brand the centerpiece jewel reading as a dot is the single biggest polish miss.
- **Mode buttons desync from the canvas after the tour** (`wuxv-p4-09`, `wuxv-p4-10`): Galaxy/Canvas showed `[active]` in the DOM while the canvas stayed frozen on the Preview. Required a reload.
- **Generated color ignored my literal word.** I asked for "deep **indigo**"; it produced "**Verdant** Light" (green) (`wuxv-p4-32`). Mood/motion respected, color word overridden by hub context.
- **New section lands off-screen** — the dropped Stat Band went to Y≈-9.85 with no auto-scroll to it (`wuxv-p4-20`).

## 4. DEAD ENDS & MISLEADING AFFORDANCES
- **Dead end — hover preview on a photo-hero hub** (`wuxv-p4-23/24`): the panel says "Hover to preview it live on this hub," but Meridian's full-bleed photo hero occludes the background layer, so nothing visibly changes. Took switching to a hub with negative space (Arrival) to confirm hover-preview even works. It should either preview in a thumbnail or note "background sits behind the hero here."
- **Misleading — post-tour mode desync** (`wuxv-p4-09/10`): the mode strip looks interactive and reports the new mode, but the view doesn't follow. Classic "did my click register?" trap.
- **Two doors to the same room:** backgrounds are reachable from both the toolbar "Background" tool (left flyout) and the hub Inspector's "3D BACKGROUND" (right panel). Same catalog, mild redundancy.

## 5. INTERVIEW (in character)

**Q1 — What is this editor and what did you make today?**
"It's a 3D-native page/site editor where your whole app is a galaxy of 'hubs' (pages), you compose each hub on a Canvas, and you watch the running result in Preview App — all one continuous scene. Today I built a new page from the 'Meridian' template, named it Client Lookbook, dropped a Stat Band section into it, restyled another page's background from a starfield to a god-ray forest, generated an aurora background from a text prompt, and flattened a page from 3D to 2D and back."

**Q2 — Top 3 confusions.**
"One: after the welcome tour ended, the mode buttons stopped switching the view and I had to reload. Two: hover-preview on my photo-hero page showed nothing, so I thought the feature was broken until I tried a page with open background. Three: two different entry points for backgrounds — a left flyout and a right panel — made me unsure which was 'the' one."

**Q3 — Where did you almost give up?**
"The hover-preview dead end. The panel explicitly promises a live preview on hover, and on the page I'd just built it did absolutely nothing. A less patient person concludes it's broken. I only recovered because I understood that a photo hero occludes the background layer."

**Q4 — What delighted you as a designer?**
"Instantiating Meridian. I clicked one card and got a real photographic diorama — proper depth layers, a cohesive teal palette, a glass object — that reads like a photograph, not a CSS gradient. And the writing everywhere ('molten brass poured into real MSDF letterforms…') tells me the people who built this actually care about craft. The 60-background catalog with real thumbnails, palettes, and physical sliders is the kind of vocabulary I'd expect from a mature tool."

**Q5 — Would you use it for client work over your current tools for interactive 3D sites?**
"For pitching and rapid look-dev of a premium, motion-forward landing page — yes, it's faster and more coherent than wiring Spline into Webflow myself. For production hand-off today — not quite: I need visible previews before I commit (the picker is prose-only), I need the hero's focal object to actually render, and I need the mode-desync bug gone. It's a genuinely promising 80%; the missing 20% is exactly the reliability and preview polish clients see."

**Q6 — First thing you'd change.**
"Add real thumbnail/hover-play previews to the template pickers. I'm a visual person choosing from sentences — 'a cursor-reactive editorial gallery' is lovely copy but I can't *see* the layout or motion before I drop a 17-node page into my galaxy."

## 6. SCREENSHOT INDEX
- 01 initial load (watch site) · 02–03 Galaxy + onboarding · 04 Canvas tour (14-tool toolbar) · 05–06 tour steps 5–6 · 07 Preview App
- 08–10 **post-tour mode desync** · 11 tour re-triggers on reload · 12 Galaxy clean
- 13 **hub template picker** · 14 Gallery filter · 15 search "particle" · 16 Meridian selected (Preview link + name field) · 17 **hub created — Meridian diorama live** · 18 Client Lookbook + full hub Inspector
- 19 **Add-a-section picker** · 20 Stat Band dropped (17→23)
- 21 background toolbar flyout · 22–24 **hover on photo hero = occluded (dead end)** · 25–26 Arrival before · 27 **hover live-preview (North Aurora)** · 28 hover reverts · 29 Ember applied · 30 **Canopy Light applied (god-ray forest)**
- 31 generate in progress · 32 **generated "Verdant Light" applied + MY LIBRARY entry**
- 33 Lookbook 3D · 34 **3D diorama tilted** · 35 **2D flattened** · 36 back to 3D · 37 **Preview App with generated bg live**

## 7. HONEST-STATE NOTES (quoted exactly)
- Prompt-to-background completion + persistence gate: **"Generated (not saved to a library — sign in to keep it)."** (session-only; MY LIBRARY count = 1)
- Generated entry metadata: **"Verdant Light — R1 · cinematic-video — 'slow drifting aurora over deep indigo, calm, cinematic'"**
- 2D/3D control explanation (hub Inspector): **"RENDER MODE (W-2D) … Non-destructive both ways — node depth and camera journeys are preserved while 2D, just unused. Depth tools grey out on a 2D hub."**
- Background generation panel: **"Describes a look → Prism reads this hub's elements, palette and mood, picks a design-grammar family, and builds it as a real background (procedural or a generated photo plate)."**
- **No dollar/credit cost was shown at any point** — generation ran freely with no charge prompt, so I did not need to stop before submitting.
