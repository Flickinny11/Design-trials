// PRISM INGEST — repo source abstraction (W-IMPORT, D4).
//
// A RepoSource is the read-only surface the analyzer walks. Three implementations:
//   • LocalDirSource   — node:fs over a local path (fixtures + all unit tests;
//                        network-free, deterministic).
//   • GitHubUrlSource  — public GitHub REST (git tree + raw contents). The HTTP
//                        client is INJECTED at the tRPC route boundary using the
//                        SSRF-hardened server-only safe-fetch, so this pure module
//                        never imports server-only code and vitest can import it.
//   • GitHubAppSource  — installation-token auth for PRIVATE repos (INV-19). Typed
//                        interface + throwing stub until the founder's GitHub App
//                        arrives. The key material is typed, NEVER logged.
//
// The analyzer only ever sees `listFiles()` + `readFile()` + `repoRef` + `kind`.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { IngestSourceKind } from '../../../packages/shared-interfaces/src/prism-ingest';

/** Read-only repo surface the analyzer consumes. */
export interface RepoSource {
  readonly kind: IngestSourceKind;
  /** owner/repo or a local marker — used as the corpus repo_ref (public id). */
  readonly repoRef: string;
  /** package.json-declared name/description, when the source can cheaply
   *  surface it (GitHub repo metadata); null otherwise (analyzer reads
   *  package.json regardless). */
  readonly meta?: { name?: string | null; description?: string | null; defaultBranch?: string | null };
  /** All repo-relative source paths (already filtered of vendored/build dirs). */
  listFiles(): Promise<string[]>;
  /** File text, or null if missing / too large / binary. */
  readFile(relPath: string): Promise<string | null>;
}

/** Dirs never worth reading — vendored, build output, VCS. */
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out', 'coverage',
  '.turbo', '.vercel', '.cache', 'vendor', '.yarn', '.pnpm-store',
]);

/** Extensions the analyzer reads as text. */
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.css', '.scss', '.md', '.mdx', '.html', '.prisma', '.sql', '.env.example',
]);

/** Image assets we note as brand candidates (paths only, never read). */
export const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.svg', '.webp', '.avif', '.gif', '.ico']);

const MAX_FILES = 4000; // structural ceiling — a repo this size is amply sampled
const MAX_FILE_BYTES = 512 * 1024; // 512 KB per file (a source file is far smaller)

function isTextPath(p: string): boolean {
  const ext = path.extname(p).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  const base = path.basename(p).toLowerCase();
  return base === 'package.json' || base === '.env.example' || base === 'tailwind.config.js' || base === 'tailwind.config.ts';
}

// ── Local directory source ────────────────────────────────────────────────────

export class LocalDirSource implements RepoSource {
  readonly kind: IngestSourceKind = 'local';
  readonly repoRef: string;
  private readonly root: string;
  private cached: string[] | null = null;

  constructor(root: string, repoRef?: string) {
    this.root = path.resolve(root);
    this.repoRef = repoRef ?? `local:${path.basename(this.root)}`;
  }

  async listFiles(): Promise<string[]> {
    if (this.cached) return this.cached;
    const out: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      if (out.length >= MAX_FILES) return;
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (out.length >= MAX_FILES) break;
        if (e.name.startsWith('.') && e.name !== '.env.example') {
          if (e.isDirectory()) continue; // skip dotdirs (.git etc.)
        }
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (SKIP_DIRS.has(e.name)) continue;
          await walk(abs);
        } else if (e.isFile()) {
          const rel = path.relative(this.root, abs).split(path.sep).join('/');
          const ext = path.extname(e.name).toLowerCase();
          if (isTextPath(rel) || IMAGE_EXT.has(ext)) out.push(rel);
        }
      }
    };
    await walk(this.root);
    this.cached = out.sort();
    return this.cached;
  }

  async readFile(relPath: string): Promise<string | null> {
    // Path-guard: never escape the root.
    const abs = path.resolve(this.root, relPath);
    if (!abs.startsWith(this.root + path.sep) && abs !== this.root) return null;
    if (IMAGE_EXT.has(path.extname(abs).toLowerCase())) return null; // don't read bytes
    try {
      const stat = await fs.stat(abs);
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) return null;
      return await fs.readFile(abs, 'utf8');
    } catch {
      return null;
    }
  }
}

// ── Public GitHub URL source ──────────────────────────────────────────────────

/** Injected HTTP client — the route wires safe-fetch here; tests never hit it. */
export interface HttpGet {
  (url: string): Promise<{ ok: boolean; status: number; text: string }>;
}

/** Parse `owner/repo`, `owner/repo#branch`, or a github.com URL into parts. */
export function parseGitHubRef(
  raw: string,
): { owner: string; repo: string; branch: string | null } | null {
  const s = raw.trim();
  // Full URL form.
  const urlMatch = /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/tree\/([^/\s#?]+))?/i.exec(s);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2].replace(/\.git$/, ''), branch: urlMatch[3] ?? null };
  }
  // owner/repo[#branch] shorthand.
  const shortMatch = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:#([A-Za-z0-9_./-]+))?$/.exec(s);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2].replace(/\.git$/, ''), branch: shortMatch[3] ?? null };
  }
  return null;
}

