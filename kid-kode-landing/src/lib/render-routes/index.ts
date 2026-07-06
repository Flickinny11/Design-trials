// RENDER-ROUTES — public API (W-PHOTO D1).
//
// Conductor / prompt-to-node import from here:
//   import { planRoute, deriveInputsFromIntent, routeToRealization } from '@/lib/render-routes';
//
//   const inputs = deriveInputsFromIntent({ text: brief.heroDescription });
//   const decision = planRoute(inputs);          // → { route, rationale, fallback, ... }
//   const build = routeToRealization(decision.route); // → { renderMode, assetSlots, ... }
//
// See ROUTE-PLANNER.md (this directory) for the decision table.

export * from "./types";
export { planRoute, scoreRoutes } from "./planner";
export {
  routeToRealization,
  deriveInputsFromIntent,
  type IntentSignals,
} from "./realization";
