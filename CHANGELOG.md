# Changelog

All notable site updates are listed here. Each entry has a matching JSON summary under `updates/`.


## 2026-11-03 — BatchChecker safety notes (v0.3.9 / sw b34n5-v37)

- Footer: "Not affiliated with Ripple or the XRPL Foundation."
- Privacy note: lookups go to public XRPL nodes, which can see the addresses queried; nothing is stored by this site.
- Paste step More info: classic r-addresses only (X-addresses and destination tags not supported yet).
- Copy-only change; tool logic unchanged. Service worker `b34n5-v37`; site version 0.3.9. Rollback: d355347.

## 2026-11-03 — BatchChecker v0 live (v0.3.8 / sw b34n5-v36)

- New page `checker/batch/`: step flow — (1) Paste your list, (2) Results, (3) Download CSV.
- Phone: compact result cards; desktop keeps the table. Extra detail behind More info / ?.
- **New to this?** self-made guided tour (skippable; sample Testnet list; no tour library; nothing stored).
- Client-side only; Testnet default; Mainnet toggle; CSV via in-browser Blob.
- Rate limit: sequential lookups with ~0.2s delay, max 50 lines (noted in More info).
- Per-request timeout (6s) + retry next public node; per-line `node unavailable` / clear reachability error.
- Test-only `forceNodeDown` hook removed before release (real timeout/retry kept).
- Public test runs page `checker/batch/tests/` + `TESTLOG.md` + short muted looping clips.
- Footer: short disclaimer, privacy one-liner, Adult supervision advised, See test runs, Licence (Apache-2.0).
- More info: optional “Handy at tax time? Export a CSV for your own records” (education only; not tax/financial advice).
- SPDX Apache-2.0 header on `assets/batch-checker.js`; repo `LICENSE` unchanged (Lobby not relicensed).
- Analyst Starter pack + All tools: BatchChecker linked live; Projects Live card; home Analyst summary updated.
- Service worker bumped to `b34n5-v36` (caches batch page + `batch-checker.js` + tests); site version 0.3.8; CSS `?v=36`.
- Rollback: revert to commit `a89ff89`.

## 2026-11-02 — Projects Coming soon (v0.3.7 / sw b34n5-v35)

- Projects page: **Coming soon** section with BatchChecker (Analyst pack) and XRPL Toll (Traffic pack) — short title, one-line summary, Coming soon badge, link to Starter Pack.
- Lobby card kept under In progress (maintenance unchanged).
- Service worker bumped to `b34n5-v35`; site version 0.3.7; CSS `?v=35`.
- Rollback: revert to commit `aaef4ef`.

## 2026-11-02 — Starter Packs regroup (v0.3.6 / sw b34n5-v34)

- Family Starter: Family Vault + XRPL Will only.
- Analyst Starter: Balance Checker, Apache-2.0 balance script, BatchChecker (Coming soon); explorers kept as small secondary links.
- Traffic Starter: Toll (Coming soon) + More traffic projects coming.
- Removed standalone More packs coming tile (covered under Traffic).
- Service worker bumped to `b34n5-v34`; site version 0.3.6; CSS `?v=34`.
- Rollback: revert to commit `ceb0b35`.

## 2026-11-02 — XRP Starter Packs (v0.3.5 / sw b34n5-v33)

- Tools page: new **XRP Starter Packs** section with floating tiles — Family (Live), Analyst (Live), Traffic (Coming soon), More packs coming.
- Family: Family Vault + XRPL Will. Analyst: Balance Checker, Apache-2.0 balance script, public explorers (XRPL Explorer, Bithomp, XRPScan) + NFT docs. Traffic: toll-road fees idea only, no live tool.
- Note on every pack path: Testnet first. No keys, nothing stored. Existing All tools cards kept.
- Home Tools carousel: starter-pack subcategory tiles + All tools link; summary mentions Starter Packs.
- Service worker bumped to `b34n5-v33`; site version 0.3.5; CSS cache-bust `?v=33`.
- Rollback: revert to commit `baca428`.

## 2026-11-01 — Tab titles & summaries (v0.3.4 / sw b34n5-v32)

- Replaced vague "tap · subcategories" tile hints with a clear carousel guide ("Swipe to explore · tap a tile for more") and a real one-line summary on every tile.
- Each subcategory now has a short title plus a ≤60-char plain-English summary (Lobby keeps Under maintenance + Adult supervision advised).
- Nav order matches the carousel: Home → NFTs → Tools → Security → Projects (Privacy stays in the footer).
- Checked links: tools, checker (mainnet/testnet), family-vault, security, projects, privacy, terms, XRPL Will, balance-checker GitHub — no 404s; Lobby remains under NFTs only.
- Service worker bumped to `b34n5-v32`; site version 0.3.4.
- Rollback: revert to commit `15c46e0`.

## 2026-11-01 — Android carousel fix (v0.3.3 / sw b34n5-v31)

- Touch/narrow screens (`max-width: 768px` or `pointer: coarse`): flat horizontal scroll-snap carousel — no 3D transforms, perspective, or backface flicker; opacity/scale only; `will-change` only while animating.
- No auto-rotate on mobile (native pan-x scroll instead of JS swipe vs vertical scroll fights).
- Subcategories open as a bottom sheet with safe-area padding; desktop keeps the floating corner panel and 3D coverflow.
- Kept all tile content, chips/pills, Lobby maintenance, glassy nav, See more.
- Service worker bumped to `b34n5-v31`; site version 0.3.3.
- Rollback: revert to commit `159bd20`.

## 2026-11-01 — Carousel + glassy nav (v0.3.2 / sw b34n5-v30)

- Added a lightweight 3D-ish project tile carousel (auto-rotate, pause on hover/touch, swipe, arrow keys, dots).
- Category tiles with subcategories (NFTs, Tools) open a floating corner panel of smaller tiles; Esc / click-off / close returns to the carousel.
- Glassy sticky nav with a slim accent glow underline.
- Kept floating-card style, Lobby maintenance pill, Adult supervision advised, Privacy link, Apache-2.0 footers.
- `prefers-reduced-motion` falls back to a static grid.
- Service worker bumped to `b34n5-v30`; site version 0.3.2.
- Rollback: revert to commit `e6ec078b31210bb997549c8c7a2c7d7b8c889e1e`.