# PRISM SHELL ENHANCEMENTS — 2026-07-04 (research-backed, founder-directed)

> Founder direction 2026-07-04: fold the competitive/SR analysis into the
> shippable-build plan. Research fresh as of this date. Each item maps to a
> wave; wave prompts cite these by ID. Runtime law: everything users build
> runs in the Prism runtime — no deviation.

## A. Competitive read (July 2026)
Table stakes across Lovable/Bolt/v0/Replit/Base44: prompt→full-stack
(React+Supabase auth/DB), live preview while generating, GitHub sync/history,
visual click-to-edit, custom domains, credits pricing, templates. Lovable
differentiators: concrete follow-up questions before building, Agent Mode,
multiplayer collab, native payments. Replit Agent 3: self-checks in a real
browser, background tasks. Documented user pain everywhere: iteration credit
friction, the "technical cliff" past prototypes, unpredictable scaling,
generic template look. New entrants noted: Base44, Rork, CatDoes (native
mobile), Dyad (local BYOK). Prism's structural wins (already spec'd): the
verify-before-shippable loop, native 3D premium runtime UIs, node-graph
build speed, visual Direction-Board intake, integrate-anything (agent-
authored Nango connectors).

## B. Enhancements (E-IDs; binding on the waves that cite them)
- **E1 Version timeline (W4/W5).** Named checkpoints per build/edit as .prism
  graph snapshots; one-click restore; visual timeline in builder. Undo at
  project scale — answers Lovable's GitHub-history expectation, runtime-native.
- **E2 Templates + Remix (W4/W6/W8).** Starter gallery of .prism template
  graphs; "Remix" forks into user's account; gallery on landing + dashboard.
- **E3 Screenshot/brand-seeded intake (W2).** Paste screenshot/logo/URL at
  Phase 0 → seeds Brand Profile + Direction Board ranking (uses existing
  brand-assets/material-gen pipelines). Matches v0/Bolt screenshot-to-code
  strength, elevated to 3D direction.
- **E4 Verification made visible (W1/W5).** The Verify phase streams its
  evidence (frames, checks) into chat as collapsible steps — our
  differentiator, surfaced. "Verified shippable" badge on deploys.
- **E5 Env/secrets UI for user apps (W3).** Capability references only;
  server-side vault; per-app scope review. No raw keys client-side, ever.
- **E6 Usage meter + plan tiers (W4).** Credits/usage UI, tier gates
  (Free/Pro/Enterprise stubs); billing provider integration deferred to
  testing phase (founder supplies keys) — schema now, Stripe later.
- **E7 Export/handoff (W5/S9).** Deployable runtime bundle export (.prism +
  assets + hosting manifest). Honest positioning: ownership of the running
  app, not React source — because the runtime IS the product.
- **E8 Scroll-scrub driver (W8→canvas).** Bind any timeline/animation to
  scroll progress + section-aware inview triggers (generalize M2's inview
  idiom). SR's signature capability, native in our runtime.
- **E9 Cursor-reactive driver (W8→canvas).** Pointer attract/repel fields for
  particles + custom-cursor layer (generalize M1's parallax rig).
- **E10 Transition preset library (W8).** Curate hub/scene transition presets
  (veil, dissolve, WebGL wipes) as one-click choices in canvas + intake tone.
- **E11 SR benchmark evidence (W8).** Recreate 3 flagship SR-class templates
  as .prism graphs (hero+scroll journey, cursor-reactive gallery, particle
  showpiece); side-by-side frames vs SR originals; each becomes an E2
  template. Goal on record: exceed SR on capability, ease, and visuals.
- **E12 Mobile builder parity (W1).** The builder itself fully usable on
  phone (competitors weak here); DL8 measured every wave.

Sources: aimultiple.com (07-03 benchmark), catdoes/lindy/nocode.mba/zite
(landscape), lovable.dev guides, sliderrevolution.com (SR7 editor, addons,
templates, changelog). Retrieved 2026-07-04.

---
## E13–E20 — SHIP ANYWHERE + 3D NAV (founder-directed 2026-07-04 afternoon)

Founder verbatim anchors: "ship directly from our platform to vercel and to
other hosts... buy and search for custom url's... without ever needing to
leave our platform all via one-click... our ai needs to be capable of seeing
which host they selected and integrating that host's settings... then verify
that it shipped... 'ship and make profitable'... recommended hosts (based on
what they've built) along with current pricing... frontend AND the back...
runpod or modal or vast or virtually anywhere... custom open source models
and workflows... our node system is very powerful for more than just
frontend."

- **E13 3D slide-out nav (W4).** Global shell nav as a premium 3D object
  (premium.ts, DL-compliant): hover-reveal at the far-LEFT screen edge on
  desktop; tap upper-left on mobile. Contents: navigation, integrations,
  settings, ship. Weighted animation (DL6), keyboard-operable, focus-trapped.
  Present across shell surfaces including the builder.
- **E14 Preview URLs (W5).** Every build gets a shareable preview deployment
  URL (Lovable-class) distinct from production ship; optional customization.
- **E15 Host adapter layer (W5B).** Typed DeployTarget adapter interface;
  frontend seed: Vercel, Netlify, Cloudflare; backend/GPU seed: Modal,
  RunPod, Vast — extensible registry (2026 field also incl. Koyeb,
  Cerebrium, Baseten/Truss, Fal, Replicate, Northflank, DO, CF Workers AI).
  The Conductor reads the selected host's requirements and generates that
  host's config; deploy → then VERIFY the live deployment on that host
  (§11.2 against the shipped URL/endpoint). One-click per host; all
  env-gated with dry-run modes.
- **E16 Domains in-platform (W5B).** Entri Sell as the universal in-UI
  domain search+purchase+auto-DNS spine (commission revenue; Connect covers
  35+ DNS providers; Monitor webhooks feed shipped-state checks). Native
  registrar adapters where superior: Vercel Domains Registrar API (when
  shipping to Vercel), Cloudflare Registrar API (at-cost). Config-selected.
- **E17 "Ship & Make Profitable" (W5B).** One button → Conductor
  completeness scan of the app graph (auth, db, storage, payments,
  subscriptions, email, analytics) → missing capabilities offered as
  intuitive one-click cards IN the streaming chat (W3 catalog + Conductor
  adds the nodes) → then ship flow. Ship also invocable by natural language.
- **E18 Host recommendations + live pricing (W5B).** On ship: recommend
  frontend AND (when the graph has backend/GPU nodes) backend hosts based on
  what was built, with current pricing fetched live; user picks, one-click.
- **E19 Backend workloads as nodes (W5B).** Backend/GPU nodes (custom
  open-source models, workflows) deploy through E15 adapters (e.g., a model
  endpoint on Modal/RunPod/Vast) with generated config, then are tested +
  validated by the verify latch. The node system serves back AND front.
- **E20 Managed care tier (W5B stub → post-testing).** Paid tier: automatic
  bug fixes, self-healing (extends the existing node-agent self-heal),
  deployment checks, optimizations on the user's shipped app. v1 = tier
  gating + scheduled-check scaffolding + pricing stub; live monitoring
  agents post-testing-keys. Users can always prompt their own fixes free.

Sources (2026-07-04): developers.entri.com (Sell/Connect/Monitor APIs) ·
vercel.com changelog (Domains Registrar API) · blog.cloudflare.com
(Registrar API beta, 04-2026) · northflank/runpod/blaxel/koyeb/inworld/
dev.to serverless-GPU comparisons (04–06/2026).
