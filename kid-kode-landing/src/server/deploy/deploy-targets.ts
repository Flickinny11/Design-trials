// PRISM SHELL — DEPLOY TARGET ADAPTER LAYER (SHELL W5 / E15 seam, 2026-07-04)
//
// The typed DeployTarget adapter interface (E15). W5 ships the SHAPE so W5B
// extends without rework (§14.1): the Conductor reads the selected host's
// requirements and generates that host's config, deploys, then verifies the
// live deployment on that host (§11.2). One-click per host; all env-gated with
// dry-run modes (the W5 default — no host token blocks nothing).
//
// W5 activates ONE real target — `prism-cloud` — which serves a shareable
// preview URL from this very Next app (E14). The external hosts
// (Vercel/Netlify/Cloudflare frontend + Modal/RunPod/Vast backend/GPU) are the
// E15 seed: their adapters generate a host-config MANIFEST and, absent a token,
// run in dry-run (manifest + local preview URL as evidence). I5: `requiredEnv`
// lists NAMES only — a value never appears in a manifest or a record.

import 'server-only';
import type {
  DeployCategory,
  DeployTargetDescriptor,
  DeployTargetKind,
} from '../../../packages/shared-interfaces/src/prism-conductor';

/** The generated host-config manifest — what a given host needs to run the
 *  Prism runtime bundle. Env is NAMES only (I5). */
export interface HostConfigManifest {
  kind: DeployTargetKind;
  runtime: 'three-webgpu';
  entry: string;
  /** Host-shaped config fields (framework, build command, etc.). */
  config: Record<string, string>;
  requiredEnv: string[];
}

interface TargetSpec {
  kind: DeployTargetKind;
  label: string;
  category: DeployCategory;
  /** Env var NAMES whose PRESENCE flips this host to live deploys. Empty =
   *  always available (prism-cloud). */
  requiredEnv: string[];
  note: string;
  /** Host-specific config generator (dry-run evidence + live config source). */
  config(appName: string, previewPath: string): Record<string, string>;
}

const TARGETS: readonly TargetSpec[] = [
  {
    kind: 'prism-cloud',
    label: 'Prism Cloud',
    category: 'frontend',
    requiredEnv: [],
    note: 'Instant shareable preview — the runtime IS the product. No config needed.',
    config: (appName, previewPath) => ({
      framework: 'prism-runtime',
      entry: previewPath,
      app: appName,
    }),
  },
  {
    kind: 'vercel',
    label: 'Vercel',
    category: 'frontend',
    requiredEnv: ['VERCEL_TOKEN'],
    note: 'Global edge network + preview deployments. Recommended for frontend.',
    config: (appName) => ({
      framework: 'nextjs',
      buildCommand: 'next build',
      outputDirectory: '.next',
      project: appName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 52),
    }),
  },
  {
    kind: 'netlify',
    label: 'Netlify',
    category: 'frontend',
    requiredEnv: ['NETLIFY_AUTH_TOKEN'],
    note: 'Frontend hosting with deploy previews and forms.',
    config: (appName) => ({
      build: 'next build',
      publish: '.next',
      site: appName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 52),
    }),
  },
  {
    kind: 'cloudflare',
    label: 'Cloudflare',
    category: 'frontend',
    requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
    note: 'Workers + Pages at the edge. At-cost domains via the Registrar API.',
    config: (appName) => ({
      compatibility_date: '2026-07-01',
      name: appName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 52),
      pages_build_output_dir: '.next',
    }),
  },
  {
    kind: 'modal',
    label: 'Modal',
    category: 'backend',
    requiredEnv: ['MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET'],
    note: 'Serverless GPU for backend/model nodes (E19). Per-second billing.',
    config: (appName) => ({
      app: appName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 52),
      gpu: 'A10G',
      runtime: 'python-3.12',
    }),
  },
  {
    kind: 'runpod',
    label: 'RunPod',
    category: 'backend',
    requiredEnv: ['RUNPOD_API_KEY'],
    note: 'GPU pods + serverless endpoints for backend/model nodes (E19).',
    config: (appName) => ({
      endpoint: appName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 52),
      gpuType: 'NVIDIA A40',
    }),
  },
  {
    kind: 'vast',
    label: 'Vast.ai',
    category: 'backend',
    requiredEnv: ['VAST_API_KEY'],
    note: 'Low-cost GPU marketplace for backend/model workloads (E19).',
    config: (appName) => ({
      image: 'prism/runtime:latest',
      instance: appName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 52),
    }),
  },
];

const BY_KIND = new Map(TARGETS.map((t) => [t.kind, t]));

/** Is this host live (its env token present)? prism-cloud is always live. */
export function isTargetAvailable(kind: DeployTargetKind): boolean {
  const spec = BY_KIND.get(kind);
  if (!spec) return false;
  return spec.requiredEnv.every((name) => {
    const v = process.env[name];
    return typeof v === 'string' && v.length > 0;
  });
}

/** The descriptor list the ship UI renders (E15/E18). */
export function getDeployTargets(): DeployTargetDescriptor[] {
  return TARGETS.map((t) => ({
    kind: t.kind,
    label: t.label,
    category: t.category,
    available: isTargetAvailable(t.kind),
    requiredEnv: t.requiredEnv,
    note: t.note,
  }));
}

export function getTargetDescriptor(kind: DeployTargetKind): DeployTargetDescriptor | null {
  const t = BY_KIND.get(kind);
  if (!t) return null;
  return {
    kind: t.kind,
    label: t.label,
    category: t.category,
    available: isTargetAvailable(t.kind),
    requiredEnv: t.requiredEnv,
    note: t.note,
  };
}

/** Generate the host-config manifest for a target (dry-run evidence + the
 *  config a live deploy would apply). `previewPath` is the app-relative preview
 *  route the bundle entry points at. */
export function buildHostManifest(
  kind: DeployTargetKind,
  appName: string,
  previewPath: string,
): HostConfigManifest | null {
  const t = BY_KIND.get(kind);
  if (!t) return null;
  return {
    kind: t.kind,
    runtime: 'three-webgpu',
    entry: previewPath,
    config: t.config(appName, previewPath),
    requiredEnv: t.requiredEnv,
  };
}
