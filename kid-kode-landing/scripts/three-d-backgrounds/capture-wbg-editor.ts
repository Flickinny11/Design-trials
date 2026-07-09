// W-BG D10 — LIVE editor evidence drive (Playwright chromium, real WebGPU).
//
// Drives the ROOT `/` editor (live 6-hub graph) through the upgraded picker:
// catalog browse, search, HOVER = LIVE PREVIEW (before/during/after frames),
// apply, the W-2D flat-hub gate, a real R1 prompt-to-background through the
// UI, a real R2 photo generation through the UI (live Replicate), and the
// anti-repetition rotation over the API. Then the /wbg-demo runtime proof
// (catalog preset + the just-generated stack in the REAL ConductorRuntime).
//
// Frames + JSON land under notes/verification/shell-wbg/. The live graph is
// restored afterwards by the caller (git checkout — EDIT-I2 autosave law).
//
// Usage: npx tsx scripts/three-d-backgrounds/capture-wbg-editor.ts [--base http://localhost:3011] [--skip-r2]

import { chromium, type Page } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3011";
const SKIP_R2 = process.argv.includes("--skip-r2");
const OUT = path.join(
  process.cwd(),
  "notes",
  "verification",
  "shell-wbg",
  "editor",
);

const HUB = "s1-arrival";

