# WORKLOG — Homepage flagships + Lab preview

Date: 2026-11-10 (Australia/Sydney)
Preview: https://b34n5.xyz/preview-aa7d3847/
Status: unlisted (noindex,nofollow); live `index.html` untouched

## Goal
Restructure the homepage so 1–2 flagships are spotlighted and everything else sits in a labelled Lab section, while keeping the existing Motion-style float-card bob/tilt and reduced-motion behaviour.

## What changed
- Added `preview-aa7d3847/index.html` — restructured home layout only.
- Added `preview-aa7d3847/preview.css` — equal two-column flagship/lab decks; section headings. Reuses `../assets/style.css` + `float-cards.js` for interactive motion.
- Reuses site rain, sparkle, riddles, banner, glass nav, trust line, See more (Lobby video / why / security / XRPL basics).
- CSP includes `upgrade-insecure-requests` and `noindex,nofollow`. No robots.txt change. No live homepage edit.

## Flagships (Coming soon — no preview URLs linked)
- QU1PU — plain-English escrow guide for Xaman
- XRPL Explainer — interactive ledger walkthrough

## Lab
### XRPL tools
- Balance Checker → `/checker/`
- BatchChecker → `/checker/batch/`
- Family Vault → `/family-vault/`
- XRPL Will → https://xrpl-will.pages.dev

### NFTs & creative
- The Lobby → `/TheLobby/`
- NFT Game World demo → `/projects/game-demo/`

### Also cooking
- XRPL Toll — Coming soon (no live page)

## Not placed (not on the public site yet)
- DUM-e (Pi studio) — separate project, no b34n5.xyz page
- Neutral Settlement Explorer — no live page on main
- Shield token — operational token work, not a homepage project card

## Issues / fixes
- Float-deck default makes first card full-width; fixed with `.flag-deck` / `.lab-deck` + existing `.pack-deck` pattern so flagships sit side-by-side on wide screens.
- Paths in preview are `../…` so links hit live tools without embedding unlisted preview paths.
- Carousel removed from this preview (flagships + Lab replace category tiles); float-cards motion kept.

## Verify
- HTTP 200 on preview URL after Pages deploy
- Desktop + mobile screenshots under `/workspace/projects/b34n5-restructure/`
- Spot-check Lab links (checker, Lobby, tools, Will)
