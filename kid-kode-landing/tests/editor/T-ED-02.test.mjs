// Acceptance test for T-ED-02 — Click-to-select: pointerdown on each
// node container emits a `node-selected` event (§7).
//
// T-ED-01 landed `notes/editor-bridge.md` with a Gaps section that
// named `'node-selected'` as the event T-ED-02 owns (Inspector/T-ED-03
// and Minimap/T-ED-08 both subscribe). This test locks the contract
// that T-ED-02 must satisfy so the editor-bridge doc and boot.ts stay
// in sync — if one side drifts, this fails.
//
// Acceptance contract (all required):
//
//   (A) In `src/lib/prism/player/boot.ts`, after each createNode() call
//       (the initial materialization loop AND the rebuildNode() helper
//       that fires on breakpoint reflow / SHR repair), a
//       `'pointerdown'` listener is attached to `instance.container`
//       that emits `'node-selected'` on the shared event bus with a
//       `{ nodeId }` payload.
//
//   (B) The nodeId is sourced generically from the current iteration
//       variable (`node.nodeId`) — NOT a hardcoded mock-app nodeId
//       literal. The editor-genericity rule from CLAUDE.md extends to
//       boot.ts's wiring: a hardcoded nodeId here would defeat the
//       whole point of the editor subscribing.
//
//   (C) The container has `eventMode = 'static'` set (or already is,
//       from the node module itself) so PIXI actually routes
//       pointerdown to our listener. If this is skipped, the listener
//       silently never fires and we'd ship a no-op that still passes
//       a naive grep.
//
//   (D) The event payload key is `nodeId` (not `source`, not `id`) —
//       that's the shape editor-bridge.md pins in its Known events
//       table, and what Inspector/Minimap will destructure.
//
//   (E) `notes/editor-bridge.md` Known events table now includes
//       `'node-selected'` with the `{ nodeId }` payload. The Gaps
//       section must no longer list `node-selected` as "not yet
//       wired" — it's wired now. (The Gaps section may still mention
//       it as the historical origin, but the primary reference must
//       move to Known events.)
//
//   (F) No new hardcoded mock-app nodeIds appear in boot.ts. The
//       existing `buildHomeHubRoutes()` table already exists as a
//       permitted concentrated exception (routing table, not UI
//       logic); this test checks that new string literals introduced
//       by T-ED-02 do not add to that list. Any hardcoded nodeId the
//       test would otherwise fail on may be suppressed with
//       `// ALLOWED-HARDCODED-ID: <reason>` adjacent.
//
// Run with: node tests/editor/T-ED-02.test.mjs

import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const kidKodeRoot = resolve(here, '..', '..');
const bootPath  = resolve(kidKodeRoot, 'src/lib/prism/player/boot.ts');
const bridgePath = resolve(kidKodeRoot, 'notes/editor-bridge.md');

assert.ok(existsSync(bootPath), `boot.ts not found at ${bootPath}`);
assert.ok(existsSync(bridgePath), `editor-bridge.md not found at ${bridgePath}`);

const boot   = readFileSync(bootPath,   'utf8');
const bridge = readFileSync(bridgePath, 'utf8');

