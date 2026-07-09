// W-BG — PROMPT-TO-BACKGROUND route.
//
// POST { op:'generate', prompt, hub } →
//   1. BRIEF — derive palette/motion/photo-intent from the prompt + the hub's
//      LIVE context (element captions/colors, planet identity, render mode).
//   2. FAMILY — read design-grammar/families/*.json from disk AS DATA (src
//      never imports the corpus module — catalog-types.ts law) and choose a
//      background-capable family with anti-repetition (per-tenant usage
//      rotation + cluster diversity vs the previous generation).
//   3. ROUTE — the REAL W-PHOTO planner decides: procedural backgrounds are
//      camera-RESPONSIVE stylized surfaces → R1; photo asks are photoreal →
//      R2 (flat hubs take the decision's own declared fallback R3: no live
//      depth parallax on a 2d composition — the plate bakes flat).
//   4. REALIZE — R1: synthesize the family's layer stack (generate-core).
//      R2/R3: spawn the committed .assetgen clients (FLUX-2-pro plate,
//      depth-anything-v2 for R2) + the deterministic grade script; bake to
//      public/three-d-bg/generated/<id>/ (DL13; public urls only, INV-R13).
//      No provider key → HONEST downgrade to R1 with a notice (DEV-4).
//   5. PERSIST + LOG — save to the tenant library (tenant-store) and record
//      the grammar family per generation to the flight recorder (11th record
//      type `background_event`, consent + scrub server-side, fail-open).
//
// GET → the caller's saved library, newest first.

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { auth, ensureAuthSchema } from "@/server/auth/auth";
import {
  listBackgroundPresets,
  addBackgroundPreset,
} from "@/server/tenancy/tenant-store";
import type { SavedBackgroundItemRecord } from "../../../../../packages/shared-interfaces/src/prism-backgrounds";
import { deriveInputsFromIntent, planRoute } from "@/lib/render-routes";
import {
  deriveBackgroundBrief,
  chooseBackgroundFamily,
  synthesizeR1Stack,
  synthesizePlateAccents,
  nameForGeneration,
  type HubGenerateContext,
  type BackgroundFamilyLite,
  type BackgroundBrief,
} from "@/lib/editor/backgrounds/generate-core";
import type { PrismHubBackgroundLayer } from "@/lib/prism-graph/types";
import { recordBackgroundEvent } from "@/lib/flight-recorder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSETGEN = path.resolve(process.cwd(), "..", ".assetgen");
const GEN_DIR = path.join(process.cwd(), "public", "three-d-bg", "generated");
const GRADE_SCRIPT = path.join(
  process.cwd(),
  "scripts",
  "three-d-backgrounds",
  "grade-plate.mjs",
);
const SPAWN_TIMEOUT_MS = 300_000;
const NEG = "no text, no letters, no labels, no watermark, no logo, no people";

async function hasFile(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out`));
    }, SPAWN_TIMEOUT_MS);
    child.stderr.on("data", (d) => {
      err += String(d);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(0, 300)}`));
    });
  });
}

/** Read the corpus family docs from disk as DATA (never a module import). */
async function readFamilyLites(): Promise<BackgroundFamilyLite[]> {
  const dir = path.join(process.cwd(), "design-grammar", "families");
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    const lites: BackgroundFamilyLite[] = [];
    for (const f of files) {
      try {
        const doc = JSON.parse(
          await fs.readFile(path.join(dir, f), "utf8"),
        ) as {
          id?: string;
          antiRepetition?: { clusterId?: string };
          capabilities?: { renderModes?: ("2d" | "3d")[] };
        };
        if (!doc.id) continue;
        lites.push({
          id: doc.id,
          clusterId: doc.antiRepetition?.clusterId ?? doc.id,
          // Corpus honesty law: absent renderModes counts as ['3d'].
          renderModes: doc.capabilities?.renderModes ?? ["3d"],
        });
      } catch {
        /* skip an unreadable doc — fail soft like the corpus loader */
      }
    }
    return lites;
  } catch {
    return [];
  }
}

async function resolveTenant(req: Request): Promise<string | null> {
  try {
    await ensureAuthSchema();
    const session = await auth.api.getSession({ headers: req.headers });
    if (session?.user?.id) return session.user.id;
  } catch {
    /* fall through to the dev fallback */
  }
  // The root `/` editor is a dev lab surface without a session; keep the
  // library usable there without weakening prod tenancy (I11).
  return process.env.NODE_ENV !== "production" ? "local-editor" : null;
}

