#!/usr/bin/env bash
# PILLAR 5 (gate) — NO-REMOTE-ASSET gate (PreToolUse: Write|Edit).
# Blocks introducing a REMOTE asset dependency into editor/runtime/scene code under
# kid-kode-landing/src/**. This is the exact class of bug that crashed the canvas on
# 2026-06-29: drei `<Environment preset="night">` silently fetched a HDRI from
# raw.githack.com at runtime; the failed fetch threw inside <Canvas> and took the
# whole canvas (toolbar + keyframe + tutorial) down. Caught at WRITE time now.
# Reads hook JSON from stdin; exit 2 = block.
set -uo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); print((d.get("tool_input") or {}).get("file_path") or "")')
content=$(printf '%s' "$input" | /usr/bin/python3 -c 'import sys,json; d=json.load(sys.stdin); ti=d.get("tool_input") or {}; print(ti.get("content") or ti.get("new_string") or "")')

# Only gate source code under the app's src/**.
case "$file_path" in
  */kid-kode-landing/src/*) : ;;
  *) exit 0 ;;
esac

# An explicit, reviewed exception (e.g. a genuinely server-side, founder-approved
# fetch) may carry this marker on the line.
if printf '%s' "$content" | grep -q 'ALLOWED-REMOTE-ASSET'; then exit 0; fi

violations=()

# drei <Environment preset="..."> → fetches an HDRI from the drei-assets CDN. BANNED.
if printf '%s' "$content" | grep -qE '<Environment[^>]*\bpreset[[:space:]]*='; then
  violations+=("drei <Environment preset=...> fetches a remote HDRI from a CDN at runtime (the 2026-06-29 crash). Use a LOCAL equirect via StudioEnv (scene.environment = local texture) or a procedural <Environment> with <Lightformer> children. NO preset.")
fi
# <Environment files="http..."> or any remote env/asset URL.
if printf '%s' "$content" | grep -qE 'files[[:space:]]*=[[:space:]]*[`"'"'"']https?://'; then
  violations+=("Remote <Environment files=\"http...\"> — bundle the asset under public/ and reference it by local path.")
fi
# Any remote asset URL fetched in src (hdr/exr/glb/gltf/ktx2/textures/video).
if printf '%s' "$content" | grep -qiE 'https?://[^"'"'"'`[:space:]]+\.(hdr|exr|ktx2|glb|gltf|hdri|mp4|webm)'; then
  violations+=("A remote asset URL (.hdr/.exr/.ktx2/.glb/.gltf/.mp4) in src/** — runtime/editor assets MUST be local under public/. Download + bundle it.")
fi
# Known asset-CDN hosts.
if printf '%s' "$content" | grep -qiE 'raw\.githack\.com|githubusercontent\.com/.*\.(hdr|exr|glb)|polyhaven\.org|dl\.polyhaven|cdn\.jsdelivr\.net/.*\.(hdr|exr|glb)'; then
  violations+=("Reference to a known asset CDN (githack/polyhaven/jsdelivr asset). NO remote assets in the runtime — bundle locally.")
fi
# esm.sh CDN imports (skill + repo rule: npm-resolved only).
if printf '%s' "$content" | grep -qE "from[[:space:]]+[\"']https://esm\.sh/"; then
  violations+=("esm.sh CDN import — use npm-resolved imports only (the production repo).")
fi

if [ ${#violations[@]} -gt 0 ]; then
  {
    echo "⛔ NO-REMOTE-ASSET GATE blocked this write to: $file_path"
    for v in "${violations[@]}"; do echo " • $v"; done
    echo ""
    echo "INTENT-LOCK fact #5: editor/scene assets are LOCAL under public/**. A remote"
    echo "fetch that fails throws inside <Canvas> and crashes the whole editor."
    echo "If you have a genuinely-reviewed exception, add an // ALLOWED-REMOTE-ASSET: <reason> marker."
  } >&2
  exit 2
fi
exit 0
