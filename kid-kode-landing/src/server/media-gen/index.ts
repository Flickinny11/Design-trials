import 'server-only';

// CANVAS-FINAL — Prism Media Generator: public server entry point.
//
// One place the routes import from. `getProvider` prefers a user's BYOK
// provider when one resolves (stub today) and otherwise returns the default
// fal backing provider. The provider IDENTITY is internal — routes return only
// Prism-branded catalog ids + credit costs to the client (never "fal").

import { falProvider } from './fal-provider';
import { resolveUserProvider, type ProviderContext } from './byok';
import type { MediaProvider } from './types';

export function getProvider(ctx: ProviderContext = {}): MediaProvider {
  return resolveUserProvider(ctx) ?? falProvider;
}

export { publicCatalog, publicModel, getModel, modelForKind } from './catalog';
export {
  guardBudget,
  recordGeneration,
  getCreditMeter,
  buildSpendUsd,
  BudgetExceededError,
} from './credits';
export type {
  MediaProvider,
  MediaKind,
  GenQuality,
  GenImageInput,
  GenImageOutput,
  GenEditInput,
  Gen3DInput,
  Gen3DOutput,
  GenVideoInput,
  GenVideoOutput,
  GenCodeInput,
  GenCodeOutput,
  ArtifactComposeSpec,
  CreditLedgerEntry,
} from './types';
export type { PrismModel, PrismModelPublic } from './catalog';
