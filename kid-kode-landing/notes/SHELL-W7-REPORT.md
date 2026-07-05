# SHELL W-7 — COLLABORATION + SETTINGS — RUN REPORT

**Branch:** `codex/prism-recovery-harness-20260630` · **Status:** `PRISM-SHELL-W7: RUN COMPLETE`
**Both judges PASS · 0 MUST-FIX** (criteria-reviewer PASS 7/7 risks OK; user-advocate PLEASED/PASS).

Governed by spec §6.9 (S9), §8 (I1 amended, I11), §10 Global, §12 (W7), §14 ·
Decision E (LOCKED, enterprise-tier multiplayer) + the 2026-07-04 multi-tenant
clarification · shared-interfaces `prism-collab.ts` (W0 types) · DESIGN LAW ·
VERIFICATION-STANDARD · NEAR-HUMAN-QA. Additive throughout; evidence law.

---

## 1. What shipped

A complete, real (not stubbed) enterprise collaboration layer plus settings depth,
built entirely on top of the existing shell without touching the SSE transport or
the engine interior.

| Task | Delivered |
|---|---|
| **1 — CollabRoom** | A transport-agnostic `CollabRoom` core (presence fan-out; room-issued-seq per-property LWW; per-user undo, own ops only; per-node soft locks; idle hibernation seam) hosted by a **dependency-free RFC 6455 WebSocket server** — the single Decision-E exception to SSE-only (I1). Two headless clients prove deterministic convergence + presence + undo. |
| **2 — Org sharing (S9)** | private · view · comment · edit, granted org-wide or per-member; edit grants graph-modify + chat-with-builder; share via internal org URL. Permission matrix enforced **server-side** (`can()`/`capabilitiesFor` — the single source of truth). Org membership is the ONLY cross-user visibility — explicit + audited (I11-consistent). |
| **3 — Enterprise org dashboard** | `?panel=org` "Team": org roster with roles, seat count, member invite (by email → real member or pending invite), remove, and the collective **shared builds** view. Enterprise-only nav. |
| **4 — Settings depth** | Profile · **persisted** default build model (7.4 config-driven) · notification prefs · organization section · usage shortcut · **danger zone** (typed-name-confirmed account-data delete, W7-D3). |
| **5 — Presence UI (W1)** | Live remote cursors + editing badges + camera-mode ghosts overlaid on the preview, plus a TopBar avatar stack and the real org Share dialog — **all behind the enterprise gate**. Two headless clients + browser frames prove live cursor + LWW convergence. |

## 2. Architecture (files)

**Contracts (I4, additive):** `packages/shared-interfaces/src/prism-sharing.ts`
(roles, grants, `PRISM_PERMISSION_MATRIX` + `can`/`capabilitiesFor`, org/dashboard/
access IO) · `prism-tenancy.ts` (+account-settings shapes) · `prism-collab.ts`
(+`collabClientMessageSchema`, additive to the W0 room-event types).

**Server:** `src/server/tenancy/org-store.ts` (audited cross-tenant seam — orgs,
members, invites, grants, `resolveProjectAccess`, global `shared-index`, append-only
audit log; **portable, no `server-only`** so the standalone host imports the same
resolver) · `src/server/collab/{collab-room,ws-frame,auth-bridge,collab-host}.ts` ·
`src/server/trpc/routers/sharing.ts` (+ tenancy `me`/`settings`/`account.delete` and
the access-gated `graph.get`/`graph.save`/`project.get`).

**Client / UI:** `src/lib/shell/{collab-config,collab-store,sharing-client}.ts` +
tenancy-client additions · `src/components/shell/builder/{PresenceLayer,PresenceAvatars,
ShareDialog,TopBar,BuilderShell}.tsx` · `src/components/shell/dashboard/{OrgPanel,
SettingsPanel,DashboardShell}.tsx`.

**Launcher / probes:** `scripts/{collab-dev-server.mjs,ts-ext-loader.mjs,
verify-collab-convergence.mjs,verify-share-matrix.mjs,capture-w7-frames.mjs}` +
`verify-tenant-isolation.mjs` extended.

## 3. Deviations (recorded BEFORE code — `docs/spec-deviations-prism.md`)

- **W7-D1 — CollabRoom = portable room-core + dep-free local WS host; the Cloudflare
  Durable Object is the documented production ADAPTER SEAM.** This repo is Next.js-only
  (no wrangler/Worker/DO runtime; grep-proven) and is verified under `next dev`, so a
  real Cloudflare DO cannot run or be proven here. The room *semantics* Decision E
  mandates live in `CollabRoom` (a DO wraps it 1:1 in prod; `state.acceptWebSocket()`
  for hibernation — the `hibernate()`/`rehydrate()` seam is already shaped). Locally a
  hand-rolled RFC 6455 server hosts it (no `ws` dependency — zero supply-chain surface),
  connected by the browser's native `WebSocket`. Same adapter-seam pattern W5 used for
  DeployTargets. **SSE stays the sole engine/build transport; the collab WS is the ONLY
  new WebSocket (I1 exception).**
- **W7-D2 — Org sharing is the founder-sanctioned, explicit, AUDITED exception to I11.**
  An org-scoped store + `resolveProjectAccess` returns a role only when a shared-index
  entry exists, the viewer is a current org member, and a grant covers them; every
  change is audited. Unshared projects have no entry → strict isolation is untouched and
  the two-user probe stays green (extended to prove the new surface fails closed).
