// PRISM SHELL — ENGINE FRAME ROUTE (SHELL W2 TASK 0, 2026-07-04)
//
// The document RealEngineHost iframes into the builder's preview pane
// (deviation W2-D1): the UNMODIFIED `/` page component — the certified
// ORRERY runtime with galaxy/canvas/preview-app as its internal mode states
// — composed with the shell-owned EngineFrameBridge that speaks the W0
// contract over postMessage. Nothing engine-interior is modified; this file
// is pure composition in a shell path.
//
// The route also stands alone (the frame header's open-in-new-tab lands
// here): with no embedding parent the bridge stays inert and the prototype
// simply runs full-viewport, exactly as at `/`.
//
// Session boundary: lives under /app/*, so the layout's Better Auth guard
// applies — the engine surface is tenant chrome, not a public route.

import PrototypeEditorPage from '@/app/page';
import EngineFrameBridge from '@/components/shell/engine-frame/EngineFrameBridge';

export const metadata = { title: 'Prism Engine — live prototype' };

export default function EngineFramePage() {
  return (
    <>
      <PrototypeEditorPage />
      <EngineFrameBridge />
    </>
  );
}
