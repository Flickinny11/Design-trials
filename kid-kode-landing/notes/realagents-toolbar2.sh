#!/bin/bash
# Count THIS run's toolbar2 build agents.
# On this Mac `pgrep -af` prints only PIDs, so we inspect each PID with `ps -p <pid> -o command=`
# (which DOES show the full command line). Count claude -p procs that are NOT the 'Say OK' probe
# and NOT a 'loganbaird/OpenDesign' session. FAIL-SAFE: an unreadable PID is counted (assumed alive),
# so we never under-count (under-counting previously caused a relaunch storm).
cnt=0
for pid in $(pgrep -f '\.local/bin/claude -p' 2>/dev/null); do
  cmd=$(ps -p "$pid" -o command= 2>/dev/null)
  if [ -z "$cmd" ]; then cnt=$((cnt+1)); continue; fi
  echo "$cmd" | grep -q 'Say OK' && continue
  echo "$cmd" | grep -q 'loganbaird/OpenDesign' && continue
  cnt=$((cnt+1))
done
echo "$cnt"
