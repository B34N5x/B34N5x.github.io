# Changelog

All notable site updates are listed here. Each entry has a matching JSON summary under `updates/`.

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
