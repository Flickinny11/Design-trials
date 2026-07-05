// PRISM NODE-EDITOR V2 — JSON Schema for PromptEditPlan (live structured output).
// Used by LiveOrchestrator to force the model's output to the contract shape.
// Kept deliberately permissive on step payloads (validated structurally by
// apply-plan's allowlist) but strict on the discriminator + envelope.
import 'server-only';

export const promptEditPlanJsonSchema = {
  type: 'object',
  required: ['id', 'summary', 'steps', 'libraryConsidered', 'origin'],
  properties: {
    id: { type: 'string' },
    summary: { type: 'string' },
    origin: { type: 'string', enum: ['stub', 'live'] },
    warnings: { type: 'array', items: { type: 'string' } },
    libraryConsidered: {
      type: 'object',
      required: ['designReferences', 'primitiveIds', 'elementIds', 'premiumFirst'],
      properties: {
        designReferences: { type: 'boolean' },
        primitiveIds: { type: 'array', items: { type: 'string' } },
        elementIds: { type: 'array', items: { type: 'string' } },
        premiumFirst: { type: 'boolean' },
      },
    },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kind'],
        properties: {
          kind: {
            type: 'string',
            enum: ['design', 'animation', 'collision', 'function', 'integration', 'schema', 'behavior', 'backend', 'new-artifact'],
          },
          nodeId: { type: 'string' },
          nodeIds: { type: 'array', items: { type: 'string' } },
          rationale: { type: 'string' },
          primitiveIds: { type: 'array', items: { type: 'string' } },
          platformId: { type: 'string' },
          platform: { type: 'string' },
          caption: { type: 'string' },
          // nodePatch / patches / functionTiles / fields are objects validated by apply-plan.
          nodePatch: { type: 'object', additionalProperties: true },
          patches: { type: 'object', additionalProperties: true },
          functionTiles: { type: 'array', items: { type: 'object', additionalProperties: true } },
          fields: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
      },
    },
  },
} as const;