async function frame(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, name), type: "png" });
  console.log("frame", name);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  // HEADED on the real GPU (headless screenshots blank a WebGPU canvas).
  const browser = await chromium.launch({
    headless: false,
    args: ["--enable-unsafe-webgpu"],
  });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal{display:none!important}";
    document.addEventListener("DOMContentLoaded", () =>
      document.head.appendChild(style),
    );
  });
  page.setDefaultTimeout(60000);

  // ── boot the live editor ───────────────────────────────────────────────────
  await page.goto(`${BASE}/`, {
    waitUntil: "domcontentloaded",
    timeout: 180000,
  });
  await page.waitForFunction(
    () =>
      !!(window as unknown as { __PRISM_DEBUG_STORES__?: unknown })
        .__PRISM_DEBUG_STORES__,
    undefined,
    { timeout: 120000 },
  );
  await page.waitForTimeout(9000); // scene + MSDF warm
  await frame(page, "00-editor-boot.png");

  // ── open the Hub Inspector (Visual tab hosts the picker) ──────────────────
  // The editor boots into preview-app (the shipped-app view — no editing
  // chrome); drill into the hub, switch to canvas, then open the inspector.
  await page.evaluate(async (hub) => {
    const s = (window as unknown as { __PRISM_DEBUG_STORES__: any })
      .__PRISM_DEBUG_STORES__;
    s.graphEditor.getState().drillIntoHub?.(hub);
    await new Promise((r) => setTimeout(r, 1500));
    s.graphEditor.setState({ viewMode: "canvas" });
  }, HUB);
  await page.waitForTimeout(2000);
  // Dismiss the first-run walkthrough BEFORE opening the inspector (its
  // scrim intercepts all pointer events; Esc closes it — and Esc would also
  // close the inspector, hence the ordering).
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  await page.evaluate((hub) => {
    const s = (window as unknown as { __PRISM_DEBUG_STORES__: any })
      .__PRISM_DEBUG_STORES__;
    s.graphEditor.setState({
      inspectorOpen: true,
      selectedHubId: hub,
      inspectorTab: "visual",
    });
  }, HUB);
  await page.waitForSelector("text=3D BACKGROUND", { timeout: 30000 });
  await page.waitForTimeout(1500);
  await frame(page, "01-picker-open-catalog.png");

  // Scroll the panel so the category structure is visible.
  const search = page.getByLabel("Search backgrounds");
  await search.hover();
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(700);
  await frame(page, "02-picker-categories-scrolled.png");
  await page.mouse.wheel(0, -900);
  await page.waitForTimeout(500);

  // ── search ─────────────────────────────────────────────────────────────────
  await search.fill("silk");
  await page.waitForTimeout(800);
  await frame(page, "03-picker-search-silk.png");
  await search.fill("aurora");
  await page.waitForTimeout(600);
  await frame(page, "04-picker-search-aurora.png");

  // ── hover = live preview (before / during / after) ────────────────────────
  await frame(page, "05a-hover-before.png");
  const auroraCard = page.getByRole("button", { name: /North Aurora/ }).first();
  await auroraCard.hover();
  await page.waitForTimeout(900); // hover delay + shader mount
  await frame(page, "05b-hover-live-preview.png");
  const hoverState = await page.evaluate(() => {
    const s = (window as unknown as { __PRISM_DEBUG_STORES__: any })
      .__PRISM_DEBUG_STORES__;
    const src = s.graphSource.getState();
    const hub = src.hubs.find(
      (h: { hubId: string }) => h.hubId === "s1-arrival",
    );
    return {
      persistedLayerIds: (hub.background ?? []).map(
        (l: { id: string }) => l.id,
      ),
    };
  });
  await page.mouse.move(760, 500); // off the panel → preview clears
  await page.waitForTimeout(700);
  await frame(page, "05c-hover-cleared.png");

  // ── apply a catalog entry ──────────────────────────────────────────────────
  await search.fill("ember");
  await page.waitForTimeout(500);
  await page
    .getByRole("button", { name: /Emberfall/ })
    .first()
    .click();
  await page.waitForTimeout(1800);
  await frame(page, "06-applied-emberfall.png");
  const appliedState = await page.evaluate(() => {
    const s = (window as unknown as { __PRISM_DEBUG_STORES__: any })
      .__PRISM_DEBUG_STORES__;
    const hub = s.graphSource
      .getState()
      .hubs.find((h: { hubId: string }) => h.hubId === "s1-arrival");
    return (hub.background ?? []).map((l: { id: string; kind?: string }) => ({
      id: l.id,
      kind: l.kind,
    }));
  });

  // ── W-2D gate: flat hub sees only affirmative-2d entries ──────────────────
  await search.fill("");
  await page.evaluate(() => {
    const s = (window as unknown as { __PRISM_DEBUG_STORES__: any })
      .__PRISM_DEBUG_STORES__;
    s.graphSource.getState().updateHub("s1-arrival", { renderMode: "2d" });
  });
  await page.waitForTimeout(1200);
  await frame(page, "07-flat-hub-2d-gate.png");
  await page.evaluate(() => {
    const s = (window as unknown as { __PRISM_DEBUG_STORES__: any })
      .__PRISM_DEBUG_STORES__;
    s.graphSource.getState().updateHub("s1-arrival", { renderMode: "3d" });
  });
  await page.waitForTimeout(600);

  // ── prompt-to-background R1 through the REAL UI ────────────────────────────
  const promptBox = page.getByLabel("Describe the background to generate");
  await promptBox.scrollIntoViewIfNeeded();
  await promptBox.fill("quiet green fireflies over a calm meadow at night");
  await frame(page, "08a-generate-prompt.png");
  await page.getByRole("button", { name: /Generate background/ }).click();
  await page.waitForFunction(
    () => !document.body.textContent?.includes("reading hub + planning route"),
    undefined,
    { timeout: 120000 },
  );
  await page.waitForTimeout(2500);
  await frame(page, "08b-generate-r1-applied.png");

  // ── prompt-to-background R2 (live photo route) through the REAL UI ────────
  if (!SKIP_R2) {
    await promptBox.scrollIntoViewIfNeeded();
    await promptBox.fill(
      "a photoreal misty pine forest at dawn, calm and quiet",
    );
    await page.getByRole("button", { name: /Generate background/ }).click();
    await page.waitForFunction(
      () =>
        !document.body.textContent?.includes("reading hub + planning route"),
      undefined,
      { timeout: 360000 },
    );
    await page.waitForTimeout(4500); // plate texture load
    await frame(page, "09-generate-r2-photo-applied.png");
    await promptBox.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await frame(page, "10-my-library.png");
  }

  // ── anti-repetition rotation over the API (same neutral prompt 3×) ────────
  const rotation = await page.evaluate(async () => {
    const out: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await fetch("/api/prism/background-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "generate",
          prompt: "a tasteful ambient backdrop",
          hub: { hubId: "evidence-rotation", renderMode: "3d", nodes: [] },
        }),
      });
      const d = await res.json();
      out.push({
        ok: d.ok,
        family: d.item?.grammarFamily,
        cluster: d.item?.clusterId,
        route: d.item?.route,
        palette: d.item?.palette,
        name: d.item?.name,
      });
    }
    return out;
  });
  console.log("rotation:", JSON.stringify(rotation));

  const library = await page.evaluate(async () => {
    const res = await fetch("/api/prism/background-generate");
    return res.json();
  });

  await writeFile(
    path.join(OUT, "generation-evidence.json"),
    JSON.stringify({ hoverState, appliedState, rotation, library }, null, 2),
  );

  // ── runtime proof: the REAL ConductorRuntime renders backgrounds ──────────
  await page.goto(`${BASE}/wbg-demo?preset=polar-ridge`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      !!(window as unknown as { __PRISM_RUNTIME_BG__?: unknown })
        .__PRISM_RUNTIME_BG__,
    undefined,
    { timeout: 120000 },
  );
  await page.waitForTimeout(6000);
  await frame(page, "11-runtime-preset-polar-ridge.png");
  const runtimePreset = await page.evaluate(
    () =>
      (window as unknown as { __PRISM_RUNTIME_BG__?: unknown })
        .__PRISM_RUNTIME_BG__,
  );

  await page.goto(`${BASE}/wbg-demo?stack=generated`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(
    () =>
      !!(window as unknown as { __PRISM_RUNTIME_BG__?: unknown })
        .__PRISM_RUNTIME_BG__,
    undefined,
    { timeout: 120000 },
  );
  await page.waitForTimeout(6000);
  await frame(page, "12-runtime-generated-stack.png");
  const runtimeGenerated = await page.evaluate(
    () =>
      (window as unknown as { __PRISM_RUNTIME_BG__?: unknown })
        .__PRISM_RUNTIME_BG__,
  );

  await writeFile(
    path.join(OUT, "runtime-evidence.json"),
    JSON.stringify({ runtimePreset, runtimeGenerated }, null, 2),
  );

  await browser.close();
  console.log("DONE →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
