---
description: Kickoff the Prism Editor Build Ralph loop. Stays open as the monitor.
argument-hint: (none)
---

# Kickoff: Prism Editor Build

You are the **monitor**. The user pasted `/kickoff-prism-editor`. Run the steps below in
order. Each step is short and self-contained. Total work: ~5 tool calls.

## Step 1 — verify model + run preflight (one Bash call)

Read your model ID from your system prompt (e.g., `claude-opus-4-7`). It MUST start with
`claude-opus-`. If it doesn't, stop here: tell the user their UI dropdown is set to a
non-Opus model and ask them to switch to Opus.

Then run **this single Bash command**, substituting your actual model ID:

```bash
/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/scripts/kickoff-loop.sh claude-opus-4-7
```

(Replace `claude-opus-4-7` with your actual model ID from your system prompt.)

The script writes the model contract, runs all preflight checks (branch, marker, spec, rule,
state file v1.1 + pending tasks, ralph.sh wiring, kv MCP server registration, VERCEL_TOKEN
present), and prints a single JSON line on stdout when everything's good. On any failure it
prints `kickoff-loop: FAIL — <reason>` to stderr and exits non-zero.

**If the script exits non-zero**, tell the user the exact stderr message and stop. Do not
try to fix anything yourself — the script's failure message names the specific issue.

**If the script exits 0**, parse the JSON it printed and continue.

## Step 2 — tell the user, in one short sentence, what's about to happen

Two-line summary, no verbosity. Something like:

> Preflight clean. 0 done / 26 pending. Launching `ralph.sh` in background — will spawn one
> Claude worker per task and stream events here. Say "stop the loop" to halt.

## Step 3 — launch ralph.sh in the background

Use the **Bash tool with `run_in_background: true`**:

```
cd /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing && ./scripts/ralph.sh
```

The Bash tool returns a task ID and an output file path. Save both — needed for Step 4 and
for any later `TaskStop`.

## Step 4 — load the Monitor + TaskStop tools, then start the Monitor

Both are deferred MCP tools. Load them in one call:

```
ToolSearch({ query: "select:Monitor,TaskStop", max_results: 2 })
```

Then start the Monitor with `persistent: true`. Use this exact command, replacing
`<OUTPUT_FILE>` with the path returned by Step 3's Bash:

```bash
STATE=/Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/ralph-state.json
LOG=<OUTPUT_FILE>
last_size=0
last_done=$(jq -r '[.tasks[] | select(.status=="done") | .id] | join(",")' "$STATE" 2>/dev/null || echo "")
last_status=""
last_in_progress=""
while sleep 6; do
  if [[ -f "$LOG" ]]; then
    cur_size=$(stat -f%z "$LOG" 2>/dev/null || stat -c%s "$LOG" 2>/dev/null || echo 0)
    if (( cur_size > last_size )); then
      tail -c +$((last_size+1)) "$LOG" 2>/dev/null | \
        grep -E --line-buffered "ralph\.sh: iter|Ralph editor-build iter|loop complete|loop failed|breakpoint|claude exited non-zero|paused-" | \
        head -20
      last_size=$cur_size
    fi
  fi
  cur_done=$(jq -r '[.tasks[] | select(.status=="done") | .id] | join(",")' "$STATE" 2>/dev/null || echo "")
  cur_status=$(jq -r '.status' "$STATE" 2>/dev/null || echo "")
  cur_in_progress=$(jq -r '[.tasks[] | select(.status=="in-progress") | .id] | join(",")' "$STATE" 2>/dev/null || echo "")
  if [[ "$cur_done" != "$last_done" ]]; then
    new=$(comm -23 <(tr ',' '\n' <<<"$cur_done" | sort) <(tr ',' '\n' <<<"$last_done" | sort) | tr '\n' ' ')
    echo "task(s) done: $new"
    last_done=$cur_done
  fi
  if [[ "$cur_in_progress" != "$last_in_progress" && -n "$cur_in_progress" ]]; then
    echo "claimed: $cur_in_progress"
    last_in_progress=$cur_in_progress
  fi
  if [[ "$cur_status" != "$last_status" && -n "$cur_status" ]]; then
    echo "status: $cur_status"
    last_status=$cur_status
  fi
  case "$cur_status" in
    complete) echo "Ralph editor-build loop COMPLETE — all tasks done."; exit 0 ;;
    failed)   failed_id=$(jq -r '[.tasks[] | select(.status=="failed") | .id] | join(",")' "$STATE" 2>/dev/null)
              echo "Ralph editor-build loop FAILED at task: $failed_id"; exit 0 ;;
  esac
done
```

Set the Monitor's `description` to `Ralph editor-build loop progress`.
Set `persistent: true` and `timeout_ms: 3600000`.

## Step 5 — your turn ends here

After Step 4, do not call any more tools. Wait for the user or for Monitor events. Each
Monitor event arrives as its own message in this chat — you respond by acknowledging
briefly (one short line). Don't echo events you already saw.

If the user asks questions about a specific task, you may:
- `Read` the iter log at `kid-kode-landing/notes/ralph-logs/iter-<N>-*.log`
- `Bash` to `jq` the state file
- `Read` snapshots at `kid-kode-landing/notes/ralph-snapshots/<task-id>/`

Do not run `/ralph-step-editor` yourself. Do not edit code. Do not commit. The autonomous
loop is doing the work; you are the narrator.

## Step 6 — handle stop requests

If the user says "stop the loop" or "pause" or similar:
1. Call `TaskStop` with the background task ID from Step 3.
2. Confirm the loop is stopped. Tell the user how to resume: paste `/kickoff-prism-editor`
   again in a fresh session.

## Step 7 — terminal handling

When the Monitor stream ends (loop went to `complete` or `failed`):
- If `complete`: summarize in 3-5 lines (total iters, total commits, snapshot dir, final
  state). Recommend removing the `.prism-editor-build-active` marker if the user wants
  the editor-build hooks to deactivate.
- If `failed`: read the failed task's `notes` field via `jq`, read the last 30 lines of
  its iter log, surface the cause, recommend recovery options.
