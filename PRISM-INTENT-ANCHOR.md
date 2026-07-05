# Prism — Intent Anchor (Core Concept) — v2

**Status:** Authoritative statement of *design intent*. ANCHOR for all spec hardening.
When any spec, doc, or the current implementation contradicts this, THIS wins.
"Recency wins" decides between deliberate spec revisions only; it never authorizes a
spec auto-edited by a loop to ratify the broken build. Intent is the ruler — not the
live URL, not the newest file.

**v2 — 2026-06-01.** Expanded from Logan's detailed description of the three modes,
camera rig, caching/build model, node/hub presentation, the node-editor purpose, the
verify-and-repair edit path, and the `<app>_world`. Canvas-mode internals are stubbed
here pending Logan's dedicated Canvas spec (incoming).

---

## 0. What this prototype IS (and is not)
- The prototype is **only the preview pane** of the eventual Prism AI app builder
  (future builder = streaming chat left, preview pane right). This prototype is that
  right pane: a fully functioning app + its editor.
- We are working **backwards**: get the functioning app + editor right first, then later
  integrate the prompt UI, the build engine, and the harness.
- There is **no file editor / no file system**. The **node graph IS the system** that
  holds everything a traditional app keeps in files.
- Engine, harness, and the "caption" format are later work, delivered as one unified
  Engine+Harness+Runtime spec. There is intentionally **no standalone caption spec**.

## 1. Core definitions
- **Node** — one UI element in **dormant/container form** (a sphere in galaxy mode). It
  *is* the element, not a picture of it. It contains the element's artifact(s) (3D
  object / image / video / code-based artifact), its code, animations, schema/data,
  backend, integrations, functions, tether points, target 3D position, behavior, and
  its **caption** (see §10). Node **size** is relative to what it contains.
- **Hub** — a **page** of the app. Stores the page's background visual, the page plan,
  the list/role of its tethered nodes, and build-critical captions/info for the AI
  builders (§10).
- **`global` hub** — holds elements shared across every page (global UI). Any element
  that repeats on all pages is tethered to the `global` hub.
- **Tether** — animated, thin, mostly-transparent, color-coded lines. Bind nodes to a
  hub and nodes to each other (by shared function/backend/relation).
- **Artifact** — the literal built element (3D object / image / video / code-rendered
  thing). Never a copy, thumbnail, or stand-in.
- **`<app>_world`** — a per-app world that stores app information in a specific shape
  advantageous to the AI models that build the app from prompts. (Prompt/harness not in
  the prototype yet, but the world + hub/node captions are how those models will work.)

## 2. The two-state model (INVARIANT)
A node is in exactly **one** state at any time:
1. **Node-state** — dormant sphere (galaxy).
2. **Built-state** — the artifact is rendered at its coded 3D position, running its code.
**Never both at once.** Any view showing one node simultaneously built and as a sphere
is invalid by definition. The three modes (§3) are different *states* of one continuous
view — NOT multiple adjacent panes/frames.

## 3. The three view modes (toggles): galaxy · canvas · preview-app
These names are CORRECT. One continuous view; the toggle changes node state + tooling.

### 3a. Galaxy (not-built; the "file directory")
- Zoomed-out view of the whole app: **hubs (pages)** with their **nodes orbiting** on
  tethers. The structural/navigational map.
- Node presentation: sphere sized by contents; **exterior label = the built artifact's
  name** (e.g. "navigation menu"); **small colored icons** beside the label for what the
  node holds (e.g. a payment icon for Stripe functions, icons for other integrations/
  functions) and **one icon for visual type** (image / 3D / video / code-based).
- Camera (§5): free 3D nav by mouse + scroll; **clicking a hub or node zooms and LOCKS**
  to a set distance to it.
- Click a hub → camera pulls to it, its tethered nodes appear in orbit, and the **Hub
  editor panel slides in from the right**. Click a node → the **Node editor** opens (§6).

### 3b. Canvas (built; visual editor)
- Switches all nodes to **built-state** (served from cache, §4) AND becomes a **3D
  drag-and-drop visual editor**: click-select, move in 3D space, resize by corner-drag,
  position/where/when in 3D. Home of the **keyframe editor** (in the canvas toolbar).
- **Visual editing happens here**, not in the node editor.
- Full internals are defined by **Logan's Canvas spec (incoming)** — §7 is a stub until
  then.
  > NOTE: Logan's message once said "the galaxy is where the visuals get edited"; read as
  > a slip for **canvas** (the rest of the description is unambiguous). To confirm.

### 3c. Preview-app (built; the running app)
- All nodes in **built-state** = the actual functioning app the user is building — the
  thing destined for the future builder's preview pane.
- It is interactive/real, the literal artifacts running their code (not a screen of
  copied images, §11).

## 4. Caching & build control (INVARIANT: toggling never rebuilds)
- Switching to canvas or preview-app must be **fast**: they show the **cached last
  built-state**, they do **not** rebuild on toggle (rebuilding every toggle is wasteful).
- Building is **explicit**, via buttons available in built-state modes:
  **Build All Nodes** and **Build Selected Nodes**.
- A node's build is the §2 transition (node-state → built-state); the result is **cached**
  so subsequent mode switches are instant until the node is edited + rebuilt (§9).
