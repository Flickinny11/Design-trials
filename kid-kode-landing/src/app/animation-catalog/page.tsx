'use client';

// /animation-catalog — the Animation Primitive Catalog picker surface used to
// verify the Animatable contract pilot. Client-only (WebGPU / R3F): the gallery
// is dynamically imported with ssr:false so three/webgpu never runs on the
// server.

import dynamic from 'next/dynamic';

const CatalogGallery = dynamic(
  () => import('@/components/editor/animation-catalog/CatalogGallery'),
  { ssr: false, loading: () => <div style={{ color: '#fff', padding: 24 }}>Loading catalog…</div> },
);

export default function AnimationCatalogPage() {
  return <CatalogGallery />;
}
