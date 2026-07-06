// PRISM SHELL-W10 — shared server-side plumbing for the generative adapters.
// Server-only. Paths, key/script presence checks, a line-streaming child spawn,
// GLB optimization, and public-asset placement. NO vendor REST lives here — each
// vendor call lives in its own adapter (spawning its committed .assetgen client)
// per INV-NEV2-4. Keys are read ONLY by the spawned child (never by this Node
// process, never returned to the client) per INV-19 — same discipline as
// /api/material-gen.
import 'server-only';
import { spawn } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';

// The committed generation pipelines + keys live at the Design-trials root
// .assetgen (gitignored). Absent on a fresh clone → adapters report live:false
// and serve demo-safe offline results (build + verify never break).
export const ASSETGEN_DIR = path.resolve(process.cwd(), '..', '.assetgen');
export const TRIPO_SCRIPT = path.join(ASSETGEN_DIR, 'tripo.py');
export const TRIPO_KEY = path.join(ASSETGEN_DIR, 'tripo.key');
export const REPLICATE_SCRIPT = path.join(ASSETGEN_DIR, 'replicate-3d.py');
export const REPLICATE_KEY = path.join(ASSETGEN_DIR, 'replicate.key');
export const GEN_MATERIAL_SCRIPT = path.join(ASSETGEN_DIR, 'gen-material.sh');
export const OPTIMIZE_SCRIPT = path.join(ASSETGEN_DIR, 'optimize-glb.mjs');

// Public asset store paths (already used by the editor's saved-asset listing).
export const MODELS_DIR = path.join(process.cwd(), 'public', 'prism-mock', 'editor', 'models', 'generated');
export const TEX_DIR = path.join(process.cwd(), 'public', 'prism-mock', 'editor', 'textures', 'generated');

export function hasFile(p: string): boolean {
  try { return existsSync(p); } catch { return false; }
}

export function modelUrl(jobId: string, file = 'model.glb'): string {
  return `/prism-mock/editor/models/generated/${jobId}/${file}`;
}

export function newJobId(prefix = 'gj'): string {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 0x7fffffff).toString(36);
  return `${prefix}-${t}${r}`;
}

export interface SpawnResult { code: number; out: string; err: string; }

/**
 * Spawn a child, stream combined stdout/stderr line-by-line to `onLine`, and
 * resolve with the exit code + captured buffers. Enforces a hard timeout.
 */
export function spawnCapture(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv },
  onLine?: (line: string) => void,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env });
    let out = '';
    let err = '';
    let buf = '';
    const flush = (chunk: string) => {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        if (onLine) try { onLine(line); } catch { /* progress best-effort */ }
      }
    };
    child.stdout.on('data', (d) => { const s = d.toString(); out += s; flush(s); });
    child.stderr.on('data', (d) => { const s = d.toString(); err += s; flush(s); });
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve({ code: 124, out, err: err + '\nTIMEOUT' }); }, opts.timeoutMs ?? 900_000);
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: 1, out, err: err + '\n' + String(e) }); });
    child.on('close', (code) => { clearTimeout(timer); if (buf && onLine) try { onLine(buf); } catch { /* */ } resolve({ code: code ?? 1, out, err }); });
  });
}

/** Parse a coarse 0..100 progress from a vendor client line, or null. */
export function parseProgress(line: string): number | null {
  const m = line.match(/\((\d{1,3})%\)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
}

/** Capture a Tripo task id from a client line ("task <id> submitted" | "TASK_ID <id>"). */
export function parseVendorTaskId(line: string): string | null {
  const a = line.match(/\btask\s+([0-9a-f-]{16,})\s+submitted/i);
  if (a) return a[1];
  const b = line.match(/\bTASK_ID\s+([0-9a-f-]{16,})/i);
  return b ? b[1] : null;
}

export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

/**
 * Optimize a downloaded GLB into a shippable one via the committed
 * optimize-glb.mjs (weld → simplify → resize textures → plain GLB). Falls back
 * to a plain copy when the optimizer is absent. Returns the final file path.
 */
export async function finalizeGlb(rawGlbPath: string, jobDir: string): Promise<string> {
  const finalPath = path.join(jobDir, 'model.glb');
  if (hasFile(OPTIMIZE_SCRIPT)) {
    // optimize-glb.mjs takes a SOURCE DIR; feed it the raw's dir with a filter.
    const srcDir = path.dirname(rawGlbPath);
    const res = await spawnCapture(
      'node',
      [OPTIMIZE_SCRIPT, srcDir, jobDir, '1024', '45000', '4', path.basename(rawGlbPath, '.glb')],
      { cwd: ASSETGEN_DIR, timeoutMs: 300_000 },
    );
    // optimizer writes <jobDir>/<basename>.glb — normalize to model.glb.
    const written = path.join(jobDir, path.basename(rawGlbPath));
    if (res.code === 0 && hasFile(written)) {
      if (written !== finalPath) { await fs.rename(written, finalPath).catch(async () => { await fs.copyFile(written, finalPath); }); }
      return finalPath;
    }
  }
  // Fallback: plain copy (no decoder is wired in the runtime → stay uncompressed).
  await fs.copyFile(rawGlbPath, finalPath);
  return finalPath;
}
