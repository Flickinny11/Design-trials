# ORRERY No.7 Atelier — Progress Ledger

One line per wave/phase boundary. Appended by the running agent.

2026-06-20 P1 START — provisioning 7 fal textures (dial-tex-guilloche, dial-tex-solarized, dial-tex-meteorite, dial-tex-aventurine, dial-tex-enamel, strap-tex-alligator, strap-tex-rubber)
2026-06-20 P1 DONE — 7 textures wired; $1.035 total fal spend; commit fd3c710b
2026-06-20 P2 START — verification pass (Playwright browser + static INV greps)
2026-06-20 P2 DONE — 7/7 SC PASS, 5/5 INV PASS, 0 blockers; commit 3f0c727a
2026-06-20 INDEPENDENT VERIFY (monitor session) — drove app via Playwright MCP: guilloché + meteorite dial textures render live on tap (price $38k→$60k, summary updates); constraint CPQ confirmed (manual blocks moonphase w/ reason, tourbillon allows, cascade resets to none); serialize/restore round-trips; 0 console errors. Added __PRISM_DEBUG_STORES__.configurator handle so SC assertions are automatable; fixed spec SC paths (commit 8eb44d3c). F5.3 VERIFIED REAL, not just structurally asserted.
2026-06-20 F5.4 P1 START — crystal + liquid-glass panel + transmission guard (counter ≤2)
2026-06-20 F5.4 P1 DONE — crystal (transmission 0.95/ior 1.76, count=1) + liquid-glass-panel (Path C, MeshBasicNodeMaterial colorNode, +0 transmission) + budget guard (≤2, unit-tested cap+warn); 0 console errors; SC-O10.1/2/3/4 PASS
2026-06-20 F5.4 P2 START — diagnose + fix Arrival hero watch (blank white plane → watch.glb)
2026-06-20 F5.4 P2 DONE — Arrival hero watch ALREADY renders watch.glb correctly (54,563-vtx Hunyuan3D PBR mesh, baked 1024² map). Reported 'blank white plane + spinner' NOT REPRODUCIBLE: verified photoreal under warm, cold, throttled-cold (180kbps cache-cleared), AND env-nulled — watch stays textured + recognizable in all. Robust (not env-dependent). 0 console errors. Root: bug was fixed pre-F5.4 (F4b-FIX 'before-s1-arrival' already shows it rendering). No risky rewrite of a working hero asset (verify-before-claim; don't break what works). Evidence: notes/verification/orrery-f54/p2-*.png
2026-06-20 F5.4 P3 DONE — verification pass: SC-O10.1/2/3/4 + SC-O14.4 PASS (count=1, crystal ior 1.76 refracts, panel Path-C +0); configurator regression intact (guilloché live, CPQ blocks moonphase under manual, serialize/restore round-trips); INV greps clean (no TextGeometry/pixi/secrets/hub-world/broken-url); 0 console errors on Atelier+Arrival. Report → notes/ORRERY-ATELIER-REPORT.md. fal .035/$40 (F5.4 +$0).