- The intended build *behavior* (a node leaving sphere-state, animating to its coded 3D
  position, the sphere "popping" to reveal the artifact which then runs its code) is the
  build action itself — triggered by Build, not by entering a mode.

## 5. Galaxy camera rig & presentation (was the §6 "TBD" — now specified)
- Free navigation: mouse-drag + scroll reach any part of the node galaxy.
- **Click-to-zoom-and-lock:** clicking a hub or node flies the camera and locks at a set
  distance to that target. Clicking a hub also reveals its orbiting tethered nodes.
- Deep zoom must reach **any** node (the current build's inability to zoom in far enough
  is a defect to fix).
- **Hub editor panel** (slides from right; sibling of the node editor): stores the page's
  background visual (used when the hub builds), the page plan, info on every tethered
  node, and the captions/critical info for the AI builders (§10).

## 6. Node editor (a node's PURPOSE — not the visual editor)
- Opened by clicking a node in galaxy. Shows/edits the node's **backend, functions,
  integrations, schema, behavior, and caption** — what gives the node purpose.
- **Visual exceptions:** image / video / 3D artifacts DO appear in the node editor's
  **"visual" section**. **Code-based** artifacts do NOT appear until built.
- The node editor is **no longer a visual editor** (change from current). There is no
  "visual editor mode" inside it. Visual editing → canvas (§3b).
- It mostly exists in code already but is not correctly integrated to save/rebuild (§9).

## 7. Canvas mode internals (STUB — pending Logan's Canvas spec)
Canvas is a complex 3D visual editor + keyframe editor. Logan will supply the dedicated
spec. Known requirements to fold in when it arrives:
- 3D manipulation: select, move, corner-resize, position in 3D space and time.
- **Keyframe editor** in the canvas toolbar: select element → "keyframe" → scrub a
  fader forward/back to see THAT element's animation; play.
- **Animation has no video frames**, so the editor needs a **time/length model** that
  spans the different animation kinds, each with its own mouse-driven controls:
  fixed-duration, scroll-linked, pointer/mouse-reactive, and looping/continuous (e.g.
  particles). OPEN DESIGN PROBLEM (Logan was mid-thought on a seconds-based approach);
  resolve in the Canvas spec — candidate: a normalized 0→1 progress timeline whose
  *driver* is per-animation (time / scroll / pointer / loop). Verify current best-practice
  before locking.

## 8. Edit → save → build → VERIFY → preview (Decision 3 — the path does NOT exist yet)
- The current edit/save/rebuild path does nothing in practice. Rebuild this path with
  **verification built in**: edit → save → build the affected node(s) → **verify the
  artifact built and renders + functions correctly** → only then previewable. If it
  won't build/verify, **fix at the moment of breakage** (the just-made edits are the
  cause), don't preview a broken state.
- One unified path (not two parallel systems). Per-node / surgical rebuild (don't
  re-mount everything); update the cache (§4) for the rebuilt node.
- **Caption-driven repair:** on any build/verify failure, dispatch a small internal AI
  model to that node. It reads the **node + hub captions** and contents and — with **no
  prior context** — must be able to understand what the node/hub should do, look like,
  and how it should function, then fix it and re-verify. Multiple verification methods;
  this is one. (Distinct from the build-time drift-prevention that verifies Claude
  Code's edits to the Prism *codebase* — same philosophy, different layer.)

## 9. Captions & world data (living spec for AI builders + repair)
- Every **node** and **hub** carries a **caption**: a self-contained spec rich enough
  that a cold, context-free model can know the element/page's intent, appearance, and
  behavior from the caption + stored contents alone. Captions power §8 repair and the
  future prompt-driven build.
- The `<app>_world` (§1) stores app-level information in the shape those AI models need.
- The precise caption format is part of the FUTURE unified Engine+Harness+Runtime spec
  and must be written the specific way established in the "Prism prototype and dynamic
  workflows advantage" session. The prototype needs caption *storage + display/edit*;
  the formal format is hardened later.

## 10. Forbidden patterns (anti-drift; hunt these in spec + code)
- **F1 — Split-screen dual-state.** Preview-on-left + node-editor-on-right simultaneously.
  Invalid (§2). The modes are states of one view, not panes.
- **F2 — Preview as a separate compiled screen.** Loading a different screen of copied
  images instead of showing the actual built nodes (from cache).
- **F3 — Copied/stand-in artifacts.** Built modes must show the literal artifacts, never
  copies/placeholders (e.g. empty-Group stand-ins).
- **F4 — Inert editing / no verification.** Edits that don't build, don't verify, or
  don't reach the node; previewing an unverified/broken build.
- **F5 — Persistent dual state** of one node.
- **F6 — Rebuild-on-toggle.** Re-building nodes every time a mode is selected instead of
  serving the cache (§4).
- **F7 — Visual-editor-mode inside the node editor.** Visual editing belongs to canvas.

## 11. On the current build (do NOT trust it as evidence of intent)
- Prior Ralph loops damaged it: camera + all three modes misbehave, edits don't
  save/build, the §8 path does nothing, and a per-frame Three.js shader/program
  exception on the live deploy may be masking what is actually in the scene.
- Logan has *previously* seen node artifacts render in navigable 3D space (not at coded
  positions, not running per-node code); currently even that is not reliably visible.
- Therefore the current rendered state is **not** evidence of intent. This document is.
