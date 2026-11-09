# WORKLOG — Homepage motion-site redesign (v2)

Date: 2026-11-10 (Australia/Sydney)
Preview: https://b34n5.xyz/preview-04c176cb/
Status: unlisted (noindex,nofollow); live `index.html` untouched
Supersedes crowded layout at `/preview-aa7d3847/` (left in place)

## Goal
Arnhel: previous preview too crowded / generic. Want a Motion-site feel
(referenced Motion AI Kit). Use connected Motion MCP for real patterns.

## Design
- Minimal hero: giant **B34N5x** + one line (“XRPL tools. Built solo.”)
- Scroll-driven: progress bar, hero parallax, flagship title parallax + fade
- Large flagship visual tiles (QU1PU, XRPL Explainer) — name + 3–5 word tag + Coming soon
- Lab as compact interactive strip (glyph + name; detail on hover/tap)
- Cursor-reactive glow + particle field (brand green)
- Magnetic spring hover on tiles (Motion `hover` + pointer tilt)

## Motion sources (free APIs / examples)
- Docs: scroll, hover, inView (via search-motion-docs)
- Examples adapted: js-parallax, js-scroll-fade
- Library: self-hosted `motion@12.23.12` → `lib/motion.js` (CSP `script-src 'self'`)

## Files
- `index.html`, `styles.css`, `app.js`, `lib/motion.js`, `WORKLOG.md`

## Flagships
- QU1PU — “Escrow, in plain English” · Coming soon (no preview link)
- XRPL Explainer — “How the ledger works” · Coming soon (no preview link)

## Lab (name-only tiles)
Balance Checker, BatchChecker, Family Vault, XRPL Will, The Lobby, NFT Game World, XRPL Toll (soon)

## Not placed
DUM-e, Neutral Settlement Explorer, Shield token (no public site pages)

## Issues / fixes
- Must self-host Motion — CDN import blocked by CSP
- `inView` reveals need initial `opacity:0` under `prefers-reduced-motion: no-preference`
- Coarse pointers: skip magnetic tilt; tap toggles Lab hint
