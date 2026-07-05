'use client';

// PRISM SHELL — CONDUCTOR PREVIEW (SHELL W5, 2026-07-04)
//
// The built tenant app, running in the Prism runtime, INSIDE the builder
// preview frame. Loads the Conductor-authored graph for this project and
// mounts it via ConductorRuntime (mountFromGraphSource). Shown by PreviewRegion
// ONLY when the project is built — replacing the certified engine-frame so
// there is one visible three/webgpu scene at a time (W5-D3 / FP-R1).

import { useCallback, useEffect, useRef, useState } from 'react';
import ConductorRuntime from '@/components/prism-player/ConductorRuntime';
import { getGraph } from '@/lib/shell/tenancy-client';
import type { GraphSource } from '@/lib/prism-graph/types';

export default function ConductorPreview({
  projectId,
  refreshKey,
}: {
  projectId: string;
  /** Bump to force a re-fetch (e.g. after a build/rollback completes). */
  refreshKey?: number;
}) {
  const [graph, setGraph] = useState<GraphSource | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const reqRef = useRef(0);

  const load = useCallback(async () => {
    const req = ++reqRef.current;
    setState('loading');
    try {
      const raw = await getGraph(projectId);
      if (req !== reqRef.current) return;
      const nodes = (raw as { nodes?: unknown[] } | null)?.nodes;
      if (raw && Array.isArray(nodes) && nodes.length > 0) {
        setGraph(raw as unknown as GraphSource);
        setState('ready');
      } else {
        setGraph(null);
        setState('empty');
      }
    } catch {
      if (req === reqRef.current) setState('error');
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (state === 'ready' && graph) {
    return <ConductorRuntime graph={graph} key={`${projectId}-${refreshKey ?? 0}`} />;
  }
  return (
    <div className="bw2-conductor-state" role="status" data-state={state}>
      <span className="bw2-plan-pending-bead" aria-hidden />
      <span className="bw2-plan-pending-text">
        {state === 'loading'
          ? 'Loading the built app…'
          : state === 'empty'
            ? 'This build has no graph yet.'
            : 'Could not load the built app.'}
      </span>
    </div>
  );
}
