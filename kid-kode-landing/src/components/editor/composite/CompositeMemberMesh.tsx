'use client';

// CompositeMemberMesh — the REALIZED (canvas) form of ONE composite member node
// (pane / cube). Geometry is generated from the member's params (reusing the P-1
// parametric builders) and the surface is the founder-approved glass / worn-alloy
// material. Each rendered member is TAGGED (userData.prismCompositeMember +
// prismNodeId) so the subgraph authorship probe can prove every rendered piece has
// a backing node (spec §0 / INV-0.5) by traversing the live scene.
//
// A member carries a caption label (MSDF, WebGPU-safe) for tabs / title / links.
// Clicking any member selects the parent COMPOSITE (opens the binding Inspector).

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { WornMaps } from '@/components/editor/chassis/materials';
import { buildCubeGeometry, buildPaneGeometry } from '@/components/editor/primitive/primitive-geometry';
import { CompositeText } from './CompositeText';
import { buildMemberMaterial } from './composite-materials';
import { useCompositeStore } from './use-composite-store';
import type { CompositeMember } from './composite-schema';

const LABELLED_ROLES = new Set(['nav-title', 'nav-tab', 'nav-menu-item', 'footer-link', 'card-title', 'card-cta']);

function buildGeometry(m: CompositeMember): THREE.BufferGeometry {
  const params = { width: m.width, height: m.height, depth: m.depth, cornerRadius: m.cornerRadius, bevel: 0.04, radius: 0, segments: 18, cutouts: [] };
  if (m.kind === 'cube') return buildCubeGeometry(params);
  return buildPaneGeometry(params);
}

export interface CompositeMemberMeshProps {
  member: CompositeMember;
  compositeId: string;
  maps: Record<string, WornMaps>;
  selected: boolean;
  onSelect: (compositeId: string) => void;
  /** local-relative override (DropdownNode re-nests menu items into its group). */
  positionOverride?: [number, number, number];
  /** hover-lift affordance for interactive members (tabs / links / cta). */
  interactive?: boolean;
}

export function CompositeMemberMesh({
  member,
  compositeId,
  maps,
  selected,
  onSelect,
  positionOverride,
  interactive,
}: CompositeMemberMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const hover = useRef(false);
  // CONNECT mode: this member is pickable as a graph-edge endpoint; light up when it
  // is the armed (first-picked) node.
  const picked = useCompositeStore((s) => s.pendingConnectFrom === member.memberId);

  const geometry = useMemo(() => buildGeometry(member), [member.kind, member.width, member.height, member.depth, member.cornerRadius]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(() => buildMemberMaterial(member.material, maps), [member.material, maps]);
  useEffect(() => () => material.dispose(), [material]);

  const labelMat = member.material.startsWith('worn') ? 'worn' : 'glass';

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    g.userData.prismCompositeMember = true;
    g.userData.prismNodeId = member.memberId;
    g.userData.prismRole = member.role;
    g.userData.prismCompositeId = compositeId;
    g.userData.prismDormant = false;
  }, [member.memberId, member.role, compositeId]);

  // hover lift toward the camera (z) — a gentle "this is interactive" tell.
  useFrame(() => {
    const g = groupRef.current;
    if (!g || !interactive) return;
    const targetZ = (positionOverride ? positionOverride[2] : member.local.z) + (hover.current ? 0.12 : 0);
    g.position.z += (targetZ - g.position.z) * 0.2;
  });

  const pos: [number, number, number] = positionOverride ?? [member.local.x, member.local.y, member.local.z];

  return (
    <group ref={groupRef} position={pos}>
      <mesh
        geometry={geometry}
        material={material}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          // CONNECT mode → pick this node as a graph-edge endpoint (spec §6.2);
          // otherwise select the parent composite (open the Inspector).
          if (useCompositeStore.getState().editorMode === 'connect') useCompositeStore.getState().pickConnectNode(member.memberId);
          else onSelect(compositeId);
        }}
        onPointerOver={(e) => { e.stopPropagation(); hover.current = true; const connecting = useCompositeStore.getState().editorMode === 'connect'; if (interactive || connecting) document.body.style.cursor = connecting ? 'crosshair' : 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); hover.current = false; document.body.style.cursor = ''; }}
      />
      {picked && <PickRing width={member.width} height={member.height} />}
      {LABELLED_ROLES.has(member.role) && (
        <CompositeText
          position={[0, 0, member.depth / 2 + 0.03]}
          fontSize={member.role === 'nav-title' ? 0.26 : 0.18}
          letterSpacing={0.04}
          variant={labelMat === 'worn' ? 'bright' : 'engraved'}
        >
          {member.caption}
        </CompositeText>
      )}
      {selected && <SelectionEdge width={member.width} height={member.height} depth={member.depth} />}
    </group>
  );
}

// CONNECT pick highlight — a bright ring around the armed endpoint node.
const PICK_MAT = new THREE.MeshBasicMaterial({ color: '#9fe9ff', toneMapped: false, transparent: true, opacity: 0.95 });
function PickRing({ width, height }: { width: number; height: number }) {
  const r = Math.max(width, height) * 0.62;
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => { if (ref.current) ref.current.scale.setScalar(1 + 0.06 * Math.sin(state.clock.elapsedTime * 5)); });
  return (
    <mesh ref={ref} position={[0, 0, 0.22]} material={PICK_MAT}>
      <torusGeometry args={[r, 0.03, 8, 40]} />
    </mesh>
  );
}

const EDGE_MAT = new THREE.LineBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.9, toneMapped: false });
function SelectionEdge({ width, height, depth }: { width: number; height: number; depth: number }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(width + 0.06, height + 0.06, depth + 0.06), 1), [width, height, depth]);
  useEffect(() => () => edges.dispose(), [edges]);
  return <lineSegments geometry={edges} material={EDGE_MAT} renderOrder={6} />;
}
