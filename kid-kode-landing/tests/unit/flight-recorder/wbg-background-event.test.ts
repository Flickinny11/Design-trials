// W-BG — background_event (11th record type) round-trips through the
// recorder: the per-generation grammar-family log (the mission's telemetry
// requirement) survives with route/palette/render-mode, prompt free text is
// PII-scrubbed at write, and consent=false quarantines (I-CONSENT).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FlightRecorderWriter } from "@/lib/flight-recorder/writer";
import {
  __setWriter,
  recordBackgroundEvent,
  FLIGHT_RECORD_TYPES,
} from "@/lib/flight-recorder";
import { MemorySink } from "./mem-sink";

describe("W-BG background_event — 11th record type", () => {
  let training: MemorySink;
  let quarantine: MemorySink;
  let writer: FlightRecorderWriter;
  beforeEach(() => {
    training = new MemorySink("training");
    quarantine = new MemorySink("q");
    writer = new FlightRecorderWriter({
      manualFlush: true,
      trainingSinks: [training],
      quarantineSinks: [quarantine],
    });
    __setWriter(writer);
  });
  afterEach(() => {
    __setWriter(null);
  });

  it("is registered in FLIGHT_RECORD_TYPES", () => {
    expect(FLIGHT_RECORD_TYPES).toContain("background_event");
  });

  it("generation event: family + cluster + route + palette + mode survive; prompt scrubbed", async () => {
    recordBackgroundEvent({
      touchpoint: "background",
      actor: {
        tenantId: "tenant-hash",
        userRef: "user-1",
        consentOverride: true,
      },
      surface: "picker-generate",
      hub_ref: "hub-landing-9",
      // Prompts can carry personal info — must be redacted at write.
      prompt: "a warm dusk for kim@example.com with drifting embers",
      grammar_family: "particle-field-hero",
      anti_repetition_cluster: "shader-field",
      route: "R1",
      palette: "ember",
      render_mode: "3d",
      preset_ref: "bg-abc-123",
      downgraded: false,
      ok: true,
    });
    await writer.flush();

    expect(training.records).toHaveLength(1);
    const r = training.records[0] as unknown as Record<string, unknown>;
    expect(r.record_type).toBe("background_event");
    expect(r.touchpoint).toBe("background");
    expect(r.surface).toBe("picker-generate");
    expect(r.grammar_family).toBe("particle-field-hero");
    expect(r.anti_repetition_cluster).toBe("shader-field");
    expect(r.route).toBe("R1");
    expect(r.palette).toBe("ember");
    expect(r.render_mode).toBe("3d");
    expect(r.preset_ref).toBe("bg-abc-123");
    expect(String(r.prompt)).not.toContain("example.com");
    expect(String(r.prompt)).toContain("embers");
  });

  it("honest downgrade (planned photo, no key) records downgraded=true", async () => {
    recordBackgroundEvent({
      touchpoint: "background",
      actor: { tenantId: "t", consentOverride: true },
      surface: "picker-generate",
      grammar_family: "cinematic-video-hero",
      route: "R1",
      downgraded: true,
      ok: true,
      detail: "photo route planned; no provider key on host",
    });
    await writer.flush();
    expect(training.records).toHaveLength(1);
    const r = training.records[0] as unknown as Record<string, unknown>;
    expect(r.downgraded).toBe(true);
  });

  it("consent=false quarantines the background event (I-CONSENT)", async () => {
    recordBackgroundEvent({
      touchpoint: "background",
      actor: { tenantId: "t", consentOverride: false },
      surface: "picker-generate",
      prompt: "anything",
      grammar_family: "gpu-fluid-overlay",
      route: "R1",
    });
    await writer.flush();
    expect(training.records).toHaveLength(0);
    expect(quarantine.records).toHaveLength(1);
    expect(
      (quarantine.records[0] as unknown as Record<string, unknown>).record_type,
    ).toBe("background_event");
  });
});
