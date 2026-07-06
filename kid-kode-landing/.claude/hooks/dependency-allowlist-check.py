#!/usr/bin/env python3
"""Analyzer for dependency-allowlist-check.sh (PreToolUse Write|Edit|MultiEdit).

Reads the Claude Code hook JSON on stdin and inspects the *pending* write
content (never the on-disk file, because PreToolUse runs before the write).
Blocks (exit 2) on:

  Surface 1 — package.json dependency drift:
    * a new dependency key not on the allowlist below
    * a forbidden dependency (pixi.js / pixi-filters / @pixi/* / html-to-image)
    * a DEPENDENCY DOWNGRADE (pending semver < the version currently on disk)

  Surface 2 — non-allowlisted imports under the prism runtime/build scope
    (src/lib/prism/**, src/components/prism-player/**, scripts/**).

  Surface 3 — canonical-3 FORBIDDEN PATTERNS in src/** + scripts/** code
    (PRISM-RUNTIME-SPEC.md §12 / PRISM-NODE-EDITOR-SPEC.md §11 /
     PRISM-CANVAS-EDITOR-SPEC.md §19):
      * PixiJS / any second *visible* renderer (INV-R1 / FP-R1)
      * a CDN-vs-bundled `three` import-map split (RT-SC-02 / INV-R1)
      * diffusion-drawn text — FLUX/fal call lacking "no text" discipline (INV-R11)
      * a stored global fps (canvas §19 — fps is per-frame delta, never a global)
      * wiring app behavior inside canvas (FP-NE-2 — canvas is visual/spatial/anim only)

Exit codes: 0 = ok / out of scope, 2 = block (stderr shown to Claude).
"""
import json
import os
import re
import sys

