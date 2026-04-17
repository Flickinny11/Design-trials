'use client';

import * as THREE from 'three';

// Custom 3D icon system using ExtrudeGeometry from SVG-like shapes.
// All icons are 24-unit base size, authored to look good at tiny sizes too.
// Returns a Three.js Shape that can be extruded.

const ICONS: Record<string, (s: THREE.Shape) => void> = {
  home: (s) => {
    s.moveTo(12, 2);
    s.lineTo(22, 11);
    s.lineTo(20, 11);
    s.lineTo(20, 22);
    s.lineTo(14, 22);
    s.lineTo(14, 14);
    s.lineTo(10, 14);
    s.lineTo(10, 22);
    s.lineTo(4, 22);
    s.lineTo(4, 11);
    s.lineTo(2, 11);
    s.lineTo(12, 2);
  },
  chart: (s) => {
    // bar chart silhouette
    s.moveTo(3, 21);
    s.lineTo(8, 21);
    s.lineTo(8, 10);
    s.lineTo(3, 10);
    s.lineTo(3, 21);
    const hole1 = new THREE.Path();
    // skip holes for simplicity — extrude fills naturally
    s.moveTo(10, 21);
    s.lineTo(15, 21);
    s.lineTo(15, 4);
    s.lineTo(10, 4);
    s.lineTo(10, 21);
    s.moveTo(17, 21);
    s.lineTo(22, 21);
    s.lineTo(22, 14);
    s.lineTo(17, 14);
    s.lineTo(17, 21);
  },
  user: (s) => {
    // head (circle)
    const cx = 12, cy = 8, r = 4;
    const segs = 32;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    // shoulders arc
    s.moveTo(4, 21);
    s.bezierCurveTo(4, 15, 8, 14, 12, 14);
    s.bezierCurveTo(16, 14, 20, 15, 20, 21);
    s.lineTo(4, 21);
  },
  lock: (s) => {
    // shackle
    s.moveTo(7, 10);
    s.lineTo(7, 7);
    s.bezierCurveTo(7, 4, 9, 2, 12, 2);
    s.bezierCurveTo(15, 2, 17, 4, 17, 7);
    s.lineTo(17, 10);
    s.lineTo(15, 10);
    s.lineTo(15, 7);
    s.bezierCurveTo(15, 5.5, 13.5, 4, 12, 4);
    s.bezierCurveTo(10.5, 4, 9, 5.5, 9, 7);
    s.lineTo(9, 10);
    s.lineTo(7, 10);
    // body
    s.moveTo(5, 11);
    s.lineTo(19, 11);
    s.lineTo(19, 21);
    s.lineTo(5, 21);
    s.lineTo(5, 11);
  },
  eye: (s) => {
    // eye almond
    s.moveTo(2, 12);
    s.bezierCurveTo(5, 6, 9, 4, 12, 4);
    s.bezierCurveTo(15, 4, 19, 6, 22, 12);
    s.bezierCurveTo(19, 18, 15, 20, 12, 20);
    s.bezierCurveTo(9, 20, 5, 18, 2, 12);
    // pupil circle
    const cx = 12, cy = 12, r = 3;
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
  },
  code: (s) => {
    // < >
    s.moveTo(8, 4);
    s.lineTo(2, 12);
    s.lineTo(8, 20);
    s.lineTo(6, 20);
    s.lineTo(1, 13);
    s.lineTo(1, 11);
    s.lineTo(6, 4);
    s.lineTo(8, 4);
    s.moveTo(16, 4);
    s.lineTo(22, 12);
    s.lineTo(16, 20);
    s.lineTo(18, 20);
    s.lineTo(23, 13);
    s.lineTo(23, 11);
    s.lineTo(18, 4);
    s.lineTo(16, 4);
  },
  play: (s) => {
    s.moveTo(6, 4);
    s.lineTo(20, 12);
    s.lineTo(6, 20);
    s.lineTo(6, 4);
  },
  pause: (s) => {
    s.moveTo(6, 4);
    s.lineTo(10, 4);
    s.lineTo(10, 20);
    s.lineTo(6, 20);
    s.lineTo(6, 4);
    s.moveTo(14, 4);
    s.lineTo(18, 4);
    s.lineTo(18, 20);
    s.lineTo(14, 20);
    s.lineTo(14, 4);
  },
  search: (s) => {
    // magnifier circle
    const cx = 10, cy = 10, r = 6;
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    // inner circle (cutout not supported here; skip)
    // handle
    s.moveTo(15, 15);
    s.lineTo(21, 21);
    s.lineTo(22, 20);
    s.lineTo(16, 14);
    s.lineTo(15, 15);
  },
  snow: (s) => {
    // 6-point star
    const cx = 12, cy = 12, R = 9, r = 3.4;
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
  },
  close: (s) => {
    // X
    s.moveTo(5, 6);
    s.lineTo(7, 4);
    s.lineTo(12, 9);
    s.lineTo(17, 4);
    s.lineTo(19, 6);
    s.lineTo(14, 11);
    s.lineTo(19, 16);
    s.lineTo(17, 18);
    s.lineTo(12, 13);
    s.lineTo(7, 18);
    s.lineTo(5, 16);
    s.lineTo(10, 11);
    s.lineTo(5, 6);
  },
  chevron: (s) => {
    s.moveTo(9, 6);
    s.lineTo(15, 12);
    s.lineTo(9, 18);
    s.lineTo(7, 16);
    s.lineTo(11, 12);
    s.lineTo(7, 8);
    s.lineTo(9, 6);
  },
  sparkle: (s) => {
    // 4-point diamond star
    s.moveTo(12, 2);
    s.lineTo(14, 10);
    s.lineTo(22, 12);
    s.lineTo(14, 14);
    s.lineTo(12, 22);
    s.lineTo(10, 14);
    s.lineTo(2, 12);
    s.lineTo(10, 10);
    s.lineTo(12, 2);
  },
  refresh: (s) => {
    // arc arrow
    const cx = 12, cy = 12, R = 8;
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 1.6 - Math.PI / 2;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
    }
    // inner
    for (let i = 28; i >= 0; i--) {
      const a = (i / 28) * Math.PI * 1.6 - Math.PI / 2;
      const r = R - 2;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      s.lineTo(x, y);
    }
    // arrow tip
    s.moveTo(cx + R + 2, cy - 4);
    s.lineTo(cx + R - 2, cy);
    s.lineTo(cx + R + 4, cy + 1);
    s.lineTo(cx + R + 2, cy - 4);
  },
  save: (s) => {
    // floppy
    s.moveTo(4, 4);
    s.lineTo(17, 4);
    s.lineTo(20, 7);
    s.lineTo(20, 20);
    s.lineTo(4, 20);
    s.lineTo(4, 4);
  },
  link: (s) => {
    // chain-link approximation (two rounded segs)
    s.moveTo(5, 9);
    s.bezierCurveTo(5, 6, 7, 4, 10, 4);
    s.lineTo(12, 4);
    s.lineTo(12, 7);
    s.lineTo(10, 7);
    s.bezierCurveTo(8.3, 7, 8, 8, 8, 9);
    s.lineTo(8, 15);
    s.lineTo(5, 15);
    s.lineTo(5, 9);
    s.moveTo(16, 9);
    s.bezierCurveTo(16, 6, 14, 4, 12, 4);
    s.moveTo(19, 15);
    s.bezierCurveTo(19, 18, 17, 20, 14, 20);
    s.lineTo(12, 20);
    s.lineTo(12, 17);
    s.lineTo(14, 17);
    s.bezierCurveTo(15.7, 17, 16, 16, 16, 15);
    s.lineTo(16, 9);
    s.lineTo(19, 9);
    s.lineTo(19, 15);
  },
  server: (s) => {
    s.moveTo(3, 4); s.lineTo(21, 4); s.lineTo(21, 10); s.lineTo(3, 10); s.lineTo(3, 4);
    s.moveTo(3, 12); s.lineTo(21, 12); s.lineTo(21, 18); s.lineTo(3, 18); s.lineTo(3, 12);
  },
};

export type IconName = keyof typeof ICONS;

// Build an extruded 3D geometry from an icon shape.
export function makeIconGeometry(name: string, depth = 3, bevel = 0.6): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const builder = ICONS[name] || ICONS.sparkle;
  builder(shape);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.6,
    bevelSegments: 3,
    curveSegments: 20,
  });
  // Center & flip Y (SVG has Y-down)
  geom.center();
  geom.rotateX(Math.PI);
  return geom;
}

// Render icon as a flat SVG path string for DOM use (same vector data so DOM and 3D stay consistent).
export function iconPath(name: string): string {
  const shape = new THREE.Shape();
  const builder = ICONS[name] || ICONS.sparkle;
  builder(shape);
  const pts = shape.getPoints(64);
  if (!pts.length) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
  return d + ' Z';
}