// ─── (A) pointerdown listener + node-selected emit present ───────────
// The emit call can be either:
//   events.emit('node-selected', { nodeId: <expr> })
//   ctx.events.emit('node-selected', ...)
// We require the event name and a nodeId key in the payload literal
// within a reasonable window of the emit call.
const EMIT_RE = /events\.emit\s*\(\s*['"`]node-selected['"`]\s*,\s*\{[\s\S]{0,120}?\bnodeId\b[\s\S]{0,120}?\}\s*\)/;
assert.ok(
  EMIT_RE.test(boot),
  "boot.ts: expected `events.emit('node-selected', { nodeId: ... })` — the pointerdown wiring for T-ED-02 is missing",
);

// pointerdown is what we listen for. The attachment must be on a
// container (via .on or .addListener). We check both forms.
const POINTERDOWN_RE = /\.(?:on|addListener)\s*\(\s*['"`]pointerdown['"`]\s*,/;
assert.ok(
  POINTERDOWN_RE.test(boot),
  "boot.ts: expected a `.on('pointerdown', ...)` listener attachment",
);

// (B) nodeId sourced from iteration variable, not a string literal.
// Find the emit call and check its payload references `node.nodeId`
// (the loop variable name in boot.ts:189 & rebuildNode).
const EMIT_WITH_VAR_RE = /events\.emit\s*\(\s*['"`]node-selected['"`]\s*,\s*\{\s*nodeId\s*:\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*[,}]/;
const emitMatch = boot.match(EMIT_WITH_VAR_RE);
assert.ok(
  emitMatch,
  "boot.ts: node-selected payload must read `nodeId: <variable>` — not a string literal or inline expression",
);
const nodeIdExpr = emitMatch[1];
// Accept node.nodeId, nodeId, n.nodeId — anything that looks like a
// variable reference. Reject string literals (already excluded by the
// regex above, but double-check the capture is not a quoted literal).
assert.ok(
  !/^['"`]/.test(nodeIdExpr),
  `boot.ts: node-selected payload nodeId source is a literal \`${nodeIdExpr}\` — must be an iteration variable`,
);
// Positive shape: must contain `.nodeId` OR be a bare `nodeId` identifier
// (the enclosing for-of in boot.ts destructures as `const node of ...`).
assert.ok(
  /\.nodeId$/.test(nodeIdExpr) || nodeIdExpr === 'nodeId',
  `boot.ts: node-selected payload nodeId source is \`${nodeIdExpr}\` — expected a .nodeId access from the loop variable (generic, not hardcoded)`,
);

// ─── (C) container.eventMode = 'static' is present somewhere new ─────
// boot.ts previously did not set eventMode on instance.container (the
// node modules set it themselves on their own inner containers). For
// T-ED-02 to actually receive pointerdown, the outer
// instance.container must be 'static'. Assert the literal is there.
assert.ok(
  /\beventMode\s*=\s*['"`]static['"`]/.test(boot),
  "boot.ts: `container.eventMode = 'static'` is required so the pointerdown listener actually fires (without it the listener silently never receives events)",
);

// ─── (D) payload key is exactly `nodeId` ─────────────────────────────
// Negative — `source` is the convention for OTHER events but NOT for
// node-selected. Catching the regression where someone copy-pastes
// from the 'navigate' pattern.
const BAD_PAYLOAD_RE = /events\.emit\s*\(\s*['"`]node-selected['"`]\s*,\s*\{[^}]*\bsource\s*:/;
assert.ok(
  !BAD_PAYLOAD_RE.test(boot),
  "boot.ts: node-selected payload must use `nodeId`, not `source` (editor-bridge.md Known events table pins the key)",
);

// ─── (E) editor-bridge.md Known events table now lists node-selected ─
// Look for a row in a markdown table that mentions node-selected and
// the payload shape.
const BRIDGE_KNOWN_ROW_RE = /\|[^\n|]*['"`]node-selected['"`][^\n|]*\|[\s\S]{0,200}?\{[\s\S]{0,120}?\bnodeId\b[\s\S]{0,120}?\}/;
assert.ok(
  BRIDGE_KNOWN_ROW_RE.test(bridge),
  "editor-bridge.md: Known events table must now include a row for `'node-selected'` with payload `{ nodeId: string }` — T-ED-02 promotes it from Gaps to Known events",
);

// Gaps section must no longer list node-selected as unwired. We scan
// the Gaps heading onward and assert no "not yet" / "T-ED-02 owns" /
// "not yet wired" line mentions node-selected anymore.
const GAPS_SECTION_RE = /##+\s+(?:Gaps?|Not\s+yet\s+exposed|Missing|Open\s+gaps?)[\s\S]*?(?=\n##+\s|$)/i;
const gapsMatch = bridge.match(GAPS_SECTION_RE);
if (gapsMatch) {
  const gapsBody = gapsMatch[0];
  // The word "node-selected" may still appear historically in prose,
  // but not flagged as "not yet wired" / "T-ED-02 owns" / "needed by".
  const STILL_UNWIRED_RE = /node-selected[\s\S]{0,200}?(?:not\s+yet|T-ED-02\s+(?:owns|wires)|pending|needed\s+but\s+not\s+yet)/i;
  assert.ok(
    !STILL_UNWIRED_RE.test(gapsBody),
    "editor-bridge.md: Gaps section still flags `node-selected` as unwired — T-ED-02 is wiring it; remove the unwired marker and reference the Known events row instead",
  );
}

// ─── (F) No new hardcoded mock-app nodeIds ──────────────────────────
// The anti-drift hook already enforces this on Write/Edit, but we
// double-check from the test side so a future refactor can't sneak
// through. The regex is deliberately narrow: T-ED-02 should add
// ZERO new nodeId string literals. The existing buildHomeHubRoutes()
// table is an acceptable concentrated exception — we count the
// occurrences of each known id and assert T-ED-02 didn't increase
// any. We do this by asserting the emit block (the T-ED-02 wiring)
// contains no such literal.
const BOOT_EMIT_BLOCK_RE = /events\.emit\s*\(\s*['"`]node-selected['"`][\s\S]{0,200}?\)/g;
const emitBlocks = boot.match(BOOT_EMIT_BLOCK_RE) ?? [];
assert.ok(
  emitBlocks.length >= 1,
  "boot.ts: expected at least 1 node-selected emit block",
);
const FORBIDDEN_ID_RE = /['"`](?:hero-(?:card|section)|navbar-(?:logo|link|signin|bg)|feature-(?:card|grid)|footer-(?:logo|link|social|bg|copyright)|stats-|settings-section|notifications-toggle|theme-selector|page-background|video-slot-\d)/;
for (const block of emitBlocks) {
  assert.ok(
    !FORBIDDEN_ID_RE.test(block),
    `boot.ts: node-selected emit block contains a hardcoded mock-app nodeId — must be generic (\`node.nodeId\` from the iteration variable)\n  block: ${block}`,
  );
}

console.log('[T-ED-02] PASS — pointerdown→node-selected wiring: boot.ts emit (A,B,C,D,F), editor-bridge.md Known events row (E)');
