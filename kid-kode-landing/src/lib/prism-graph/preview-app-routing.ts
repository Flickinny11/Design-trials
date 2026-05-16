// preview-app-routing.ts — STUB (EB-10-02 step 6).
//
// Public surface only so the failing tests can type-check + collect under
// vitest. Bodies return placeholder values so the SC-054 contract tests
// remain RED until the real implementation lands in step 7.

import type { CompiledAppView } from './compile-app';

export const PREVIEW_APP_HASH_PREFIX = '';

export function serializePreviewAppHash(_hubId: string): string {
  return '';
}

export function parsePreviewAppHash(
  _hash: string,
  _compiled: CompiledAppView,
): string | null {
  return null;
}

export function resolveActiveHubId(
  _hash: string,
  _compiled: CompiledAppView,
): string | null {
  return null;
}

export function getNextHubId(
  _compiled: CompiledAppView,
  _currentHubId: string,
): string | null {
  return null;
}

export function getPrevHubId(
  _compiled: CompiledAppView,
  _currentHubId: string,
): string | null {
  return null;
}
