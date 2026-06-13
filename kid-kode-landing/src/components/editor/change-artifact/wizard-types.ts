'use client';

// CANVAS-FINAL — Change Artifact wizard: shared prop contracts for the leaf
// components (Glb3DPreview, ShapeFaceMapper, ModelPicker, ArtifactLibraryPanel).
// These are FIXED interfaces — each leaf component is built independently
// against this file; the wizard windows assemble them.

import type {
  ArtifactLibraryEntry,
  FaceTexture,
  MeshPrimitiveKind,
} from '@/lib/prism-graph/types';
import type { MediaKind, PrismModelPublic } from '@/lib/editor/media-gen-client';

/** An image the user can drag onto a face slot (uploaded or generated). */
export interface AvailableImage {
  url: string;
  label?: string;
}

/** The shape + per-face assignment the ShapeFaceMapper edits. `params` mirrors
 *  MeshPrimitive['params'] (width/height/depth/radius/tube/length/segments). */
export interface ShapeMapping {
  kind: MeshPrimitiveKind;
  params: Record<string, number>;
  faceTextures: FaceTexture[];
}

// ── Glb3DPreview (interactive 3D result viewport, criterion 20) ──────────────
export interface Glb3DPreviewProps {
  /** Persisted .glb URL. */
  url: string;
  /** Optional poster image shown while the model loads. */
  poster?: string;
  /** Pixel height of the viewport (defaults applied by the component). */
  height?: number;
  /** Auto-spin the model (default true) until the user drags. */
  autoRotate?: boolean;
  className?: string;
}

// ── ShapeFaceMapper (§12.1 upload-to-shape + per-face mapping) ───────────────
export interface ShapeFaceMapperProps {
  /** Current shape + face assignment. */
  value: ShapeMapping;
  /** Images available to drag onto faces (uploaded in the wizard). */
  images: AvailableImage[];
  /** Called with the full next mapping on any edit (shape, dims, faces, crop). */
  onChange: (next: ShapeMapping) => void;
}

// ── ModelPicker (Prism-branded model + quality picker) ───────────────────────
export interface ModelPickerProps {
  /** The catalog (already filtered to the relevant kind by the caller). */
  models: PrismModelPublic[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** The media kind this picker is choosing within (for the header copy). */
  kind: MediaKind;
}

// ── ArtifactLibraryPanel (prior-artifact retention + restore) ────────────────
export interface ArtifactLibraryPanelProps {
  entries: ArtifactLibraryEntry[];
  /** Label of the node's CURRENT (active) artifact, shown as the live tile. */
  activeLabel?: string;
  /** Restore a prior artifact (the then-current one is retained in turn). */
  onRestore: (entry: ArtifactLibraryEntry) => void;
}
