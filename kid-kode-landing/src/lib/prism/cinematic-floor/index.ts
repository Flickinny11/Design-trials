// CINEMATIC-FLOOR — the R1 realism floor library (W-PHOTO D4).
//
// Reusable pieces that make realtime PBR read cinematic rather than digital,
// split per DEV-2:
//   • NODE-LOCAL (consumed by mock-app content / atelier factory, D6):
//       makeImperfectionMap / applyImperfection  — dust/scratch/smudge breakup
//       makeContactShadow                         — soft grounded contact shadow
//       buildStudioIBL / installStudioIBL         — PMREM studio environment
//   • FULL-FRAME POST (owned canvases only): CinematicFloorPost
//       (src/components/photo/CinematicFloorPost.tsx) — bloom · DOF · grain ·
//       vignette · colour grade, three r184 node PostProcessing.
//
// Registered as catalog primitives (contact-shadow, imperfection-veil) and
// documented in docs/prism/DESIGN-REFERENCES.md ("Prism cinematic floor", DEV-1).

export {
  makeImperfectionMap,
  makeImperfectionOverlay,
  applyImperfection,
  type ImperfectionOptions,
} from "./imperfection";
export {
  makeContactShadow,
  type ContactShadow,
  type ContactShadowOptions,
} from "./contact-shadow";
export { buildStudioIBL, installStudioIBL, type IBLHandle } from "./ibl";
