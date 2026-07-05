CHAIN-STOP was intentionally active on 2026-06-30.

It was released after the user explicitly asked Codex to keep the Prism recovery
work moving while away from the desk.

Prior state:

- original contaminated workspace spec quarantined;
- guarded replacement spec written at the live path;
- W3/W4/W5 prompts re-authored for the root editor path;
- direct W3/W4/W5 launch preflight hardened in `run-surface.sh`.

The active chain still must pass:

- `spec-intent-check.mjs` for each prompt and guarded spec;
- `prism-autonomy-preflight.mjs`;
- phase-specific verification;
- `prism:recovery-gate` before any phase is marked complete.