# ---------------------------------------------------------------------------
# Allowlist — packages that may be imported / declared as deps in this repo.
# PixiJS is NO LONGER allowed (renderer migration to three/webgpu is DONE).
# To allow a new package: add it here AND document the rationale in
# notes/mockup-pipeline.md §10.
# ---------------------------------------------------------------------------
RUNTIME_ALLOW = {
    "@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-scroll-area",
    "@radix-ui/react-slider", "@radix-ui/react-tabs", "@radix-ui/react-tooltip",
    "@react-three/drei", "@react-three/fiber", "@react-three/postprocessing",
    "camera-controls", "clsx", "d3-force-3d", "gsap", "jszip", "lenis",
    "next", "next/font", "next/font/google", "next/font/local", "next/image",
    "next/link", "next/navigation", "next/server", "postprocessing",
    "react", "react-dom", "react/jsx-runtime", "simplex-noise", "tailwind-merge",
    "three", "three-msdf-text-webgpu",
    "three/examples/jsm/controls/OrbitControls", "three/tsl", "three/webgpu",
    # Material+Lighting subsystem (canvas-spec §10/§11). First-party three.js
    # addons that ship INSIDE the already-approved `three` package (one `three`
    # instance — INV-R1 / RT-SC-02 intact; these are NOT a second renderer and
    # NOT a new npm dep). RoomEnvironment = PMREM IBL (T0); the tsl/display nodes
    # = native TSL screen-space GI/AO/SSR/TAA + volumetric godrays for the T2
    # tier (capability-gated, INV-9 — never the default path). Rationale logged
    # in notes/mockup-pipeline.md §10 (2026-06-08).
    "three/examples/jsm/environments/RoomEnvironment.js",
    "three/examples/jsm/tsl/display/GTAONode.js",
    "three/examples/jsm/tsl/display/SSGINode.js",
    "three/examples/jsm/tsl/display/SSRNode.js",
    "three/examples/jsm/tsl/display/TRAANode.js",
    "three/examples/jsm/tsl/display/GodraysNode.js",
    # 3D TEXT STYLING (canvas-spec §7 / INV-11) — true extruded text from REAL
    # font outlines. BufferGeometryUtils (mergeGeometries) is a first-party
    # three.js addon shipped INSIDE the already-approved `three` package (one
    # `three` instance — INV-R1 / RT-SC-02 intact; NOT a 2nd renderer, NOT a new
    # npm dep). Used at runtime to merge per-glyph ExtrudeGeometry into one draw
    # call. Rationale logged in notes/mockup-pipeline.md §10 (2026-06-14).
    "three/examples/jsm/utils/BufferGeometryUtils.js",
    "zustand", "zustand/middleware",
    # SHELL W0 (PRISM-FRONTEND-SHELL-SPEC v1.1 I4 "contract-first tRPC + Zod")
    # — the shell↔engine command/event contract, Brand Profile schema, and
    # CollabRoom types (decision E) are Zod-validated in
    # packages/shared-interfaces/src/prism-*.ts. zod is pure schema validation
    # (no renderer, no DOM, no transport); already vendored transitively at
    # 3.25.76, promoted to a direct dep. Rationale logged in
    # notes/mockup-pipeline.md §10 (2026-07-04).
    "zod",
    # SHELL W1 (PRISM-FRONTEND-SHELL-SPEC v1.1 I4 "contract-first tRPC + Zod",
    # §12 W1 chat agentic loop "local echo/stub agent endpoint (tRPC,
    # contract-first)") — the builder shell's agent endpoint is a tRPC v11
    # router whose procedures stream Zod-validated contract events
    # (packages/shared-interfaces/src/prism-agent.ts) over httpBatchStreamLink.
    # tRPC is typed RPC plumbing only: no renderer, no DOM, no WebSocket (I1
    # intact — streaming rides a plain fetch response), no second state
    # library (I3 intact). Rationale logged in notes/mockup-pipeline.md §10
    # (2026-07-04, W1 addendum).
    "@trpc/server", "@trpc/client",
    # SHELL W1A (PRISM-FRONTEND-SHELL-SPEC v1.1 §14 W1A, invariant I2 "Better
    # Auth only") — accounts & tenancy. better-auth is the SPEC-MANDATED auth
    # system (Google/GitHub one-click OAuth + email/password + sessions,
    # sameSite:'lax'). Server-side only instance (src/server/auth/**) backed
    # by Node 22's built-in node:sqlite under .data/ (gitignored; zero new
    # native deps — established local-store precedent, see snippets/store.ts);
    # client side is better-auth/react session hooks only. No renderer, no
    # DOM chrome, no WebSocket (I1 intact), no second state library (I3
    # intact), no second auth system (I2 intact — this IS the one).
    # Deviations W1A-D1..D3 logged in docs/spec-deviations-prism.md
    # (2026-07-04, before code).
    "better-auth",
    # EDITOR-EXP P7 (C32-34) — undo/redo. zundo is a pure zustand temporal
    # middleware (no renderer, fits zustand ^5); immer for patch-based history.
    # Approved per RE-VERIFY-DECISIONS.md (zundo 2.3, immer 11.1.8).
    "zundo", "immer",
    # F5 ATELIER CONFIGURATOR (ORRERY-NO7-PROTOTYPE-SPEC §1/§3.2) — physics for
    # drag-drop part snapping (magnetic sockets, spring-settle joints). Pinned
    # rapier3d-compat 0.19.3: inlined base64 WASM (no bundler/loader config),
    # runs alongside three/webgpu as a headless physics step — NOT a renderer,
    # NOT DOM. Rationale logged in notes/mockup-pipeline.md §10 (2026-06-20).
    "@dimforge/rapier3d-compat",
}
BUILD_ALLOW = {
    "@fal-ai/client", "dotenv", "ffmpeg-static", "globby", "maxrects-packer",
    "msdf-bmfont-xml", "playwright", "sharp",
    # 3D TEXT STYLING — opentype.js parses on-demand TTFs (already vendored
    # transitively ^1.3.4 via msdf-bmfont-xml; promoted to a direct dep) into
    # glyph path commands SERVER-SIDE (sibling of sharp/msdf-bmfont-xml), which
    # the client converts to THREE.ShapePath → ExtrudeGeometry (NOT the forbidden
    # THREE.TextGeometry/typeface path; anti-drift FP-02 intact, real outlines =
    # INV-11). Rationale logged in notes/mockup-pipeline.md §10 (2026-06-14).
    "opentype.js",
}
DEVDEP_ALLOW = {
    "@types/node", "@types/react", "@types/react-dom", "@types/three",
    "autoprefixer", "postcss", "tailwindcss", "typescript",
    # Test harness. Most prism tests live in tests/{unit,...} (outside the
    # Surface-2 src scope), but COLOCATED unit tests (e.g.
    # src/lib/prism/text/font-outline-registry.test.ts) import vitest from
    # inside the prism scope. vitest is a real devDependency (^2.1.9); allow the
    # bare specifier so colocated *.test.ts files pass the import guard.
    # Rationale: 3D TEXT STYLING outline-registry colocated test (2026-06-14).
    "vitest",
    # Flight Recorder (W-FR, 2026-07-05, D3): offline Parquet compaction of the
    # NDJSON training corpus. hyparquet-writer (+ its single dep hyparquet) is
    # pure JS, no native code, used ONLY by scripts/flight-recorder-compact.mjs
    # (never the request path, never the client bundle). Rationale logged in
    # notes/mockup-pipeline.md §10 + notes/spec-deviations-wfr.md D3.
    "hyparquet-writer", "hyparquet",
}
ALL_ALLOW = RUNTIME_ALLOW | BUILD_ALLOW | DEVDEP_ALLOW

