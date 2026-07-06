// PRISM INGEST — data-model / integration / brand-token extraction (W-IMPORT).
//
// Integrations map known dependencies to capability REFERENCES (I5 — never a
// credential). Data models cover the common shapes (Prisma, Drizzle, Zod,
// Mongoose, plain TS in model/type dirs). Brand tokens are colours + fonts +
// image assets — the raw material the direction seed folds into brandProfile.

import path from 'node:path';
import { IMAGE_EXT } from './repo-source';
import type {
  AnalyzedBrand,
  AnalyzedDataModel,
  AnalyzedIntegration,
} from '../../../packages/shared-interfaces/src/prism-ingest';

// ── Integrations (dependency → capability reference) ─────────────────────────

/** dep name (or prefix) → { providerId, label }. Provider ids align with the
 *  intake integrations catalog vocabulary where one exists. */
const INTEGRATION_MAP: Array<{ test: RegExp; providerId: string; label: string }> = [
  { test: /^stripe$|^@stripe\//, providerId: 'stripe', label: 'Stripe' },
  { test: /^@supabase\//, providerId: 'supabase', label: 'Supabase' },
  { test: /^next-auth$|^@auth\/core$|^@auth\//, providerId: 'auth', label: 'Auth.js' },
  { test: /^better-auth$/, providerId: 'auth', label: 'Better Auth' },
  { test: /^@clerk\//, providerId: 'clerk', label: 'Clerk' },
  { test: /^@prisma\/client$|^prisma$/, providerId: 'database', label: 'Prisma / SQL DB' },
  { test: /^drizzle-orm$/, providerId: 'database', label: 'Drizzle / SQL DB' },
  { test: /^mongoose$|^mongodb$/, providerId: 'database', label: 'MongoDB' },
  { test: /^@planetscale\//, providerId: 'database', label: 'PlanetScale' },
  { test: /^@vercel\/postgres$|^@neondatabase\//, providerId: 'database', label: 'Postgres' },
  { test: /^resend$/, providerId: 'email', label: 'Resend' },
  { test: /^@sendgrid\//, providerId: 'email', label: 'SendGrid' },
  { test: /^postmark$/, providerId: 'email', label: 'Postmark' },
  { test: /^twilio$/, providerId: 'sms', label: 'Twilio' },
  { test: /^openai$/, providerId: 'ai', label: 'OpenAI' },
  { test: /^@anthropic-ai\//, providerId: 'ai', label: 'Anthropic' },
  { test: /^ai$|^@ai-sdk\//, providerId: 'ai', label: 'Vercel AI SDK' },
  { test: /^@sanity\/|^next-sanity$/, providerId: 'cms', label: 'Sanity' },
  { test: /^contentful$/, providerId: 'cms', label: 'Contentful' },
  { test: /^algoliasearch$|^@algolia\//, providerId: 'search', label: 'Algolia' },
  { test: /^@aws-sdk\/|^aws-sdk$/, providerId: 'files', label: 'AWS' },
  { test: /^cloudinary$|^next-cloudinary$/, providerId: 'files', label: 'Cloudinary' },
  { test: /^uploadthing$|^@uploadthing\//, providerId: 'files', label: 'UploadThing' },
  { test: /^pusher$|^pusher-js$/, providerId: 'realtime', label: 'Pusher' },
  { test: /^ably$/, providerId: 'realtime', label: 'Ably' },
  { test: /^posthog-js$|^posthog-node$/, providerId: 'analytics', label: 'PostHog' },
  { test: /^@sentry\//, providerId: 'monitoring', label: 'Sentry' },
  { test: /^@vercel\/analytics$/, providerId: 'analytics', label: 'Vercel Analytics' },
];

export function detectIntegrations(deps: Record<string, string>): AnalyzedIntegration[] {
  const out: AnalyzedIntegration[] = [];
  const seen = new Set<string>();
  for (const dep of Object.keys(deps)) {
    for (const m of INTEGRATION_MAP) {
      if (m.test.test(dep)) {
        const key = m.providerId;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ providerId: m.providerId, label: m.label, evidence: `dep: ${dep}` });
        }
        break;
      }
    }
  }
  return out.slice(0, 40);
}

// ── Data models ───────────────────────────────────────────────────────────────

const MODEL_DIR_RE = /(?:^|\/)(models?|schema|schemas|db|database|entities|types)(?:\/|$)/;

/** Extract Prisma `model X { ... }` blocks. */
function fromPrisma(file: string, text: string): AnalyzedDataModel[] {
  const out: AnalyzedDataModel[] = [];
  const re = /model\s+([A-Za-z0-9_]+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 60) {
    const fields = [...m[2].matchAll(/^\s*([A-Za-z0-9_]+)\s+[A-Za-z0-9_[\]?]+/gm)]
      .map((f) => f[1])
      .filter((f) => !['', 'model'].includes(f));
    out.push({ name: m[1], source: 'prisma', fields: fields.slice(0, 60), file });
  }
  return out;
}

/** Extract Drizzle `pgTable('x', { ... })` / `sqliteTable` / `mysqlTable`. */
function fromDrizzle(file: string, text: string): AnalyzedDataModel[] {
  const out: AnalyzedDataModel[] = [];
  const re = /(?:pgTable|sqliteTable|mysqlTable)\(\s*['"]([A-Za-z0-9_]+)['"]\s*,\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 60) {
    const fields = [...m[2].matchAll(/([A-Za-z0-9_]+)\s*:/g)].map((f) => f[1]);
    out.push({ name: m[1], source: 'drizzle', fields: fields.slice(0, 60), file });
  }
  return out;
}

/** Extract exported Zod object schemas: `const xSchema = z.object({ ... })`. */
function fromZod(file: string, text: string): AnalyzedDataModel[] {
  const out: AnalyzedDataModel[] = [];
  const re = /(?:const|let)\s+([A-Za-z0-9_]+)\s*=\s*z\.object\(\{([^]*?)\}\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && out.length < 60) {
    const body = m[2].slice(0, 2000);
    const fields = [...body.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((f) => f[1]);
    const name = m[1].replace(/Schema$/, '');
    if (fields.length) out.push({ name, source: 'zod', fields: fields.slice(0, 60), file });
  }
  return out;
}

/** Extract Mongoose `new Schema({ ... })` and TS interfaces in model dirs. */
function fromMongooseOrTs(file: string, text: string): AnalyzedDataModel[] {
  const out: AnalyzedDataModel[] = [];
  const mongoRe = /new\s+(?:mongoose\.)?Schema\(\{([^]*?)\}\)/g;
  let m: RegExpExecArray | null;
  while ((m = mongoRe.exec(text)) && out.length < 20) {
    const fields = [...m[1].slice(0, 2000).matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((f) => f[1]);
    if (fields.length) out.push({ name: modelNameFromFile(file), source: 'mongoose', fields: fields.slice(0, 60), file });
  }
  if (MODEL_DIR_RE.test(file)) {
    const ifRe = /(?:export\s+)?(?:interface|type)\s+([A-Z][A-Za-z0-9_]*)\s*(?:=\s*)?\{([^}]*)\}/g;
    while ((m = ifRe.exec(text)) && out.length < 40) {
      const fields = [...m[2].matchAll(/^\s*([A-Za-z0-9_]+)\??\s*:/gm)].map((f) => f[1]);
      if (fields.length >= 1) out.push({ name: m[1], source: 'typescript', fields: fields.slice(0, 60), file });
    }
  }
  return out;
}

function modelNameFromFile(file: string): string {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  return base ? base[0].toUpperCase() + base.slice(1) : 'Model';
}

export async function extractDataModels(
  files: string[],
  readText: (file: string) => Promise<string | null>,
): Promise<AnalyzedDataModel[]> {
  const out: AnalyzedDataModel[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    if (out.length >= 120) break;
    const isPrisma = file.endsWith('.prisma');
    const isCandidate =
      isPrisma ||
      MODEL_DIR_RE.test(file) ||
      /(?:^|\/)(prisma|drizzle)(?:\/|\.)/.test(file) ||
      /\.(ts|tsx|js|mjs)$/.test(file);
    if (!isCandidate) continue;
    const text = await readText(file);
    if (!text) continue;
    let found: AnalyzedDataModel[] = [];
    if (isPrisma) found = fromPrisma(file, text);
    else {
      if (text.includes('pgTable') || text.includes('sqliteTable') || text.includes('mysqlTable')) found.push(...fromDrizzle(file, text));
      if (/z\.object\(/.test(text) && MODEL_DIR_RE.test(file)) found.push(...fromZod(file, text));
      if (text.includes('Schema(') || MODEL_DIR_RE.test(file)) found.push(...fromMongooseOrTs(file, text));
    }
    for (const dm of found) {
      const key = `${dm.name}:${dm.source}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(dm);
      }
    }
  }
  return out.slice(0, 120);
}

// ── Brand tokens ──────────────────────────────────────────────────────────────

const HEX_RE = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const NEXT_FONT_RE = /from\s+['"]next\/font\/(?:google|local)['"]/;
const FONT_IMPORT_RE = /import\s*\{\s*([A-Za-z0-9_,\s]+)\}\s*from\s+['"]next\/font\/google['"]/g;
const FONT_FAMILY_RE = /font-family\s*:\s*([^;{}]+)[;}]/gi;

export async function extractBrand(
  files: string[],
  readText: (file: string) => Promise<string | null>,
  urlSeedThemeColor: string | null,
): Promise<AnalyzedBrand> {
  const colorCounts = new Map<string, number>();
  const fonts = new Set<string>();
  const images: string[] = [];

  // Style/config files most likely to hold brand colours + fonts.
  const styleFiles = files.filter(
    (f) =>
      /\.(css|scss)$/.test(f) ||
      /tailwind\.config\.(js|ts|cjs|mjs)$/.test(f) ||
      /(?:^|\/)(globals|theme|tokens|colors|layout)\.(css|scss|ts|tsx)$/.test(f) ||
      /(?:^|\/)app\/(layout|globals)\.(tsx|ts|css)$/.test(f) ||
      /(?:^|\/)(fonts?|font)\.(ts|tsx|js)$/.test(f),
  );
  for (const f of styleFiles.slice(0, 60)) {
    const text = await readText(f);
    if (!text) continue;
    for (const m of text.matchAll(HEX_RE)) {
      const hex = normalizeHex('#' + m[1]);
      if (hex) colorCounts.set(hex, (colorCounts.get(hex) ?? 0) + 1);
    }
    if (NEXT_FONT_RE.test(text)) {
      for (const fm of text.matchAll(FONT_IMPORT_RE)) {
        fm[1].split(',').map((s) => s.trim()).filter(Boolean).forEach((name) => fonts.add(deCamel(name)));
      }
    }
    for (const fm of text.matchAll(FONT_FAMILY_RE)) {
      const fam = fm[1].split(',')[0].replace(/["']/g, '').trim();
      if (fam && !/^var\(|^inherit$|^sans-serif$|^serif$|^monospace$/.test(fam)) fonts.add(fam);
    }
  }

  // Image assets under public/ (paths only, never read).
  for (const f of files) {
    if (images.length >= 40) break;
    if (/(?:^|\/)public\//.test(f) && IMAGE_EXT.has(path.extname(f).toLowerCase())) {
      images.push('/' + f.replace(/^.*?public\//, ''));
    }
  }

  // Rank colours by frequency; keep the distinctive (non-black/white) first.
  const colors = [...colorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hex]) => hex)
    .filter((hex) => !['#000000', '#ffffff', '#fff', '#000'].includes(hex))
    .slice(0, 24);

  const themeColor = urlSeedThemeColor ?? colors[0] ?? null;

  return {
    name: null, // set by the analyzer from package name / url seed
    colors,
    fonts: [...fonts].slice(0, 16),
    images: images.slice(0, 40),
    themeColor,
  };
}

function normalizeHex(v: string): string | null {
  const m = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return '#' + hex;
}

function deCamel(name: string): string {
  return name.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}
