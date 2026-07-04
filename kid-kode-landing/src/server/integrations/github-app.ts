import 'server-only';

// PRISM SHELL — GITHUB APP ADAPTER (SHELL W3, spec I7 / §10 S6 / task 4)
//
// Installation + repo selection and the PR-BASED edit path contract for
// production apps. Server-only: the App private key / client secret live
// exclusively in this process and NEVER cross the wire (I5). Everything this
// module hands the client is a capability REFERENCE (installation id, repo
// name) — never a token.
//
// SANDBOX-FIRST (mirrors the Nango adapter's offline-first contract): when the
// GitHub App credentials are absent from env the module runs in a deterministic
// SANDBOX so the full white-label UI, the connect flow, and the PR-path
// contract are exercisable headlessly. With the App configured (production
// swap), installUrl points at the real App and the live install/repo listing is
// reached through the per-installation token — no UI rework.
//
// LIVE-ACTIVATION (production, founder supplies — listed in SHELL-W3-REPORT):
//   GITHUB_APP_SLUG            (the App's URL slug → install URL)
//   GITHUB_APP_ID              (numeric App id)
//   GITHUB_APP_PRIVATE_KEY     (PEM — signs installation-token requests)
//   GITHUB_APP_CLIENT_ID / GITHUB_APP_CLIENT_SECRET  (user OAuth for the
//                              installation-selection callback)
// The live install/repo enumeration (Octokit) is wired behind these; it is out
// of scope for the offline gate, which proves the contract + sandbox flow.

import { randomUUID } from 'node:crypto';
import type {
  CapabilityRefWire,
  GithubInstallation,
  GithubPrEditPlan,
  GithubRepo,
} from '../../../packages/shared-interfaces/src/prism-integrations';

const APP_SLUG = process.env.GITHUB_APP_SLUG;
const APP_ID = process.env.GITHUB_APP_ID;
const APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY;

/** True only when the real App is configured. Drives sandbox-vs-live. */
export function githubAppConfigured(): boolean {
  return Boolean(APP_SLUG && APP_ID && APP_PRIVATE_KEY);
}

function nowIso(): string {
  return new Date().toISOString();
}

/** The install URL. Real → the App's GitHub install page; sandbox → an honest
 *  in-app sentinel the UI labels "sandbox". */
export function installUrl(): { url: string; sandbox: boolean } {
  if (githubAppConfigured()) {
    return { url: `https://github.com/apps/${APP_SLUG}/installations/new`, sandbox: false };
  }
  return { url: 'prism-sandbox://github-app/install', sandbox: true };
}

/** A deterministic sandbox installation so the headless gate has something to
 *  select. Live enumeration (per-user OAuth + App JWT) is the production swap. */
function sandboxInstallation(): GithubInstallation {
  return {
    installationId: 'sandbox-inst-1',
    account: 'prism-sandbox',
    accountType: 'Organization',
    sandbox: true,
    createdAt: nowIso(),
  };
}

/** Installations available to this tenant. Sandbox returns one deterministic
 *  org; the live path (Octokit App auth) lands with the production swap. */
export async function listInstallations(): Promise<GithubInstallation[]> {
  if (!githubAppConfigured()) return [sandboxInstallation()];
  // Live enumeration deferred to the production swap (needs Octokit + the
  // installation OAuth callback). Fail SAFE to empty rather than guess.
  return [];
}

/** Repos visible to an installation. Sandbox returns a small deterministic set
 *  spanning public/private + a couple of default branches. */
export async function listRepos(installationId: string): Promise<GithubRepo[]> {
  if (!githubAppConfigured()) {
    if (installationId !== 'sandbox-inst-1') return [];
    return [
      { fullName: 'prism-sandbox/marketing-site', private: false, defaultBranch: 'main', description: 'Static marketing site' },
      { fullName: 'prism-sandbox/app-dashboard', private: true, defaultBranch: 'main', description: 'Internal dashboard' },
      { fullName: 'prism-sandbox/api-worker', private: true, defaultBranch: 'develop', description: 'Edge API worker' },
    ];
  }
  return [];
}

/** A capability REFERENCE for an installation. No token — the App JWT /
 *  installation token is minted server-side at use time from the private key. */
export function capabilityRefForInstallation(installationId: string): CapabilityRefWire {
  return {
    refId: `github:app:${installationId}`,
    scope: 'github:repo',
    label: `GitHub App · ${installationId}`,
    provider: 'github',
    authMethod: 'oauth2.1',
    integrationId: 'github',
    connectionId: installationId,
  };
}

/** The PR-BASED edit path CONTRACT for a production app (I7). Never a push to
 *  the default branch, never a force-push; irreversible steps require explicit
 *  per-action confirmation. This is the PLAN the shell shows before any prod
 *  edit; execution lands with W5's build orchestrator. */
export function prEditPlan(input: {
  repoFullName: string;
  baseBranch?: string;
  description: string;
}): GithubPrEditPlan {
  const base = input.baseBranch || 'main';
  const short = randomUUID().slice(0, 8);
  return {
    repoFullName: input.repoFullName,
    branch: `prism/edit-${short}`,
    baseBranch: base,
    title: `Prism: ${input.description.slice(0, 120)}`,
    summary:
      `Prism authors this change on a NEW branch off ${base} and opens a pull ` +
      `request. Nothing lands on ${base} without your review. No history is ` +
      `rewritten and no force-push is ever performed (I7).`,
    actions: [
      { label: `Create branch prism/edit-${short} from ${base}`, irreversible: false, requiresConfirm: false },
      { label: 'Commit Prism-authored changes to the branch', irreversible: false, requiresConfirm: false },
      { label: `Open a pull request into ${base}`, irreversible: false, requiresConfirm: true },
      { label: 'Merge the pull request (only after your approval)', irreversible: true, requiresConfirm: true },
    ],
    forcePush: false,
  };
}
