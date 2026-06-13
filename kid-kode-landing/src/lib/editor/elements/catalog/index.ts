// Prebuilt element catalog barrel (§13, PREBUILT-LIBRARY-CONTRACT §2). One
// import registers the whole library — exactly like
// animatable/primitives/index.ts. Each definition self-registers via
// `registerElement` on import; the library browser + any AI authoring draw
// from the registry.
//
// Phase 1 ships two REFERENCE-QUALITY seeds (the templates Phase 2 copies):
//   • carousel-photoreal-ring — a PBR turntable carousel (6 cards, `spin`).
//   • hero-photoreal-monolith — an iridescent hero + MSDF headline
//     (`float` + `text-fade-up-each`).

import { registerElement } from '../registry';
import { carouselPhotorealRing } from './carousel-photoreal-ring';
import { heroPhotorealMonolith } from './hero-photoreal-monolith';

let registered = false;

/** Idempotent: register every catalog element. Safe to call repeatedly (HMR /
 *  repeated imports). The barrel auto-runs this on import below. */
export function registerAllElements(): void {
  if (registered) return;
  registerElement(carouselPhotorealRing);
  registerElement(heroPhotorealMonolith);
  registered = true;
}

registerAllElements();

export { carouselPhotorealRing, heroPhotorealMonolith };
