# Golden eval set — `golden-v1`

The frozen, certified yardstick the self-learning program measures candidate
models and builds against. Launch-day posture (proposal §4 **P0**): *record, do
not train* — but seed the golden set from certified builds now, so "better" is
always measured against a known-good bar rather than a vibe.

## What a case is

Each `cases/<id>.json` is a self-contained eval case:

- **`input`** — the spec/instruction a model (or the build pipeline) is given.
- **`expected.criteria[]`** — the atomic, checkable pass conditions (renders as
  mesh, materialSpec present, priceDelta matches, passes the completeness gate,
  produces the expected asset kind, ships to ≥2 targets, …).
- **`provenance`** — the certified source the case was harvested from, WHICH
  judged wave certified it, and when it was harvested. Provenance is airtight
  because the harvester reads the case data straight from the certified source.

## Families (this seed: 16 cases)

| Family | What it measures | Source |
| --- | --- | --- |
| `node-gen` | spec → node output (subtype, renderMode, material, price, completeness) | ORRERY atelier variants (`atelier/config.ts`) + certified mock nodes (`home-hub.legacy.json`) |
| `generative-3d` | capability invocation → asset kind + metering; clean failure | W10 committed demo outputs (`.data/generative-jobs.json`, DL13) |
| `ship-gate` | build → verified-shippable, multi-target deploy, managed care | W5B ship gate (`shell-w5b/frames-summary.json`, 11/11) |

## Regenerating

The set is REGENERABLE (freshness discipline, proposal §6) — re-run the
harvester whenever the certified fixtures change:

```
node scripts/flight-recorder-golden-seed.mjs
```

It rewrites `cases/*.json` + `manifest.json` from the current certified sources.
Bump to `golden-v2/` (a new directory) for a breaking change to the case schema
or a deliberate re-baselining against a new target stack — never edit a frozen
set in place.

## How it plugs into the flywheel

The four-set eval contract (proposal §5, W-EV) evaluates a candidate against:
(1) this golden set, (2) a held-out slice from a DIFFERENT time window, (3) live
shadow-mode traffic, (4) a canary ramp. `golden-v1` is set (1) — the frozen
floor a candidate must clear (G1: ≥ frontier baseline on the golden set) before
it is allowed anywhere near production traffic.
