#!/bin/bash
# Editor-chain build-agent counter. On this Mac `pgrep -af` prints only PIDs, so inspect each PID
# with `ps -p <pid> -o command=` (shows full cmdline). Count claude -p procs that are NOT the
# 'Say OK' probe and NOT a 'loganbaird/OpenDesign' session. Unreadable PID -> counted (assume alive)
# so we never under-count (under-counting caused a relaunch storm).
cnt=0
for pid in $(pgrep -f '\.local/bin/claude -p' 2>/dev/null); do
  cmd=$(ps -p "$pid" -o command= 2>/dev/null)
  if [ -z "$cmd" ]; then cnt=$((cnt+1)); continue; fi
  echo "$cmd" | grep -q 'Say OK' && continue
  echo "$cmd" | grep -q 'loganbaird/OpenDesign' && continue
  cnt=$((cnt+1))
done
echo "$cnt"
