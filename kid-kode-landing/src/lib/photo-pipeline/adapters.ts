// PHOTO-PIPELINE — media-gen provider adapters (W-PHOTO D6/D7).
//
// The provider-adapter law: every hosted capability is reached through a typed
// adapter, never a hardcoded vendor call. The composite pipeline runs its hosted
// ops (cutout / depth / relight) through Replicate (we hold a key, DEV-6); the
// `.assetgen/replicate-op.py` orchestrator is the live executor. This module is
// the TYPED surface Conductor / prompt-to-node consult to know what a provider
// can do and whether it is live.
//
// fal is TYPED but STUBBED (DEV-5): `.assetgen/fal.key` was ABSENT at run start
// and re-checked (still absent). The fal adapter therefore reports `live: false`
// and rejects submits with an honest "key absent" error — it is the future host
// for the gen-VIDEO / instruction-edit path the two `gap` families (D7) need.
//
// This file is pure types + capability declarations (no network, no key access —
// keys stay server-side in `.assetgen`, INV-19). It never enters the client
// hot path; it is the honest capability catalogue.

export type MediaOp =
  | "cutout"
  | "depth"
  | "relight"
  | "generate-image"
  | "generate-video"
  | "edit-image";

export interface AdapterCapability {
  op: MediaOp;
  /** Model slug on the provider (when live). */
  model: string;
  /** Verified live on 2026-07-06 (WebSearch), or a documented future target. */
  status: "live" | "stub";
  note?: string;
}

export interface MediaGenAdapter {
  id: "replicate" | "fal" | "tripo";
  /** Whether this provider has a key present and is callable this run. */
  live: boolean;
  capabilities: AdapterCapability[];
  /**
   * Describe how to invoke an op (the executor is the server-side/.assetgen
   * orchestrator, never the client). Throws for a stubbed provider so no caller
   * silently believes a capability ran.
   */
  invoke(op: MediaOp): { executor: string; args: string } | never;
}

/** Replicate — the live provider for the composite pipeline (DEV-6). */
export const replicateAdapter: MediaGenAdapter = {
  id: "replicate",
  live: true,
  capabilities: [
    {
      op: "cutout",
      model: "bria/remove-background",
      status: "live",
      note: "RMBG-2.0, 256-level alpha",
    },
    { op: "depth", model: "chenxwh/depth-anything-v2", status: "live" },
    {
      op: "relight",
      model: "zsxkib/ic-light",
      status: "live",
      note: "IC-Light, 5 directions",
    },
    {
      op: "generate-image",
      model: "black-forest-labs/flux-2-pro",
      status: "live",
    },
  ],
  invoke(op) {
    const cap = this.capabilities.find((c) => c.op === op);
    if (!cap) throw new Error(`replicate: no capability for op '${op}'`);
    return {
      executor:
        op === "generate-image"
          ? ".assetgen/gen-flux.py"
          : ".assetgen/replicate-op.py",
      args: `<model=${cap.model}> <out> <input-json>`,
    };
  },
};

/**
 * fal — TYPED but STUBBED (DEV-5). `.assetgen/fal.key` absent at run start,
 * re-checked, still absent. This is the documented future host for the gen-video
 * / instruction-edit ops the two `gap` families (scroll-video-scrub,
 * cinematic-video-hero) need. When the founder drops `.assetgen/fal.key`, flip
 * `live` and wire the executor — no caller contract changes.
 */
export const falAdapter: MediaGenAdapter = {
  id: "fal",
  live: false, // .assetgen/fal.key absent (2026-07-06, checked twice)
  capabilities: [
    {
      op: "generate-video",
      model: "fal-ai/<gen-video>",
      status: "stub",
      note: "D7 source: muted seamless-loop hero footage",
    },
    {
      op: "edit-image",
      model: "fal-ai/<flux-edit | nano-banana>",
      status: "stub",
      note: "instruction-based plate remix",
    },
  ],
  invoke(op): never {
    throw new Error(
      `fal adapter is stubbed (live:false — .assetgen/fal.key absent); cannot invoke '${op}'`,
    );
  },
};

export const MEDIA_ADAPTERS: MediaGenAdapter[] = [replicateAdapter, falAdapter];

/** The live provider for an op, or null when only a stubbed provider offers it. */
export function liveProviderFor(op: MediaOp): MediaGenAdapter | null {
  return (
    MEDIA_ADAPTERS.find(
      (a) => a.live && a.capabilities.some((c) => c.op === op),
    ) ?? null
  );
}
