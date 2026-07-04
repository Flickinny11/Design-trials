// PRISM SHELL — REAL ENGINE ADAPTER SLOT (SHELL W1, 2026-07-04)
//
// The engine session registers its contract adapter HERE when it merges: a
// factory returning a PrismEngineHost that mounts the real Three.js/WebGPU
// scene and speaks ONLY serialized prism-shell.ts envelopes (spec §10 S4
// "no internal reach"). Until then this export is null and
// resolveEngineHost() falls back to the stub even when
// NEXT_PUBLIC_PRISM_ENGINE=real is set (with a console warning).
//
// Shell waves must not implement this adapter themselves — translating
// contract envelopes into engine store calls is engine-side work (FP7: shell
// waves do not touch engine interior files, and an adapter written from the
// shell side would have to reach into engine internals to exist).

import type { PrismEngineHost } from './engine-host';

export const realEngineHostFactory: (() => PrismEngineHost) | null = null;
