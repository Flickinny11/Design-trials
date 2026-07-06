# SHIP-BRAND WAVE — FOUNDER DECISIONS (recorded 2026-07-05, session notes, not canonical spec)

Runs at END of current plan, after shippable. Founder-directed 2026-07-05.

## Branding
- Product/app/company brand: **KripTik** (domain kriptik.app, founder-owned, currently hosts dead legacy app).
- Runtime keeps the name **Prism** — "KripTik builds apps on the Prism runtime."
- NOT a rebrand of the tech; a promotion of KripTik to the consumer-facing front.
- Context: "Prism" is saturated as a consumer brand (OpenAI Prism launched Jan 2026;
  Prism XAML lib; Prism.js; Prism Launcher; PRISM model checker; ustwo Prism plugin Jun 2026).
  Fine as runtime name; wrong as the storefront.

## New repo + domain
- Create fresh KripTik repo at end of plan; migrate app; retire Design-trials as scratch history.
- Wire kriptik.app to the new deployment (replaces the dead legacy app).
- Legacy repo gets deleted after salvage.

## Salvage from legacy kriptik.app deployment (founder-confirmed)
- KEEP: Google OAuth client (add new callback URLs), GitHub OAuth app (same),
  API keys from provider consoles, **Resend** config (email/password resets — already working).
- DO NOT KEEP: database, storage (no customers ever existed; fresh DB/storage avoids confusion).
- Mechanism note: OAuth creds + API keys live in provider consoles, not the repo —
  reusable by adding new redirect/callback URLs at deploy time.