export class GitHubUrlSource implements RepoSource {
  readonly kind: IngestSourceKind = 'github-url';
  readonly repoRef: string;
  meta: { name?: string | null; description?: string | null; defaultBranch?: string | null } = {};
  private readonly owner: string;
  private readonly repo: string;
  private branch: string | null;
  private readonly httpGet: HttpGet;
  private tree: string[] | null = null;

  constructor(ref: { owner: string; repo: string; branch: string | null }, httpGet: HttpGet) {
    this.owner = ref.owner;
    this.repo = ref.repo;
    this.branch = ref.branch;
    this.httpGet = httpGet;
    this.repoRef = `${ref.owner}/${ref.repo}`;
  }

  /** Resolve default branch + description from repo metadata (one call). */
  private async ensureMeta(): Promise<void> {
    if (this.meta.defaultBranch || this.branch) return;
    try {
      const res = await this.httpGet(`https://api.github.com/repos/${this.owner}/${this.repo}`);
      if (res.ok) {
        const j = JSON.parse(res.text) as { default_branch?: string; description?: string; name?: string };
        this.meta = {
          name: j.name ?? null,
          description: j.description ?? null,
          defaultBranch: j.default_branch ?? null,
        };
        if (!this.branch) this.branch = j.default_branch ?? null;
      }
    } catch {
      /* fall through to main/master */
    }
  }

  async listFiles(): Promise<string[]> {
    if (this.tree) return this.tree;
    await this.ensureMeta();
    const branches = [this.branch, 'main', 'master'].filter((b): b is string => Boolean(b));
    for (const b of branches) {
      try {
        const res = await this.httpGet(
          `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${b}?recursive=1`,
        );
        if (!res.ok) continue;
        const j = JSON.parse(res.text) as { tree?: Array<{ path?: string; type?: string }> };
        const files = (j.tree ?? [])
          .filter((n) => n.type === 'blob' && typeof n.path === 'string')
          .map((n) => n.path as string)
          .filter((p) => {
            const seg = p.split('/');
            if (seg.some((s) => SKIP_DIRS.has(s))) return false;
            const ext = path.extname(p).toLowerCase();
            return isTextPath(p) || IMAGE_EXT.has(ext);
          })
          .slice(0, MAX_FILES);
        this.branch = b;
        this.tree = files.sort();
        return this.tree;
      } catch {
        /* try next branch */
      }
    }
    this.tree = [];
    return this.tree;
  }

  async readFile(relPath: string): Promise<string | null> {
    if (IMAGE_EXT.has(path.extname(relPath).toLowerCase())) return null;
    const b = this.branch ?? 'main';
    try {
      const res = await this.httpGet(
        `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${b}/${relPath}`,
      );
      if (!res.ok) return null;
      if (res.text.length > MAX_FILE_BYTES) return res.text.slice(0, MAX_FILE_BYTES);
      return res.text;
    } catch {
      return null;
    }
  }
}

// ── Private GitHub App source (typed seam — STUB until the App arrives, D4) ────

/** Typed config for the read-only GitHub App used to import PRIVATE repos.
 *  The private key is a SECRET — it is typed here so the seam is real, and is
 *  NEVER logged or placed in a graph/record (INV-19). */
export interface GitHubAppAuth {
  appId: string;
  installationId: string;
  /** PEM private key — resolved server-side only, never serialized to a record. */
  privateKey: string;
}

/** Whether App-authed private-repo import is available on this machine. Reads
 *  presence of the env the founder will drop (never the value). */
export function githubAppImportConfigured(): boolean {
  const e = typeof process !== 'undefined' ? process.env : undefined;
  return Boolean(e?.PRISM_GITHUB_APP_ID && e?.PRISM_GITHUB_APP_PRIVATE_KEY);
}

/** Private-repo source. Structurally identical to GitHubUrlSource once it holds
 *  an installation token, but that token exchange requires the App key. Until
 *  the key lands, every read throws a clear, honest error (I-FAILOPEN upstream
 *  degrades to public/guided-build). */
export class GitHubAppSource implements RepoSource {
  readonly kind: IngestSourceKind = 'github-app';
  readonly repoRef: string;
  private readonly configured: boolean;

  constructor(repoRef: string, _auth?: GitHubAppAuth) {
    this.repoRef = repoRef;
    // Presence check ONLY — the auth object (with the private key) is never
    // retained on the instance and never logged.
    this.configured = githubAppImportConfigured();
  }

  private guard(): never {
    throw new Error(
      'GitHub App import is not configured yet (arrives with the founder read-only GitHub App). ' +
        'Public repos import today via a repo URL.',
    );
  }

  async listFiles(): Promise<string[]> {
    if (!this.configured) this.guard();
    // SHIP-BRAND: exchange the App key for an installation token, then read the
    // git tree exactly as GitHubUrlSource does over the authed API.
    this.guard();
  }

  async readFile(_relPath: string): Promise<string | null> {
    if (!this.configured) this.guard();
    this.guard();
  }
}