function makeItemId(): string {
  return `bg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

interface GenerateBody {
  op?: string;
  prompt?: string;
  hub?: Partial<HubGenerateContext> & { hubId?: string };
}

export async function GET(req: Request): Promise<Response> {
  try {
    const tenant = await resolveTenant(req);
    if (!tenant) return Response.json({ ok: true, items: [] });
    const items = await listBackgroundPresets(tenant);
    return Response.json({ ok: true, items: [...items].reverse() });
  } catch {
    return Response.json({ ok: true, items: [] });
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return Response.json(
      { ok: false, error: "Invalid request body." },
      { status: 400 },
    );
  }
  if (body.op !== "generate") {
    return Response.json({ ok: false, error: "Unknown op." }, { status: 400 });
  }
  const prompt =
    typeof body.prompt === "string" ? body.prompt.trim().slice(0, 2000) : "";
  if (!prompt) {
    return Response.json(
      { ok: false, error: "A prompt is required." },
      { status: 400 },
    );
  }
  const hub: HubGenerateContext = {
    hubId: typeof body.hub?.hubId === "string" ? body.hub.hubId : "unknown-hub",
    title: body.hub?.title ?? null,
    renderMode: body.hub?.renderMode === "2d" ? "2d" : "3d",
    identity: body.hub?.identity ?? null,
    activePalette: body.hub?.activePalette ?? null,
    nodes: Array.isArray(body.hub?.nodes) ? body.hub.nodes.slice(0, 48) : [],
  };

  const tenant = await resolveTenant(req);

  try {
    // 1. Brief from prompt + live hub context.
    const brief = deriveBackgroundBrief(prompt, hub);

    // 2. Anti-repetition inputs from the caller's library history.
    const history = tenant ? await listBackgroundPresets(tenant) : [];
    const usageCounts: Record<string, number> = {};
    for (const it of history) {
      usageCounts[it.grammarFamily] = (usageCounts[it.grammarFamily] ?? 0) + 1;
    }
    const lastClusterId =
      history.length > 0
        ? (history[history.length - 1].clusterId ?? null)
        : null;

    // 3. Route decision (the REAL W-PHOTO planner). Backgrounds are live
    //    camera-responsive surfaces; photo asks raise the realism bar.
    const inputs = deriveInputsFromIntent({
      text: prompt,
      interaction: "none",
      realism: brief.wantsPhoto ? "photoreal" : "stylized",
      byteBudget: "moderate",
      motion: brief.wantsPhoto ? "ambient" : "responsive",
    });
    const decision = planRoute(inputs);
    let route: "R1" | "R2" | "R3" =
      decision.route === "R4"
        ? ((decision.fallback ?? "R2") as "R1" | "R2" | "R3")
        : (decision.route as "R1" | "R2" | "R3");
    // A flat hub has no live depth parallax to spend R2 on — take the
    // decision's own declared fallback (baked flat plate).
    if (route === "R2" && brief.renderMode === "2d") {
      route = (decision.fallback ?? "R3") as "R1" | "R3";
    }

    // 4. Family choice. Photo routes ARE the photo-parallax family; R1
    //    rotates through the procedural families (anti-repetition).
    const families = await readFamilyLites();
    let familyId: string;
    let clusterId: string;
    if (route === "R2") {
      familyId = "layered-photo-parallax-hero";
      clusterId =
        families.find((f) => f.id === familyId)?.clusterId ??
        "photo-composite-hero";
    } else if (route === "R3") {
      familyId = "cinematic-video-hero";
      clusterId =
        families.find((f) => f.id === familyId)?.clusterId ?? "video-hero";
    } else {
      const choice = chooseBackgroundFamily(
        families,
        brief,
        prompt,
        usageCounts,
        lastClusterId,
      );
      if (!choice) {
        return Response.json({
          ok: false,
          error: "No background family available.",
        });
      }
      familyId = choice.familyId;
      clusterId = choice.clusterId;
    }

    // 5. Realize.
    const itemId = makeItemId();
    let layers: PrismHubBackgroundLayer[];
    let downgraded = false;
    let notice: string | undefined;

    if (route === "R2" || route === "R3") {
      const pipelineReady =
        (await hasFile(path.join(ASSETGEN, "gen-flux.py"))) &&
        (await hasFile(path.join(ASSETGEN, "replicate.key")));
      if (!pipelineReady) {
        // HONEST downgrade (DEV-4): no fake photo, no placeholder plate.
        downgraded = true;
        notice =
          "Photo route planned, but no generation key is present on this host — realized procedurally (R1) instead.";
        route = "R1";
        const choice = chooseBackgroundFamily(
          families,
          brief,
          prompt,
          usageCounts,
          lastClusterId,
        );
        familyId = choice?.familyId ?? "cinematic-video-hero";
        clusterId = choice?.clusterId ?? "video-hero";
        layers = synthesizeR1Stack(familyId, brief, prompt, itemId);
      } else {
        layers = await realizePhotoRoute(route, prompt, brief, itemId);
      }
    } else {
      layers = synthesizeR1Stack(familyId, brief, prompt, itemId);
    }

    const item: SavedBackgroundItemRecord = {
      id: itemId,
      name: nameForGeneration(brief, familyId),
      prompt,
      route,
      grammarFamily: familyId,
      clusterId,
      palette: brief.palette,
      renderMode: brief.renderMode,
      createdAt: new Date().toISOString(),
      layers: layers as SavedBackgroundItemRecord["layers"],
      ...(downgraded ? { downgraded, notice } : {}),
    };

    let saved = true;
    if (tenant) {
      try {
        await addBackgroundPreset(tenant, item);
      } catch {
        saved = false;
      }
    } else {
      saved = false;
    }
    if (!saved && !notice) {
      notice = "Generated (not saved to a library — sign in to keep it).";
    }

    // 6. The mission's per-generation family log (fail-open, server-side
    //    consent + scrub inside the recorder).
    recordBackgroundEvent({
      touchpoint: "background",
      actor: { tenantId: tenant ?? undefined, userRef: tenant ?? undefined },
      surface: "picker-generate",
      hub_ref: hub.hubId,
      prompt,
      grammar_family: familyId,
      anti_repetition_cluster: clusterId,
      route,
      palette: brief.palette,
      render_mode: brief.renderMode,
      preset_ref: itemId,
      downgraded,
      ok: true,
    });

    return Response.json({
      ok: true,
      item: { ...item, ...(notice ? { notice } : {}) },
    });
  } catch (err) {
    recordBackgroundEvent({
      touchpoint: "background",
      actor: { tenantId: tenant ?? undefined },
      surface: "picker-generate",
      hub_ref: hub.hubId,
      prompt,
      ok: false,
      detail:
        err instanceof Error ? err.message.slice(0, 200) : "unknown error",
    });
    return Response.json({
      ok: false,
      error:
        err instanceof Error
          ? `Generation failed: ${err.message.slice(0, 200)}`
          : "Generation failed.",
    });
  }
}

/** R2/R3: FLUX plate (+ depth for R2) via the committed .assetgen clients,
 *  graded + baked under public/three-d-bg/generated/<id>/ (public urls only). */
async function realizePhotoRoute(
  route: "R2" | "R3",
  prompt: string,
  brief: BackgroundBrief,
  itemId: string,
): Promise<PrismHubBackgroundLayer[]> {
  const scratch = path.join(ASSETGEN, "out", "wbg-gen", itemId);
  const outDir = path.join(GEN_DIR, itemId);
  await fs.mkdir(scratch, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  const rawPlate = path.join(scratch, "plate.png");
  const rawDepth = path.join(scratch, "depth.png");
  const outPlate = path.join(outDir, "plate.webp");
  const outDepth = path.join(outDir, "depth.webp");

  const platePrompt = `${prompt}, cinematic graded backdrop, empty middle ground, no centered focal subject, atmospheric, fine film grain, ${NEG}`;
  await run("python3", [
    path.join(ASSETGEN, "gen-flux.py"),
    platePrompt,
    rawPlate,
    "16:9",
    "2 MP",
    "png",
    String(Math.floor(Math.random() * 100000)),
  ]);
  if (route === "R2") {
    await run("python3", [
      path.join(ASSETGEN, "replicate-op.py"),
      "chenxwh/depth-anything-v2",
      rawDepth,
      JSON.stringify({ image: `@${rawPlate}` }),
      "grey_depth",
    ]);
    await run("node", [GRADE_SCRIPT, rawPlate, outPlate, rawDepth, outDepth]);
  } else {
    await run("node", [GRADE_SCRIPT, rawPlate, outPlate]);
  }

  const plateUrl = `/three-d-bg/generated/${itemId}/plate.webp`;
  const depthUrl = `/three-d-bg/generated/${itemId}/depth.webp`;
  const plateLayer: PrismHubBackgroundLayer = {
    id: `${itemId}-plate`,
    attachment: "world",
    kind: route === "R2" ? "parallax-plane" : "image",
    sourceUrl: plateUrl,
    ...(route === "R2"
      ? { depthMapUrl: depthUrl, renderMode: "parallax-plane" as const }
      : {}),
    z: -46,
    opacity: 1,
    parallaxDepth: 0.8,
    params: {
      palette: brief.palette,
      density: 0.35,
      drift: 0.3,
      depthSpread: brief.renderMode === "2d" ? 0.4 : 0.7,
      intensity: 0.5,
    },
  };
  return [plateLayer, ...synthesizePlateAccents(brief, itemId)];
}
