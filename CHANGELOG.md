# Changelog

All notable site updates are listed here. Each entry has a matching JSON summary under `updates/`.

## 2026-11-01 — Carousel + glassy nav (v0.3.2 / sw b34n5-v30)

- Added a lightweight 3D-ish project tile carousel (auto-rotate, pause on hover/touch, swipe, arrow keys, dots).
- Category tiles with subcategories (NFTs, Tools) open a floating corner panel of smaller tiles; Esc / click-off / close returns to the carousel.
- Glassy sticky nav with a slim accent glow underline.
- Kept floating-card style, Lobby maintenance pill, Adult supervision advised, Privacy link, Apache-2.0 footers.
- `prefers-reduced-motion` falls back to a static grid.
- Service worker bumped to `b34n5-v30`; site version 0.3.2.
- Rollback: revert to commit `e6ec078b31210bb997549c8c7a2c7d7b8c889e1e`.
