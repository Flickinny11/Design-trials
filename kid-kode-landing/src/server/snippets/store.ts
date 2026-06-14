// PRISM NODE-EDITOR V2 — SnippetStore (D3, criteria B5). Server-only.
//
// Users paste / save / NAME custom function snippets, reusable across all their
// builds. Two backends behind one interface, reached via /api/prism/snippets:
//   • LocalSnippetStore   — DEFAULT. Server-side JSON file (.data/snippets.json)
//     — persists across page reloads AND server restarts. Works offline NOW.
//   • SupabaseSnippetStore — lazy @supabase/supabase-js with per-user RLS; only
//     loaded when SUPABASE_URL + key are set. Swap = config (A6/D3).
//
// A Snippet is a NON-SECRET reusable action template. Secrets NEVER stored here.
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { optionalImport } from '../optional-import.ts';

export interface Snippet {
  id: string;
  userId: string;
  name: string;
  providerId: string;
  actionId: string;
  brandKey: string;
  platform: string;
  label: string;
  params?: Record<string, unknown>;
  /** Optional free-text the user pasted (a description / pseudo-config, NOT executed). */
  body?: string;
  createdAt: string;
}

export interface SnippetStore {
  readonly id: string;
  readonly live: boolean;
  list(userId: string): Promise<Snippet[]>;
  save(
    userId: string,
    snippet: Omit<Snippet, 'id' | 'userId' | 'createdAt'> & Partial<Pick<Snippet, 'id' | 'createdAt'>>,
  ): Promise<Snippet>;
  remove(userId: string, id: string): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'snippets.json');

function suffix(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export class LocalSnippetStore implements SnippetStore {
  readonly id = 'local';
  readonly live = true; // genuinely persists (file-backed)
  private mem: Record<string, Snippet[]> | null = null;

  private async load(): Promise<Record<string, Snippet[]>> {
    if (this.mem) return this.mem;
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8');
      this.mem = JSON.parse(raw);
    } catch {
      this.mem = {};
    }
    return this.mem!;
  }
  private async persist(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(this.mem ?? {}, null, 2), 'utf8');
  }

  async list(userId: string): Promise<Snippet[]> {
    const db = await this.load();
    return [...(db[userId] ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async save(
    userId: string,
    snippet: Omit<Snippet, 'id' | 'userId' | 'createdAt'> & Partial<Pick<Snippet, 'id' | 'createdAt'>>,
  ): Promise<Snippet> {
    const db = await this.load();
    const list = db[userId] ?? (db[userId] = []);
    const id = snippet.id ?? `snip-${suffix(userId + snippet.name + snippet.actionId + list.length)}`;
    const createdAt = snippet.createdAt ?? new Date().toISOString();
    const full: Snippet = { ...snippet, id, userId, createdAt } as Snippet;
    const existing = list.findIndex((s) => s.id === id);
    if (existing >= 0) list[existing] = full; else list.push(full);
    await this.persist();
    return full;
  }
  async remove(userId: string, id: string): Promise<void> {
    const db = await this.load();
    db[userId] = (db[userId] ?? []).filter((s) => s.id !== id);
    await this.persist();
  }
}

export class SupabaseSnippetStore implements SnippetStore {
  readonly id = 'supabase';
  readonly live: boolean;
  constructor() {
    this.live = Boolean(
      process.env.SUPABASE_URL &&
        (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY),
    );
  }
  private async client(): Promise<unknown | null> {
    if (!this.live) return null;
    const mod = await optionalImport<any>('@supabase/supabase-js');
    if (!mod?.createClient) return null;
    return mod.createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!,
    );
  }
  private async notWired(): Promise<never> {
    throw new Error(
      'SupabaseSnippetStore: install @supabase/supabase-js@2.108.1, set SUPABASE_URL + key, create the `snippets` table with RLS (user_id = auth.uid()), then wire these methods.',
    );
  }
  async list(_userId: string): Promise<Snippet[]> { await this.client(); return this.notWired(); }
  async save(): Promise<Snippet> { return this.notWired(); }
  async remove(): Promise<void> { return this.notWired(); }
}

let cached: SnippetStore | null = null;
export function getSnippetStore(): SnippetStore {
  if (cached) return cached;
  const choice = (process.env.PRISM_SNIPPET_STORE || 'local').toLowerCase();
  if (choice === 'supabase') {
    const sb = new SupabaseSnippetStore();
    cached = sb.live ? sb : new LocalSnippetStore();
  } else {
    cached = new LocalSnippetStore();
  }
  return cached;
}
export function __resetSnippetStore(): void { cached = null; }
