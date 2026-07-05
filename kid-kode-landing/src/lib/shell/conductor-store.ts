'use client';

// PRISM SHELL — CONDUCTOR STORE (SHELL W5, 2026-07-04)
//
// Client state for the builder's build/ship surfaces: the current build
// status + verify latch, the deploy records + live target descriptors, and the
// in-flight build flag. One store per concern (I3). The build EVIDENCE streams
// into the chat store (E4); THIS store holds the settled build/ship state the
// preview frame, "Verified shippable" badge, and Ship panel read.

import { create } from 'zustand';
import type {
  ConductorStatus,
  DeployRecord,
  DeployTargetDescriptor,
} from '../../../packages/shared-interfaces/src/prism-conductor';

interface ConductorState {
  status: ConductorStatus | null;
  deploys: DeployRecord[];
  targets: DeployTargetDescriptor[];
  isBuilding: boolean;
  buildError: string | null;

  setStatus: (status: ConductorStatus | null) => void;
  setDeploys: (deploys: DeployRecord[]) => void;
  setTargets: (targets: DeployTargetDescriptor[]) => void;
  setBuilding: (isBuilding: boolean) => void;
  setBuildError: (message: string | null) => void;
  reset: () => void;
}

export const useConductorStore = create<ConductorState>((set) => ({
  status: null,
  deploys: [],
  targets: [],
  isBuilding: false,
  buildError: null,

  setStatus: (status) => set({ status }),
  setDeploys: (deploys) => set({ deploys }),
  setTargets: (targets) => set({ targets }),
  setBuilding: (isBuilding) => set({ isBuilding }),
  setBuildError: (buildError) => set({ buildError }),
  reset: () => set({ status: null, deploys: [], targets: [], isBuilding: false, buildError: null }),
}));

/** The latest verified-shippable deploy's shareable preview URL, if any. */
export function selectPreviewUrl(s: ConductorState): string | null {
  const latest = s.deploys[s.deploys.length - 1];
  return latest?.previewUrl ?? null;
}
