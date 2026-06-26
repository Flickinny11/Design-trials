'use client';

// ClickCatcher — an invisible, raycastable plane that sits just behind a glass
// panel's controls and SWALLOWS clicks (stopPropagation, no-op). Without it, a
// click on the transmissive glass (raycast:null) or a near-miss of a small control
// falls THROUGH to the backdrop, whose click handler deselects — so the Inspector
// would close every time a user clicks the panel background. The catcher makes a
// glass panel feel solid: only a click on truly empty space deselects.

import { type ThreeEvent } from '@react-three/fiber';

export function ClickCatcher({
  width,
  height,
  position = [0, 0, 0],
}: {
  width: number;
  height: number;
  position?: [number, number, number];
}) {
  return (
    <mesh position={position} onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
