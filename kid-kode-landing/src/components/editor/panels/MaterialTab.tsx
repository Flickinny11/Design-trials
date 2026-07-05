'use client';

// EDITOR-EXP C9 — the Material editor was extracted to
// `shared-editors/MaterialEditor.tsx` so BOTH the node-editor Inspector and
// the CanvasToolbar object flyout (ObjectFlyout) mount the SAME editor inline
// (architecture-inversion fix: the canvas no longer delegates material editing
// back to the Inspector via `openInspector('material')`).
//
// This file is the node-editor's mount point. It is a thin re-export shim so
// the historical `panels/MaterialTab` import path (sole importer = Inspector)
// keeps working; the real component lives in
// `@/components/editor/shared-editors/MaterialEditor`. The write contract
// (FP-15: route through usePreviewStateStore, never useGraphSourceStore
// .updateNode) lives in the shared component.
export { default } from '@/components/editor/shared-editors/MaterialEditor';
