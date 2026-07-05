'use client';

import { useState, type PointerEvent } from 'react';
import {
  LiquidGlassToolbar,
  type LiquidToolGroup,
} from '@/components/editor/overlays/liquid-toolbar';

const GROUPS: LiquidToolGroup[] = [
  { id: 'transform', icon: 'move', label: 'Transform', wired: true },
  { id: 'selection', icon: 'group', label: 'Selection', wired: true },
  { id: 'add', icon: 'plus', label: 'Add', wired: true },
  { id: 'library', icon: 'layers', label: 'Elements', wired: true },
  { id: 'image', icon: 'image', label: 'Image', wired: true },
  { id: 'object3d', icon: 'cube', label: '3D Object', wired: true },
  { id: 'background', icon: 'palette', label: 'Background', wired: true },
  { id: 'changeArtifact', icon: 'sparkle', label: 'Change Artifact', wired: true },
  { id: 'promptEdit', icon: 'code', label: 'Prompt Edit', wired: true },
  { id: 'text', icon: 'text', label: 'Text', wired: true },
  { id: 'animation', icon: 'wand', label: 'Animation', wired: true },
  { id: 'function', icon: 'link', label: 'Function', wired: true },
  { id: 'lighting', icon: 'bulb', label: 'Lighting', wired: true },
  { id: 'build', icon: 'hammer', label: 'Build', wired: true },
];

const noopPointer = (_event: PointerEvent) => {};

export default function ToolbarGlassPage() {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <main
      data-route="toolbar-glass-lab"
      style={{
        minHeight: '100vh',
        overflow: 'hidden',
        background:
          'radial-gradient(ellipse 72% 62% at 22% 18%, rgba(96, 178, 255, 0.14), transparent 58%), radial-gradient(ellipse 58% 52% at 78% 78%, rgba(255, 190, 108, 0.12), transparent 60%), #05070d',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 32,
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        <LiquidGlassToolbar
          groups={GROUPS}
          activeGroup={activeGroup}
          onToggleGroup={(id) => setActiveGroup((cur) => (cur === id ? null : id))}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          dragging={false}
          spineHandlers={{
            onPointerDown: noopPointer,
            onPointerMove: noopPointer,
            onPointerUp: noopPointer,
            onPointerCancel: noopPointer,
          }}
        />
      </div>
    </main>
  );
}
