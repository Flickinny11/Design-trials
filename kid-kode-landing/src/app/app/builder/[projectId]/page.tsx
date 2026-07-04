// PRISM SHELL — BUILDER ROUTE (SHELL W1, spec §12 W1 / §1 S4)
//
// /app/builder/[projectId] — the three-region builder shell. Everything on
// this route is React/DOM shell work plus the bounded 3D control islands
// DL11/DL12 demand; the engine interior mounts through the W0 contract only
// (stub host in W1 — real adapter behind NEXT_PUBLIC_PRISM_ENGINE=real once
// the engine session merges). The canvas editor at `/` is untouched.

import '@/components/shell/design/prism-premium.css';
import './builder.css';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import BuilderShell from '@/components/shell/builder/BuilderShell';
import { projectNameFromId } from '@/lib/shell/project-stub';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return { title: `${projectNameFromId(projectId)} — Prism Builder` };
}

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <div className={`bw1-viewport ${shellDisplay.variable} ${shellMono.variable}`}>
      <BuilderShell projectId={projectId} />
    </div>
  );
}