# Hard-fail dependencies/imports, regardless of context.
#   html-to-image — spec line 1251 (carried forward).
#   pixi*         — renderer migration removed PixiJS; it is forbidden in the
#                   visible path (runtime INV-R1 / FP-R1).
FORBIDDEN_EXACT = {"html-to-image", "pixi.js", "pixi-filters"}
FORBIDDEN_PREFIX = ("@pixi/",)

# ---------------------------------------------------------------------------
# Stock / third-party ICON libraries — PERMANENTLY FORBIDDEN (Logan, design rule,
# 2026-06-07). Every icon in this app must be CUSTOM, with a 3D / dimensional
# premium feel in the Prism visual language (rendered via
# src/components/editor/icons/Icon.tsx + IconPrimitives.ts). No flat generic
# line-icon set may EVER be (re)introduced — toolbar, TopBar, Inspector, mode
# toggle, Minimap, HubNav, anywhere. This applies to BOTH package.json deps AND
# any import under src/** (not just the prism runtime/build scope).
# To extend: add the package here; do NOT add an exception.
# ---------------------------------------------------------------------------
FORBIDDEN_ICON_EXACT = {
    "lucide-react", "lucide",
    "react-icons",
    "react-feather", "feather-icons",
    "phosphor-react",
    "heroicons", "@heroicons/react", "@heroicons/vue",
    "@iconify/react", "@iconify-icons/react", "@iconify/icons",
    "boxicons", "react-bootstrap-icons", "@radix-ui/react-icons",
    "ionicons", "@ionic/react",
    "@ant-design/icons", "@mui/icons-material",
    "@primer/octicons-react", "octicons",
    "css.gg", "grommet-icons", "@expo/vector-icons",
}
FORBIDDEN_ICON_PREFIX = (
    "@fortawesome/", "react-icons/", "@heroicons/", "@tabler/icons",
    "@phosphor-icons/", "@iconify/", "@iconify-icons/", "@mui/icons-material/",
)

# ---------------------------------------------------------------------------
# Import-detection regex (Surfaces 2 + 2b).
#
# IMPORTANT — false-positive fix (permanent; 2026-06-07, Logan/catalog-prep).
# The old pattern `(?:from|import|require)\s*\(?\s*['"]...` allowed ZERO
# whitespace between the keyword and the opening quote, so any *string value or
# comment* containing the bare token `from`/`import`/`require` immediately
# before a quote — e.g. a ControlSchema control with `id: 'from'`, or a comment
# ending in the word "import" right before a quoted word — was misread as an
# unapproved import and BLOCKED the write (the ULTRACODE pilot tripped on a
# control id of 'from'). That is a guard defect, not real drift.
#
# Real module syntax is unambiguous and is the ONLY thing matched now:
#   * `from 'x'` / `import 'x'`         → keyword + >=1 whitespace + quote
#   * `import('x')` / `require('x')`    → keyword + '(' + quote (dynamic/CJS)
# A negative lookbehind `(?<![\w$])` keeps it from matching inside identifiers
# (e.g. a var literally named `importmap`). Minified `}from'x'` (no space, no
# paren) is intentionally NOT matched — source in this repo is never minified,
# and missing a rare edge is far better than false-blocking valid code.
# ---------------------------------------------------------------------------
IMPORT_RE = re.compile(
    r"""(?<![\w$])(?:(?:from|import)\s+|(?:import|require)\s*\(\s*)['"]([^'"]+)['"]"""
)


