---
description: Kick off the autonomous Prism Harness Lock-In chain. Captures your currently-selected model, preflights, then launches the first Terminal window with /harness-step. Each window does ONE task, KripVerify-verifies it, commits/pushes, and auto-launches the next Terminal window using the SAME model. Chain runs until all 15 HL tasks done.
argument-hint: (none)
---

# Kickoff: Prism Harness Lock-In chain

You are the operator. The user typed `/kickoff-harness-lockin` in this
chat. Your job is to (a) capture this session's model so every chain worker
uses it, (b) preflight, (c) launch the first Terminal window. From there
the chain runs autonomously — each `/harness-step` session does one task
and launches the next Terminal window itself.

The plan: `/Users/loganbaird/.claude/plans/1-sounds-good-lets-jolly-frog.md`.
The chain worker: `.claude/commands/harness-step.md` (`/harness-step`).
State: `kid-kode-landing/notes/ralph-state.json` (15 HL tasks, status `running`).
Model contract file: `.claude/.harness-model` (written here in step 0, read
by every worker in step 14 of `/harness-step`).

You are NOT the chain worker. You launch it. After launch, your turn ends.

## Step 0 — capture your model (CRITICAL — must be Opus, no exceptions)

You currently know which model you are because your system prompt names it
(e.g. "powered by the model named Opus 4.7", "the exact model ID is
'claude-opus-4-7'"). The user has set a hard rule: **the chain runs on
Opus only.** Sonnet and Haiku are explicitly forbidden for chain coding
work — they will not be accepted.

Write your full model ID to `.claude/.harness-model` using the **Bash** tool.
The ID MUST start with `claude-opus-` and MUST be the full canonical form
of the user's currently-selected Opus version (e.g. `claude-opus-4-7`).
Step 1 preflight will reject anything else.

```bash
echo 'claude-opus-4-7' > /Users/loganbaird/Prototype_Prism/Design-trials/.claude/.harness-model
```

If your system-prompt model ID is anything other than an Opus variant,
**STOP**. Tell the user their UI dropdown is set to a forbidden model
(e.g. Sonnet) and abort the kickoff. They must switch to Opus before
re-running.

After writing, prove the model is real by running ALL of the following
and showing each output to the user:

```bash
echo "=== MODEL PROOF ==="
echo "1. Wrote to .claude/.harness-model:"; cat /Users/loganbaird/Prototype_Prism/Design-trials/.claude/.harness-model
echo ""; echo "2. Self-reported model ID from MY system prompt: <print the model ID you read from your own system prompt — quote it exactly>"
echo ""; echo "3. SHA256 of model-file (tamper check):"; shasum -a 256 /Users/loganbaird/Prototype_Prism/Design-trials/.claude/.harness-model
echo ""; echo "4. Starts-with-claude-opus check:"; grep -q '^claude-opus-' /Users/loganbaird/Prototype_Prism/Design-trials/.claude/.harness-model && echo PASS || echo FAIL
```

Show the user the literal output. Do not paraphrase. The user wants
runtime proof, not assurances.

The file is git-ignored. It is session-state, not tracked.

## Step 1 — preflight

Run these checks in parallel via Bash:

- `git -C /Users/loganbaird/Prototype_Prism/Design-trials rev-parse --abbrev-ref HEAD` → must equal `prism-main`
- `jq -r '.status, .project, (.tasks | map(select(.status != "done")) | length)' /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/ralph-state.json` → status must be `running`; project must contain "Harness Lock-In"; pending count > 0
- `command -v claude && command -v osascript` → both must resolve
- `test -f /Users/loganbaird/Prototype_Prism/Design-trials/.claude/commands/harness-step.md` → must succeed
- `test -f /Users/loganbaird/Prototype_Prism/Design-trials/.mcp.json && jq -e '.mcpServers.kv' /Users/loganbaird/Prototype_Prism/Design-trials/.mcp.json` → KripVerify MCP registered
- `test -s /Users/loganbaird/Prototype_Prism/Design-trials/.claude/.harness-model` → step 0 captured a non-empty model ID
- `grep -q '^claude-opus-' /Users/loganbaird/Prototype_Prism/Design-trials/.claude/.harness-model` → captured model is an Opus variant (Sonnet/Haiku rejected here)

If any fails: stop, tell the user exactly what's wrong, do not launch.

If status is `complete`: tell the user the chain is already done. Recommend
viewing the production deploy at https://kid-kode-ai-landing-git-prism-main-logans-projects-e51c822e.vercel.app/.

If status is `failed`: read the failed task's notes, surface the reason,
recommend resuming after fixing — they would re-paste `/kickoff-harness-lockin`
in a fresh chat to capture a fresh model file and restart the chain.

## Step 2 — tell the user, then launch

In one short message: how many tasks pending, the model ID written to
`.harness-model` (so the user can confirm it matches their UI dropdown), and
that you're opening Terminal now to start the chain.

Then run via the **Bash** tool (foreground, fast — just opens a window):

```bash
MODEL=$(cat /Users/loganbaird/Prototype_Prism/Design-trials/.claude/.harness-model) && \
osascript -e "tell application \"Terminal\" to do script \"cd /Users/loganbaird/Prototype_Prism/Design-trials && claude --print --model $MODEL /harness-step\""
```

That opens a new Terminal window where session 1 begins, running on the
model you captured in step 0. After it commits and pushes its task, step 14
of `/harness-step` reads `.harness-model` and launches another Terminal
window for the next task with the same model. Chain continues until status
flips to `complete` or `failed`.

## Step 3 — your turn ends here

You don't need to monitor — the chain runs autonomously across Terminal
windows. The user can ask questions during the chain, and you can:
- Read `kid-kode-landing/notes/ralph-state.json` for live status.
- Read `git log --oneline -20` for recent commits.
- Read `.kripverify/findings/latest.json` for the most recent KripVerify run.
- Tail `kid-kode-landing/notes/ralph-logs/` for per-iter logs.

Do NOT run `/harness-step` in this chat session. The chain is in Terminal
windows.

If the user says "stop the chain": instruct them to close any open Terminal
windows running `claude --print`. The chain stops naturally because no new
windows spawn from a closed session. State persists; resume by running
`/kickoff-harness-lockin` again (which will rewrite `.harness-model` to
whatever model is currently selected in the UI).

## Behavior rules

- Be concise. 2-3 lines maximum after launch.
- Don't echo Terminal output here — it's in the spawned window, not this chat.
- After launching, exit your turn. Wait for user questions, don't poll.
- The chain takes hours. Don't be alarmed by long gaps.
- The model is locked in at kickoff time. If the user changes their UI
  dropdown mid-chain, currently-running workers won't see it — but the next
  re-kickoff will. This is intentional: a chain shouldn't silently switch
  models mid-flight.
