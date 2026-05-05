---
description: Kick off the autonomous Prism Harness Lock-In chain. Preflight checks, then launches a new Terminal window with the first /harness-step session. Each session does ONE task, KripVerify-verifies it, commits/pushes, and auto-launches the next Terminal window. Chain runs until all 15 HL tasks done.
argument-hint: (none)
---

# Kickoff: Prism Harness Lock-In chain

You are the operator. The user typed `/kickoff-harness-lockin` in this
chat. Your job is to preflight, then launch the first Terminal window. From
there the chain runs autonomously — each `/harness-step` session does one
task and launches the next Terminal window itself.

The plan: `/Users/loganbaird/.claude/plans/1-sounds-good-lets-jolly-frog.md`.
The chain worker: `.claude/commands/harness-step.md` (`/harness-step`).
State: `kid-kode-landing/notes/ralph-state.json` (15 HL tasks, status `running`).

You are NOT the chain worker. You launch it. After launch, your turn ends.

## Step 1 — preflight

Run these checks in parallel via Bash:

- `git -C /Users/loganbaird/Prototype_Prism/Design-trials rev-parse --abbrev-ref HEAD` → must equal `prism-main`
- `jq -r '.status, .project, (.tasks | map(select(.status != "done")) | length)' /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/ralph-state.json` → status must be `running`; project must contain "Harness Lock-In"; pending count > 0
- `command -v claude && command -v osascript` → both must resolve
- `test -f /Users/loganbaird/Prototype_Prism/Design-trials/.claude/commands/harness-step.md` → must succeed
- `test -f /Users/loganbaird/Prototype_Prism/Design-trials/.mcp.json && jq -e '.mcpServers.kv' /Users/loganbaird/Prototype_Prism/Design-trials/.mcp.json` → KripVerify MCP registered

If any fails: stop, tell the user exactly what's wrong, do not launch.

If status is `complete`: tell the user the chain is already done. Recommend
viewing the production deploy at https://kid-kode-ai-landing-git-prism-main-logans-projects-e51c822e.vercel.app/.

If status is `failed`: read the failed task's notes, surface the reason,
recommend resuming after fixing — `osascript -e 'tell app "Terminal" to do
script "cd /Users/loganbaird/Prototype_Prism/Design-trials && claude --print
/harness-step"'`.

## Step 2 — tell the user, then launch

In one short message: how many tasks pending, that you're opening Terminal
now to start the chain, and that subsequent windows will auto-spawn as each
task completes its KripVerify-gated verification.

Then run via the **Bash** tool (foreground, fast — just opens a window):

```bash
osascript -e 'tell application "Terminal" to do script "cd /Users/loganbaird/Prototype_Prism/Design-trials && claude --print /harness-step"'
```

That opens a new Terminal window where session 1 begins. After it commits
and pushes its task, step 14 of `/harness-step` launches another Terminal
window for the next task. Chain continues until status flips to `complete`
or `failed`.

## Step 3 — your turn ends here

You don't need to monitor — the chain runs autonomously across Terminal
windows. The user can ask questions during the chain, and you can:
- Read `kid-kode-landing/notes/ralph-state.json` for live status.
- Read `git log --oneline -20` for recent commits.
- Read `.kripverify/findings/latest.json` for the most recent KripVerify run.
- Tail `kid-kode-landing/notes/ralph-logs/` for per-iter logs (if the chain
  writes them — currently /harness-step doesn't, but iter commit messages
  in `git log` serve the same purpose).

Do NOT run `/harness-step` in this chat session. The chain is in Terminal
windows.

If the user says "stop the chain": instruct them to close any open Terminal
windows running `claude --print /harness-step`. The chain stops naturally
because no new windows spawn from a closed session. State persists; resume
by running `/kickoff-harness-lockin` again or pasting the shell command above
in Terminal.

## Behavior rules

- Be concise. 2-3 lines maximum.
- Don't echo Terminal output here — it's in the spawned window, not this chat.
- After launching, exit your turn. Wait for user questions, don't poll.
- The chain takes hours. Don't be alarmed by long gaps.