- **W7-D3 — Danger-zone delete wipes the tenant's Prism data + signs out; Better-Auth
  user-row deletion is the documented auth-admin seam** (avoids forking auth storage, I2).

No founder-blocking deviations. All three are within established precedent (adapter
seams, audited cross-tenant, honest stubs).

## 4. Verification — ALL GREEN

| Probe | Result | What it proves |
|---|---|---|
| `verify:collab` (2 real WS clients) | **15/15** | enterprise gate (org.create FORBIDDEN for non-enterprise), audited sharing, non-member NOT_FOUND, **non-member WS REFUSED at transport**, room snapshot, **presence fan-out (cursor reaches peer)**, **race → deterministic seq-winner, both converge**, per-user undo. Op log: `notes/verification/w7-collab-oplog.json`. |
| `verify:share-matrix` | **30/30** | each role (view/comment/edit) asserted server-side: viewers/commenters read but save FORBIDDEN; editor saves + persists to owner's space; grantees denied rename/delete/re-share; outsider NOT_FOUND everywhere. |
| `verify:tenancy` (extended) | **35/35** | I11 intact; the W7 org/sharing procedures fail closed for non-members (no existence leak); `.strict()` owner-smuggle rejected. |
| `npm run verify` (aggregate) | **EXIT 0** | prism 14/14 · galaxy 7/7 · global-shell 6/6 · schema 338/338 · tenancy 35/35 (repair-loop soft-warn is pre-existing/non-blocking). |
| `tsc --noEmit` | **9 = baseline, 0-new** | no new type errors in any W7 file. |
| Browser frames (`capture-w7-frames.mjs`) | **GREEN** | `presenceCursorRendered=true, ownerAvatarCount=2, nonEnterpriseAvatars=0, nonEnterpriseCursors=0`. Frames in `notes/verification/w7/`. |

**SSE untouched (grep proof):** across all W7 commits (`8b90cc10..HEAD`), the diff
intersects `conductor.ts` / `stub-agent.ts` / `conductor-client.ts` / `agent-client.ts`
/ `prism-agent.ts` / `api/trpc/[trpc]/route.ts` = **∅**. The only new `new WebSocket` is
the collab client; the only server WS is the standalone host (never imported into the
Next request path). No new EventSource/polling.

**DL sweep:** no hardcoded model strings (models via `model-config`), no icon
packs/emoji (bespoke inline-SVG cursor), no raw secrets in the collab surface (actor is
display-only), one new Zustand store (I3), Better Auth only (I2).

## 5. Judges

- **prism-criteria-reviewer — PASS, 0 MUST-FIX.** All 7 graded risks OK (I11 preserved,
  I1 one-WS-exception, Decision-E fidelity, dual-layer enterprise gate, matrix single
  source of truth, contract-first additive, no forbidden-pattern drift). 2 SHOULD-FIX,
  both "no action required" (client nav gate is cosmetic — server is authoritative;
  localhost default is the documented adapter seam).
- **user-advocate — PLEASED / PASS, 0 MUST-FIX.** Presence renders live; enterprise/free
  distinction honest with no dark patterns; settings genuinely deep; roster/oplog/avatar
  identities mutually consistent. 2 cosmetic flags (faint Share label — **fixed**, now a
  red "Org · edit" accent; localhost URL in the capture — expected).

## 6. One real bug found + fixed (evidence law working)

The first frames run surfaced an **infinite render loop** ("Maximum update depth
exceeded"): `useCollabStore((s) => s.others())` returned a fresh array every call, which
breaks `useSyncExternalStore`'s snapshot stability. Fixed by selecting the stable
`presence` reference and deriving via `useMemo` in a `useOthers()` hook. Re-captured →
GREEN. (This is exactly why the visual layer is mandatory: the server probes were all
green while the builder was silently loop-crashing.)

## 7. Founder / operator notes

- **Enterprise tier** is set by billing in prod (`planTier`, Better Auth additional
  field, `input:false`). The probes/frames set it directly in a throwaway sqlite — there
  is no product path to self-elevate.
- **Collab endpoint is config** (`NEXT_PUBLIC_PRISM_COLLAB_URL`): unset → local dev host
  `ws://localhost:4790`; set to the Cloudflare DO `wss://<host>/collab/<projectId>` in
  prod; `off` disables the channel entirely (pure SSE baseline). Start the local host
  with `node scripts/collab-dev-server.mjs`.
- **Production DO swap** = wrap `CollabRoom` in a Durable Object whose `webSocketMessage`
  forwards to `applyPresence`/`commitOp`/`acquireLock`/`undo` and whose
  `state.acceptWebSocket()` provides hibernation; the auth-bridge's cookie→session read
  becomes an edge Better-Auth validation. No core logic changes.
- **Gotcha (Node ESM):** the standalone host runs the extensionless-import TS graph via a
  tiny resolve hook (`scripts/ts-ext-loader.mjs`) since Node strips TS types but still
  needs explicit extensions — no `tsx`/build step, no dependency.

## 8. Commits

`28981cc4` deviations → contracts → org-store → CollabRoom+host → sharing router →
verification probes (collab/matrix/tenancy) → collab client+presence UI → settings+org
dashboard → render-loop fix+frames → advocate polish. Each step committed with evidence.

---
`PRISM-SHELL-W7: RUN COMPLETE`
