# Changelog

Notable releases for b34n5.xyz. Each release has a short JSON summary under `updates/`.

## v0.3.20 · 2026-11-20 · QU1PU AI
- `/qu1pu/` is now a QU1PU AI hub with topic tiles for Escrow, Lending and Vault. Answers come from official XRPL docs, each with a source.
- The Escrow tile still has the guided assistant: you review a draft, then you sign in Xaman. QU1PU never asks for your seed and never signs for you.
- Lending and Vault tiles are education only. The LendingProtocol, LendingProtocolV1_1 and SingleAssetVault amendments are not enabled on mainnet yet; they are still in validator voting.
- The chat bubble on the home page, Tools and Security can point you to the matching tile when you ask about escrow, lending or vaults.

## v0.3.19 · 2026-11-20 · QU1PU chat bubble
- A small QU1PU chat bubble now sits on the home page, Tools and Security. Ask about the XRP Ledger and get a direct answer from official docs, with a source.
- It never asks for your seed, and it will tell you never to share one. Lending features are clearly labelled as still in validator voting, not live on mainnet.
- The bubble does not appear on the QU1PU escrow assistant itself at `/qu1pu/`.

## v0.3.18 · 2026-11-16 · QU1PU (work in progress)
- First public release of **QU1PU**, a plain-English XRPL escrow assistant, at `/qu1pu/`. Work in progress.
- You review a plain-word summary before signing in Xaman. QU1PU does not sign, and it will never ask for your seed.


## v0.3.17 · 2026-11-13 · Tracer files on request
- The Transaction Tracer add-on and offline web copy are no longer public downloads. If you'd like a copy, DM [@B34N5XRP](https://x.com/B34N5XRP) on X or email [hello@b34n5.xyz](mailto:hello@b34n5.xyz).

## v0.3.16 · 2026-11-13 · Transaction Tracer
- Launched the read-only **Transaction Tracer** at `/tracer/`. Live mainnet globe, no keys.
- Browser add-on and offline web copies were briefly published under `/tracer/downloads/` (withdrawn in v0.3.17; copies are sent on request).
- Optional tips coin in the footer, with a link to [@B34N5XRP](https://x.com/B34N5XRP). Header logo goes to the home page.
- `/tools/mainnet/` and `/tools/testnet/` now redirect to the checker pages, and missing paths show a real 404 page.

## v0.3.15 · 2026-11-12 · Explainer hop-by-hop activity
- Hop-by-hop travel and a manual Next hop / Play follow mode on the Explainer testnet activity.

## v0.3.14 · 2026-11-12 · XRPL Explainer activity
- Interactive testnet activity added to the Explainer.

## v0.3.13 · 2026-11-10 · Motion site
- New motion homepage design.
- Smooth page-to-page transitions across Home, Tools, Checker, Family Vault, XRPL Explainer and The Lobby.
- Motion respects your device's reduced-motion setting.

## v0.3.12 · 2026-11-10 · XRPL Explainer
- Launched the interactive **XRPL Explainer** ("Is XRP just Ripple?") at `/explainer/`. Read-only; facts cite xrpl.org.
- Linked from Home, Tools and Projects.

## v0.3.10 · 2026-11-03 · BatchChecker refinements
- Cleaner three-step layout with a **New to this?** guide.
- Help, privacy and disclaimer notes moved into compact info tiles.
- Added clear notes: not affiliated with Ripple or the XRPL Foundation; lookups use public XRPL nodes and nothing is stored by this site; classic r-addresses only for now.

## v0.3.8 · 2026-11-03 · BatchChecker
- New **BatchChecker** (`/checker/batch/`): paste a list of XRPL addresses, see balances, and download a CSV.
- Runs entirely in your browser. Testnet by default, with a Mainnet switch.
- Rate-limited lookups with automatic retry on another public node.
- Published test runs and Apache-2.0 licence.

## v0.3.5 · 2026-11-02 · XRP Starter Packs
- **Starter Packs** on the Tools page: Family (Family Vault, XRPL Will), Analyst (Balance Checker, balance script, explorers) and Traffic (coming soon).
- Testnet first. No keys, nothing stored.

## v0.3.2 · 2026-11-01 · Project carousel
- Interactive project carousel with category tiles, a glassy navigation bar, and a mobile-friendly swipe layout.
