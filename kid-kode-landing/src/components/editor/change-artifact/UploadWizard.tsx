'use client';

// CANVAS-FINAL — Change Artifact UPLOAD wizard (canvas-spec §12.1, criterion 19).
// Bring your own media: image / 3D model (GLB/USDZ) / video / Rive. Images can
// be used flat OR mapped onto a shape (cube=6 / cone=2 / sphere=1 faces) via the
// ShapeFaceMapper, with modify-shape + per-face crop/scale/opacity. Use This
// installs the artifact on the node (and retains the prior one).

import { useRef, useState } from 'react';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { ChipKey, SectionLabel, WELL_BG, WELL_SHADOW } from '@/components/editor/animation-tools/ui';
import { uploadArtifactFile } from '@/lib/editor/media-gen-client';
import { applyArtifactSwap } from '@/lib/editor/apply-artifact';
import type { ArtifactPayload } from '@/lib/editor/artifact-library';
import {
  MESH_PRIMITIVE_DEFAULTS,
  type FaceTexture,
  type MeshPrimitiveKind,
  type PrismNode,
} from '@/lib/prism-graph/types';
import WizardWindow from './WizardWindow';
import Glb3DPreview from './Glb3DPreview';
import ShapeFaceMapper from './ShapeFaceMapper';
import type { AvailableImage, ShapeMapping } from './wizard-types';

type Mode = 'flat' | 'shape';

function defaultMapping(kind: MeshPrimitiveKind = 'cube'): ShapeMapping {
  return { kind, params: { ...MESH_PRIMITIVE_DEFAULTS[kind] }, faceTextures: [] };
}

export default function UploadWizard({ node, onClose, onBack }: { node: PrismNode; onClose: () => void; onBack?: () => void }) {
  const dropRef = useRef<HTMLInputElement | null>(null);
  const [images, setImages] = useState<AvailableImage[]>([]);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('flat');
  const [mapping, setMapping] = useState<ShapeMapping>(defaultMapping());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const name = node.intent?.caption?.split(' · ')[0] || node.subtype || 'element';

  const handleFiles = async (files: FileList | File[] | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of list) {
        const up = await uploadArtifactFile(file);
        if (up.kind === '3d' || up.kind === 'rive') setModelUrl(up.url);
        else if (up.kind === 'video') setVideoUrl(up.url);
        else setImages((prev) => [...prev, { url: up.url, label: file.name }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That file could not be uploaded.');
    } finally {
      setBusy(false);
    }
  };

  const hasImage = images.length > 0;
  const ready = hasImage || !!modelUrl || !!videoUrl;

  const useThis = () => {
    let payload: ArtifactPayload | null = null;
    if (modelUrl) {
      payload = { kind: 'mesh-glb', source: 'upload', meshUrl: modelUrl, label: `${name} · 3D model` };
    } else if (videoUrl) {
      payload = { kind: 'video', source: 'upload', videoUrl, posterUrl: images[0]?.url, label: `${name} · video` };
    } else if (hasImage && mode === 'shape') {
      payload = {
        kind: 'mesh-primitive',
        source: 'upload',
        meshPrimitive: { kind: mapping.kind, params: mapping.params },
        faceTextures: mapping.faceTextures,
        label: `${name} · shape`,
        thumbnailUrl: images[0]?.url,
      };
    } else if (hasImage) {
      payload = { kind: 'image', source: 'upload', imageUrl: images[0].url, label: `${name} · image` };
    }
    if (payload) {
      applyArtifactSwap(node.nodeId, payload);
      onClose();
    }
  };

  const footer = (
    <>
      <button type="button" data-role="upload-use-this" onClick={useThis} disabled={!ready} className="ds-btn ds-btn--primary ds-press" style={ready ? undefined : { opacity: 0.45, cursor: 'not-allowed' }}>
        Use this
      </button>
    </>
  );

  return (
    <WizardWindow title="Upload an artifact" kicker="BRING YOUR OWN MEDIA" onClose={onClose} onBack={onBack} footer={footer} width={760}>
      <div className="flex flex-col gap-4" data-component="upload-wizard">
        {/* Drop zone */}
        <div
          data-control="upload-drop"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void handleFiles(e.dataTransfer?.files ?? null);
          }}
          className="flex flex-col items-center gap-2 px-4 py-6 rounded-ds-sm transition-all"
          style={{
            background: WELL_BG,
            boxShadow: dragOver ? `${WELL_SHADOW}, inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.55)}` : WELL_SHADOW,
            border: `1px dashed ${dragOver ? dsAlpha(DS_ACCENT, 0.7) : dsAlpha(DS_ACCENT, 0.2)}`,
          }}
        >
          <Icon name="image" size={20} color={dragOver ? DS.metal200 : DS.textMid} glow={dragOver} />
          <span className="text-[10px] font-mono text-center" style={{ color: 'var(--ds-text-mid)' }}>
            {busy ? 'Uploading…' : 'Drop a picture, 3D model, video, or Rive file here'}
          </span>
          <button type="button" onClick={() => dropRef.current?.click()} className="ds-btn ds-btn--quiet ds-press" disabled={busy}>
            Browse files
          </button>
          <input
            ref={dropRef}
            type="file"
            accept="image/*,.glb,.usdz,.usd,video/*,.riv,model/gltf-binary"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>

        {/* 3D model uploaded → interactive preview */}
        {modelUrl && (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Your 3D model</SectionLabel>
            <Glb3DPreview url={modelUrl} height={280} />
          </div>
        )}

        {/* Video uploaded → preview */}
        {videoUrl && !modelUrl && (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Your video</SectionLabel>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video src={videoUrl} controls autoPlay loop muted playsInline className="w-full rounded-ds-sm" style={{ maxHeight: 300, background: WELL_BG }} />
          </div>
        )}

        {/* Images uploaded → flat or shape */}
        {hasImage && !modelUrl && !videoUrl && (
          <>
            <div className="flex items-center gap-1.5" data-control="upload-mode">
              <ChipKey label="Flat picture" active={mode === 'flat'} onClick={() => setMode('flat')} testId="upload-mode-flat" />
              <ChipKey label="Map onto a shape" active={mode === 'shape'} onClick={() => setMode('shape')} testId="upload-mode-shape" />
            </div>

            {mode === 'flat' ? (
              <div className="flex flex-col gap-1.5">
                <SectionLabel>Your picture</SectionLabel>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[0].url} alt="Uploaded" className="w-full rounded-ds-sm object-contain" style={{ maxHeight: 300, background: WELL_BG }} />
              </div>
            ) : (
              <ShapeFaceMapper value={mapping} images={images} onChange={setMapping} />
            )}
          </>
        )}

        {error && (
          <div className="px-2.5 py-2 rounded-ds-sm flex items-start gap-2" data-control="upload-error" style={{ background: dsAlpha(DS.ice400, 0.1), boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice400, 0.28)}` }}>
            <Icon name="sparkle" size={12} color={DS.ice300} />
            <span className="text-[9.5px] font-mono leading-relaxed" style={{ color: 'var(--ds-text)' }}>{error}</span>
          </div>
        )}
      </div>
    </WizardWindow>
  );
}
