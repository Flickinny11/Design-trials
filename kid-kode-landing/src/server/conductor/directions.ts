// PRISM SHELL — CONDUCTOR DIRECTION RESOLUTION (SHELL W5, 2026-07-04)
//
// Server-side re-resolution of the chosen Direction Board (§11.3 conformance).
// The approved Build Brief carries `chosenDirectionId` + a folded
// `brandProfile.palette`; the full board TOKENS (surface tone, materialFamily,
// motion character, type classification) are the design authority the
// Conductor must author TO so the built app demonstrably matches the board a
// generic build would ignore (a MUST-FIX per §11.3).
//
// This table MIRRORS the five boards in
// src/lib/shell/intake/intake-model.ts (DIRECTION_BOARDS). It is duplicated
// here deliberately (W5-D1): intake-model is a client-surface module; the
// Conductor runs server-side and must not pull client code. The ids +
// materialFamily are the shared contract — kept in sync by review; a brief
// with an unknown id falls back to the brand palette so a new board never
// breaks a build.

import type { BuildBrief } from '../../../packages/shared-interfaces/src/prism-intake';
import type { MaterialSpec } from '../../lib/prism-graph/types';
import type { CinematicPrimitiveName } from '../../lib/prism-graph/cinematic-primitives';

/** The design intent a resolved direction hands the node factory. */
export interface ResolvedDirection {
  id: string | null;
  name: string;
  /** Full four-tone palette (surface = darkest base; primary/secondary/accent). */
  palette: {
    primary: string;
    secondary: string;
    accent: string;
    surface: string;
  };
  materialFamily: string;
  /** Display + text type classification (drives MSDF weight/emphasis choices). */
  typeDisplay: string;
  typeText: string;
  /** Motion character — seeds the node cinematic-primitive selection. */
  motion: string;
  tone: string[];
}

interface BoardEntry extends Omit<ResolvedDirection, 'id'> {
  id: string;
}

// Mirror of DIRECTION_BOARDS (intake-model.ts) — see header.
const BOARDS: readonly BoardEntry[] = [
  {
    id: 'atelier-noir',
    name: 'Atelier Noir',
    palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38', surface: '#0b0b10' },
    materialFamily: 'machined-metal',
    typeDisplay: 'serif',
    typeText: 'mono',
    motion: 'weighted settle',
    tone: ['precise', 'luxury', 'technical'],
  },
  {
    id: 'carrara',
    name: 'Carrara',
    palette: { primary: '#efe9df', secondary: '#b08d4c', accent: '#7d0f18', surface: '#d8d0c2' },
    materialFamily: 'marble-brass',
    typeDisplay: 'serif',
    typeText: 'humanist',
    motion: 'slow drift',
    tone: ['editorial', 'refined', 'timeless'],
  },
  {
    id: 'foundry',
    name: 'Foundry',
    palette: { primary: '#c67b4a', secondary: '#2a2724', accent: '#ff5a55', surface: '#1a1613' },
    materialFamily: 'copper-stone',
    typeDisplay: 'slab',
    typeText: 'mono',
    motion: 'heavy torque',
    tone: ['bold', 'industrial', 'grounded'],
  },
  {
    id: 'aurora-glass',
    name: 'Aurora Glass',
    palette: { primary: '#3a5c86', secondary: '#cfe4ff', accent: '#ff2a38', surface: '#06080d' },
    materialFamily: 'glass-sapphire',
    typeDisplay: 'geometric',
    typeText: 'geometric',
    motion: 'drifting refraction',
    tone: ['ethereal', 'calm', 'futuristic'],
  },
  {
    id: 'walnut-studio',
    name: 'Walnut Studio',
    palette: { primary: '#5a3b26', secondary: '#c9a15a', accent: '#b5472f', surface: '#2a1c12' },
    materialFamily: 'walnut-brass',
    typeDisplay: 'serif',
    typeText: 'humanist',
    motion: 'gentle sway',
    tone: ['warm', 'crafted', 'human'],
  },
];

const BY_ID = new Map(BOARDS.map((b) => [b.id, b]));

/** Resolve the design authority for a build. Prefers the chosen board's full
 *  tokens; falls back to the brief's brand palette (with sane neutrals) so an
 *  unknown / absent direction still produces a coherent, conformant build. */
export function resolveDirection(brief: BuildBrief): ResolvedDirection {
  const board = brief.chosenDirectionId ? BY_ID.get(brief.chosenDirectionId) : undefined;
  if (board) return { ...board };

  const p = brief.brandProfile.palette;
  const primary = p.primary;
  const secondary = p.secondary ?? '#e8ecf2';
  const accent = p.accent ?? '#ff2a38';
  // Darkest neutral is the surface; fall back to a deep near-black.
  const surface = p.neutrals && p.neutrals.length > 0 ? p.neutrals[0] : '#0b0b10';
  return {
    id: brief.chosenDirectionId,
    name: brief.brandProfile.name || 'Custom Direction',
    palette: { primary, secondary, accent, surface },
    materialFamily: 'machined-metal',
    typeDisplay: brief.brandProfile.typePrefs?.display?.classification ?? 'serif',
    typeText: brief.brandProfile.typePrefs?.text?.classification ?? 'mono',
    motion: 'weighted settle',
    tone: brief.brandProfile.toneDescriptors.slice(0, 4),
  };
}

/** Map a material family to concrete PBR params so a `mesh`+`meshPrimitive`
 *  node wears the board's material identity (machined metal reflects, marble
 *  is matte-bright, glass refracts). `baseColor` is caller-supplied (a palette
 *  tone). A modest `emissive` (the tone itself) guarantees the shape reads
 *  against the board's dark surface even before the studio IBL settles — so a
 *  metallic object is a glowing tinted metal, not a black silhouette. */
export function materialForFamily(family: string, baseColor: string): MaterialSpec {
  const glow = { emissive: baseColor, emissiveIntensity: 0.22 };
  switch (family) {
    case 'machined-metal':
      return { baseColor, metalness: 0.85, roughness: 0.28, clearcoat: 0.3, envMapIntensity: 1.2, ...glow };
    case 'marble-brass':
      return { baseColor, metalness: 0.15, roughness: 0.32, clearcoat: 0.5, clearcoatRoughness: 0.2, ...glow };
    case 'copper-stone':
      return { baseColor, metalness: 0.8, roughness: 0.42, envMapIntensity: 1.1, ...glow };
    case 'glass-sapphire':
      return {
        baseColor,
        metalness: 0.05,
        roughness: 0.06,
        transmission: 0.82,
        ior: 1.7,
        thickness: 0.6,
        clearcoat: 1,
        iridescence: 0.25,
        emissive: baseColor,
        emissiveIntensity: 0.16,
      };
    case 'walnut-brass':
      return { baseColor, metalness: 0.35, roughness: 0.55, clearcoat: 0.4, ...glow };
    default:
      return { baseColor, metalness: 0.4, roughness: 0.4, ...glow };
  }
}

/** The cinematic primitive whose motion best expresses a board's motion
 *  character — one primitive per node (§7 L203: every node ships with ≥1
 *  unless explicitly primitive-free). Names are from the fixed 9-primitive
 *  library. */
export function primitiveForMotion(motion: string): CinematicPrimitiveName {
  const m = motion.toLowerCase();
  // `depth-rotate` spins the object IN PLACE (no positional drift), so a hero
  // or card stays where it was authored — the right idiom for landing content.
  // `parallax-scroll` for boards whose motion reads as gentle drift/sway.
  if (m.includes('sway') || m.includes('drift')) return 'parallax-scroll';
  return 'depth-rotate';
}
