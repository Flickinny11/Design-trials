// W-PHOTO D8 — flight-record the composite-pipeline generation/build events.
//
// The R2 pipeline runs hosted models (FLUX generate, bria cutout, depth-anything
// depth) + local deterministic passes (shadow plate, grade). Each stage's
// provenance is committed in the composite manifest; this suite REPLAYS that
// provenance into the real recorder pipeline (envelope + scrub + consent) as
// `capability_usage` records — the sanctioned metering type (never a faked new
// type) — so the generation events land in the training substrate.
//
// Live hosted stages carry verbatim OTel gen_ai.* attributes (provider
// "replicate"); local stages carry prism.* only (prism.capability.live=false).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { FlightRecorderWriter } from "@/lib/flight-recorder/writer";
import { __setWriter, recordCapabilityUsage } from "@/lib/flight-recorder";
import { MemorySink } from "./mem-sink";
import type {
  CompositeManifest,
  StageProvenance,
} from "@/lib/photo-pipeline/types";

const COMPOSITE = path.join(
  process.cwd(),
  "public",
  "prism-mock",
  "photo",
  "celestia-hero",
  "composite.json",
);

function loadManifest(): CompositeManifest {
  return JSON.parse(fs.readFileSync(COMPOSITE, "utf8")) as CompositeManifest;
}

/** Replay one provenance stage as a capability_usage record. */
function replayStage(manifestId: string, p: StageProvenance): void {
  const capabilityId = `photo.${p.stage}`;
  recordCapabilityUsage({
    touchpoint: "material-gen",
    actor: { consentOverride: true, actorIdentifiers: [] },
    capability_id: capabilityId,
    result_asset_ref: `photo/${manifestId}`,
    ok: true,
    // OTel gen_ai.* only for LIVE hosted stages (local passes have no provider).
    otel:
      p.mode === "live"
        ? {
            "gen_ai.provider.name": "replicate",
            "gen_ai.operation.name": "generate_content",
            "gen_ai.request.model": p.model ?? "unknown",
            "gen_ai.output.type": "image",
          }
        : undefined,
    prism: {
      "prism.capability.id": capabilityId,
      "prism.capability.live": p.mode === "live",
      "prism.cost.unit": "usd",
      "prism.cost.amount": p.costUsd ?? 0,
      "prism.cost.estimated": p.costEstimated ?? true,
      ...(typeof p.predictTime === "number"
        ? { "prism.latency.ms": Math.round(p.predictTime * 1000) }
        : {}),
    },
  });
}

describe("W-PHOTO composite pipeline — flight-record replay (D8)", () => {
  let training: MemorySink;
  let writer: FlightRecorderWriter;
  beforeEach(() => {
    training = new MemorySink("training");
    writer = new FlightRecorderWriter({
      manualFlush: true,
      trainingSinks: [training],
      quarantineSinks: [new MemorySink("q")],
    });
    __setWriter(writer);
  });
  afterEach(() => {
    __setWriter(null);
  });

  it("the committed manifest has honest per-stage provenance", () => {
    const m = loadManifest();
    expect(m.schemaVersion).toBe("prism-photo-v1");
    expect(m.provenance.length).toBeGreaterThan(0);
    // Every stage is one of the six pipeline stages.
    const stages = new Set(m.provenance.map((p) => p.stage));
    for (const s of stages) {
      expect([
        "generate",
        "cutout",
        "depth",
        "shadow-plate",
        "relight",
        "grade",
      ]).toContain(s);
    }
    // Hosted stages name a real provider + model (I-PROVENANCE).
    for (const p of m.provenance) {
      if (p.mode === "live") {
        expect(p.provider).toBe("replicate");
        expect(p.model).toBeTruthy();
      }
    }
  });

  it("replays every provenance stage into the recorder as capability_usage", async () => {
    const m = loadManifest();
    for (const p of m.provenance) replayStage(m.id, p);
    await writer.flush();

    const usage = training.records.filter(
      (r) => r.record_type === "capability_usage",
    );
    expect(usage.length).toBe(m.provenance.length);

    // Live/local split matches the manifest.
    const liveManifest = m.provenance.filter((p) => p.mode === "live").length;
    const liveRecords = usage.filter(
      (r) => r.prism?.["prism.capability.live"] === true,
    ).length;
    expect(liveRecords).toBe(liveManifest);
    expect(liveManifest).toBeGreaterThanOrEqual(6); // ≥6 live hosted stages this run

    // Every record is partitioned under material-gen; live ones name replicate.
    for (const r of usage) {
      expect(r.touchpoint).toBe("material-gen");
      if (r.prism?.["prism.capability.live"]) {
        expect(r.otel?.["gen_ai.provider.name"]).toBe("replicate");
      }
    }

    // Optional: dump the replayed ledger as evidence (gated so CI stays hermetic).
    if (process.env.WPHOTO_LEDGER === "1") {
      const out = path.join(
        process.cwd(),
        "notes",
        "verification",
        "shell-wphoto",
        "gates",
        "composite-flightrec-ledger.ndjson",
      );
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(
        out,
        training.records.map((r) => JSON.stringify(r)).join("\n") + "\n",
      );
    }
  });
});
