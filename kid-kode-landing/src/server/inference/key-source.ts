// PRISM SHELL — INFERENCE KEY SOURCE (SHELL W-PROD, 2026-07-09)
//
// Server-only key resolution for the inference cascade. Env var first
// (canonical for prod / Vercel), then the founder key-drop file under
// PRISM_KEYS_DIR (default `../.assetgen`, chmod 600, gitignored — the same
// convention as src/server/capabilities/generative/pipeline.ts).
//
// INV-19: this module returns the value to the caller (the cascade's fetch)
// and NOTHING else — no logging, no errors that embed the value. A missing
// key resolves to null so the cascade can skip the provider honestly.

import 'server-only';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { InferenceProviderSpec } from './providers';

function keysDir(): string {
  return process.env.PRISM_KEYS_DIR ?? path.resolve(process.cwd(), '..', '.assetgen');
}

export function resolveProviderKey(spec: InferenceProviderSpec): string | null {
  const fromEnv = process.env[spec.envKey]?.trim();
  if (fromEnv) return fromEnv;
  try {
    const p = path.join(keysDir(), spec.keyFile);
    if (!existsSync(p)) return null;
    const v = readFileSync(p, 'utf8').trim();
    return v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function providerHasKey(spec: InferenceProviderSpec): boolean {
  return resolveProviderKey(spec) !== null;
}