def imported_specifiers(content: str) -> set:
    """All module specifiers a chunk of code imports (ESM + dynamic + CJS)."""
    return {m.group(1) for m in IMPORT_RE.finditer(content)}


def is_forbidden_icon_pkg(pkg: str) -> bool:
    return pkg in FORBIDDEN_ICON_EXACT or any(pkg.startswith(p) for p in FORBIDDEN_ICON_PREFIX)


def is_forbidden_pkg(pkg: str) -> bool:
    return (
        pkg in FORBIDDEN_EXACT
        or any(pkg.startswith(p) for p in FORBIDDEN_PREFIX)
        or is_forbidden_icon_pkg(pkg)
    )


def is_allowed_import(pkg: str) -> bool:
    if pkg.startswith(("node:", "./", "../", "/")):
        return True
    # Next.js `@/` path alias — resolves to ./src/ (project-local, not an npm
    # package). Always allowed (equivalent to a relative import).
    if pkg.startswith("@/"):
        return True
    if pkg in ALL_ALLOW:
        return True
    # scoped subpaths of an allowed package, e.g. "@react-three/fiber/foo"
    return any(pkg == a or pkg.startswith(a + "/") for a in ALL_ALLOW)


def parse_semver(spec: str):
    """Return (major, minor, patch) ints from a version spec, or None if not
    a comparable pinned/range version (e.g. '*', 'latest', git/workspace)."""
    if not spec:
        return None
    s = spec.strip().lstrip("^~>=<= v").strip()
    m = re.match(r"(\d+)\.(\d+)\.(\d+)", s)
    if not m:
        m = re.match(r"(\d+)\.(\d+)", s)
        if m:
            return (int(m.group(1)), int(m.group(2)), 0)
        return None
    return (int(m.group(1)), int(m.group(2)), int(m.group(3)))


def extract_content(data: dict):
    ti = data.get("tool_input") or {}
    tool = data.get("tool_name") or ""
    fp = ti.get("file_path") or ""
    if tool == "Write":
        content = ti.get("content") or ""
    elif tool == "Edit":
        content = ti.get("new_string") or ""
    elif tool == "MultiEdit":
        content = "\n".join((e or {}).get("new_string") or "" for e in (ti.get("edits") or []))
    else:
        content = ti.get("content") or ti.get("new_string") or ""
    return tool, fp, content


