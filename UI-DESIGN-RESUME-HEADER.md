# RESUME MODE — continuation of an interrupted run (read this FIRST, then the full original prompt below)
A prior session executed this prompt and was interrupted by a session limit AFTER completing Waves 0-1.
1. Read notes/verification/UI-DESIGN-PROGRESS.md (the ledger) and `git show --stat 7e23e11` (SAFETY-CKPT of the
   interrupted state). Trust the ledger's structure, but VERIFY its claims cheaply: view the Wave 0 token sheet +
   Wave 1 catalog evidence frames and confirm the files exist and tsc still holds baseline (10). Do NOT redo Waves 0-1
   if evidence confirms; fix forward only if something is genuinely broken.
2. Resume at Wave 2A and proceed (2A→2E, then Wave 3 full verification incl. the user-advocate gate over EVERYTHING,
   waves 0-1 included — their advocate pass was deferred to Wave 3 by design).
3. BE TOKEN-EFFICIENT: no re-exploration of what the ledger already settles; the design system is FROZEN — consume it.
4. Keep updating the SAME ledger. AUTO-CHECKPOINT (Logan-approved): after each VERIFIED wave from here on, commit
   `AUTO-CKPT: <wave> — <one-line proof>` with the standard exclusions (mock-app.prism, ralph-state.json+backups,
   live-graph backups, verification backups, .claude/worktrees; verify ls-files has 0 worktrees). Never commit unverified.
5. If you hit the session limit again, the ledger + checkpoints make the next resume trivial — prioritize finishing
   a wave + checkpointing over starting a new wave late in the session.