def disk_pkg_versions(file_path: str) -> dict:
    try:
        with open(file_path) as f:
            pj = json.load(f)
    except Exception:
        return {}
    out = {}
    for grp in ("dependencies", "devDependencies"):
        for k, v in (pj.get(grp) or {}).items():
            out[k] = v
    return out


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    tool, file_path, content = extract_content(data)
    if not file_path or not content:
        return 0

    base = os.path.basename(file_path)
    # Test fixtures under tests/fixtures/** are ANALYZED DATA (input repos for the
    # W-IMPORT ingest analyzer), never installed as project dependencies — the
    # dependency allowlist does not apply to a fixture's manifest.
    is_fixture = "/tests/fixtures/" in file_path
    is_pkg_json = base == "package.json" and not is_fixture
    is_lockfile = base == "package-lock.json" and not is_fixture
    is_code = file_path.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"))
    in_prism_scope = bool(re.search(r"/(src/lib/prism|src/components/prism-player)/|/scripts/", file_path))
    in_src_or_scripts = ("/kid-kode-landing/src/" in file_path) or ("/scripts/" in file_path)
    is_canvas = "/canvas/" in file_path

    violations = []

    # ---- Surface 1: package.json dependency allowlist + downgrade ----------
    if is_pkg_json:
        # Pending name->version pairs. For a Write of the full file, parse JSON;
        # otherwise regex-scan the fragment for "name": "version" dep pairs.
        pending = {}
        if tool == "Write":
            try:
                pj = json.loads(content)
                for grp in ("dependencies", "devDependencies"):
                    pending.update(pj.get(grp) or {})
            except Exception:
                pending = {}
        if not pending:
            for m in re.finditer(r'"([@\w./-]+)"\s*:\s*"([^"]+)"', content):
                name, ver = m.group(1), m.group(2)
                # Heuristic: dep-looking entries (scoped, or version-looking value).
                if name.startswith("@") or re.search(r"\d", ver) or ver in ("*", "latest"):
                    if name not in ("name", "version", "license", "type", "main", "module"):
                        pending[name] = ver
        disk = disk_pkg_versions(file_path)
        for name, ver in pending.items():
            if is_forbidden_icon_pkg(name):
                violations.append(
                    f'FORBIDDEN icon-library dep in package.json: "{name}" — stock/third-party '
                    f"icon sets are PERMANENTLY banned (Logan design rule). Every icon must be "
                    f"custom + 3D-premium via src/components/editor/icons/Icon.tsx. Add a glyph "
                    f"there instead of a dependency."
                )
                continue
            if is_forbidden_pkg(name):
                violations.append(
                    f'FORBIDDEN dep in package.json: "{name}" — PixiJS/html-to-image are '
                    f"disallowed (renderer is three/webgpu; runtime INV-R1 / spec line 1251)."
                )
                continue
            if name not in ALL_ALLOW:
                violations.append(
                    f'UNAPPROVED dep in package.json: "{name}" — not on the allowlist in '
                    f".claude/hooks/dependency-allowlist-check.py. If intentional, add it with "
                    f"rationale in notes/mockup-pipeline.md §10."
                )
            # Downgrade detection vs the version currently on disk.
            old = parse_semver(disk.get(name, ""))
            new = parse_semver(ver)
            if old and new and new < old:
                violations.append(
                    f'DEPENDENCY DOWNGRADE: "{name}" {disk.get(name)} -> {ver}. Downgrading to '
                    f"make an error disappear is forbidden (ANTI-STUCK rule). Root-cause the issue "
                    f"or web-search the current API instead."
                )

    # ---- Surface 2: imports under prism runtime/build scope ----------------
    if in_prism_scope and is_code and not is_pkg_json and not is_lockfile:
        imports = imported_specifiers(content)
        for pkg in sorted(imports):
            if is_forbidden_pkg(pkg):
                violations.append(
                    f"FORBIDDEN import in {base}: '{pkg}' — PixiJS/html-to-image are disallowed "
                    f"(runtime INV-R1 / spec line 1251)."
                )
            elif not is_allowed_import(pkg):
                violations.append(
                    f"UNAPPROVED import in {base}: '{pkg}' — not on the allowlist. If intentional, "
                    f"add it to dependency-allowlist-check.py and document the rationale."
                )

    # ---- Surface 2b: stock ICON libraries anywhere under src/** ------------
    # Design-system rule (Logan): icons are ALWAYS custom + 3D-premium. This
    # scope is wider than Surface 2 (whole src tree, not just the prism runtime)
    # because the rule covers the entire editor — toolbar, TopBar, Inspector,
    # mode toggle, Minimap, HubNav, everywhere.
    if in_src_or_scripts and is_code and not is_pkg_json and not is_lockfile:
        icon_imports = imported_specifiers(content)
        for pkg in sorted(icon_imports):
            if is_forbidden_icon_pkg(pkg):
                violations.append(
                    f"FORBIDDEN icon-library import in {base}: '{pkg}' — stock/third-party icon "
                    f"sets are PERMANENTLY banned (Logan design rule). Use the custom 3D-premium "
                    f"set: import {{ Icon }} from '@/components/editor/icons/Icon' (add a glyph to "
                    f"PATHS / IconPrimitives.ts if one is missing)."
                )

    # ---- Surface 3: canonical-3 forbidden patterns -------------------------
    if in_src_or_scripts and is_code and not is_pkg_json:
        # (a/b) PixiJS or any second *visible* renderer library.
        if re.search(r"""import\s+\*\s+as\s+PIXI\b|from\s*['"]pixi(\.js|-filters)?['"]|from\s*['"]@pixi/""", content):
            violations.append(
                "FORBIDDEN: PixiJS in the visible path (runtime INV-R1 / FP-R1) — one three/webgpu scene only."
            )
        if re.search(r"""from\s*['"](@babylonjs/[\w-]+|babylonjs|regl|ogl|phaser)['"]""", content):
            violations.append(
                "FORBIDDEN: second visible renderer import (runtime INV-R1 / FP-R1) — all visible 3D is "
                "the one three/webgpu scene; no second renderer library."
            )
        # (c) CDN-vs-bundled three split (import-map or CDN URL for three).
        if re.search(r'type\s*=\s*["\']importmap["\']', content) and re.search(r'["\']three(/webgpu|/tsl)?["\']\s*:', content):
            violations.append(
                "FORBIDDEN: `three` import-map (runtime RT-SC-02 / INV-R1) — exactly one bundled `three` "
                "instance; no CDN-vs-bundled split."
            )
        if re.search(r"https?://(cdn\.jsdelivr\.net|unpkg\.com|esm\.sh|cdn\.skypack\.dev)/[^'\"]*three", content):
            violations.append(
                "FORBIDDEN: CDN `three` URL (runtime RT-SC-02 / INV-R1) — bundle `three` from node_modules; "
                "no CDN import."
            )
        # (e) stored global fps.
        if re.search(r"\b(globalThis|window|global)\.fps\b", content) or \
           re.search(r"^\s*(export\s+)?(const|let|var)\s+(global)?[Ff]ps\s*=", content, re.M) or \
           re.search(r"^\s*(export\s+)?(const|let|var)\s+targetFps\s*=", content, re.M):
            violations.append(
                "FORBIDDEN: stored global fps (canvas §19) — framerate is a per-frame delta passed to "
                "drivers; do not stash a global/module-scope fps."
            )

    # (d) diffusion-drawn text — FLUX/fal call lacking negative-text discipline.
    is_asset_pipeline = bool(re.search(r"/(generate-|provision-)|/mock-app-source/assets/|/codegen/", file_path))
    if in_src_or_scripts and is_code and is_asset_pipeline:
        if re.search(r"fal\.(subscribe|run)|fal-ai|\bFLUX\b|\bflux\b", content):
            if not re.search(r"no[ _]text|no[ _]letters|no[ _]labels", content, re.I):
                violations.append(
                    "FORBIDDEN: FLUX/fal image call without negative-text discipline (runtime INV-R11) — "
                    "text is real MSDF, never diffusion-baked; include 'no text, no letters, no labels' in "
                    "the negative prompt."
                )

    # (f) wiring app behavior inside canvas.
    if is_canvas and is_code:
        m = re.search(r"\brouter\.push\s*\(|\buseRouter\s*\(|\.navigate\s*\(|window\.location|\bfetch\s*\(", content)
        if m:
            violations.append(
                f"FORBIDDEN: app-behavior wiring in a canvas module ('{m.group(0).strip()}') — FP-NE-2. Canvas "
                "authors visuals/space/animation only; navigation & backend wiring live in the node editor."
            )

    if violations:
        sys.stderr.write(f"[dependency-allowlist-check] BLOCK — drift detected in {file_path}:\n")
        for v in violations:
            sys.stderr.write(f"  - {v}\n")
        sys.stderr.write("\nGuard: .claude/hooks/dependency-allowlist-check.py "
                         "(wired via dependency-allowlist-check.sh, PreToolUse).\n")
        sys.stderr.write("Canonical specs: docs/prism/PRISM-RUNTIME-SPEC.md §12, "
                         "PRISM-NODE-EDITOR-SPEC.md §11, PRISM-CANVAS-EDITOR-SPEC.md §19.\n")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
