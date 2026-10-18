# Family Vault: Practice vault (Testnet), phase 1

A simple page for saving XRP for a young family member using the XRP Ledger's own
time-locked escrow. **Testnet only** (practice XRP, no value). Mainnet stays locked until the lawyer says OK.
Not financial or legal advice.

## What it does
1. **Family member's savings**: paste their Testnet address (starts with `r`). The page reads the
   public ledger (`account_objects`) and shows the escrows paid to them: total locked, each saving,
   next unlock date and progress. Dates are in UTC.
2. **Check progress with a hash**: paste an EscrowCreate transaction hash. The page looks it up (`tx`),
   then checks whether the escrow is still there (`ledger_entry`). If it's gone, it checks the
   saver's public history (`account_tx`) to say whether it was claimed or cancelled.
   It can also build an *unsigned* claim (EscrowFinish) or cancel (EscrowCancel).
3. **Build a saving**: fill in your address, their address, amount, unlock date and cancel-after
   date. The page makes an **unsigned** EscrowCreate as JSON, with copy and download buttons.
4. **Calendar (optional)**: download an `.ics` file with unlock dates. It's made on your device.

## What it never does
- Never asks for, sees or stores seeds or private keys. It cannot sign or submit anything.
- Stores nothing on any server; no accounts, email, phone, analytics or location.
- Talks only to the public XRPL Testnet (`wss://s.altnet.rippletest.net:51233`) and refuses any
  server that doesn't report the Testnet network id (1). Only read-only requests are allowed in code.
- No sounds.

## How to use it (beginner steps)
1. Open `index.html` through any simple static web server (for example
   `python3 -m http.server` in this folder, then visit `http://localhost:8000`).
2. Get a Testnet wallet in **your own** wallet app (one that supports Testnet and signing from JSON),
   and fund it from the official XRPL Testnet faucet. Your keys stay in your wallet.
3. In "Build a saving", fill in the fields and press **Build unsigned transaction**. Read the warnings.
4. Copy or download the JSON, import it into your wallet, check every field, make sure the wallet is on
   Testnet, then sign and submit there.
5. Copy the new transaction hash from your wallet and paste it into "Check progress with a hash".
6. Paste the family member's address into "Family member's savings" to see all their savings.

## Things to know (native XRPL rules)
- Before the unlock date nobody can release the XRP. After it, a claim always goes to the family member.
- After the cancel-after date, unclaimed XRP can be returned to the saver.
- Each open escrow holds back a small reserve in the saver's wallet; every transaction costs a tiny fee, even if it fails.
- Transactions cannot be undone. The family member's wallet must already be active (funded).
- Their parent looks after the young person's wallet keys until legal age.

## Hosting notes (not deployed)
Static files only: `index.html`, `style.css`, `bg.js`, `app.js`. Any free static host works.
When hosting, also send the header `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`),
which can't be set from a meta tag.

## Testing that was done
Throwaway Testnet accounts were made from the faucet on the build box only, escrows were created and
one was finished with a node script, then the page's read views were checked in a headless browser.
See `screenshots/`. The box couldn't reach port 51233, so for that test only, a temporary copy pointed
at another public Testnet server (network id 1); the shipped files use the address above.

## Phase 2: celebrations, journey PDF and story box

- **Backup Testnet server.** The app tries `wss://s.altnet.rippletest.net:51233` first. If that fails it uses `wss://testnet.xrpl-labs.com`. Both have to answer `network_id` 1 (Testnet), otherwise the app won't use them. Only these two are in the CSP `connect-src`.
- **Pop-ups.** They come from real ledger data: "Milestone reached" when a saving can be claimed, "You made it!" when a saving was finished, a pop-up for the first saving, and pop-ups for Finished/Unlocked results in the hash lookup. The "Celebrate the handoff (legal age)" button shows the real saving time, counted from the first EscrowCreate. Each pop-up shows once per visit and nothing is remembered. There's no sound. Confetti is turned off if you've asked your device for less motion. Esc or a click outside closes it.
- **Journey PDF.** This uses your browser's print window (Save as PDF). The top line reads "Practice vault · Testnet · made in your browser, nothing stored". It covers the ledger history (account_tx, read-only), the static list of past market events with sources (PLAN §6e), your highlights and your story.
- **Story box.** The text stays on this page. It only leaves as the PDF or a .txt/.json file you download yourself. It's never sent anywhere and never written to the ledger.
- Screenshots: `screenshots/popup-milestone.png`, `popup-handoff.png`, `story-box.png`, `sample-journey.pdf`. All from live Testnet with throwaway faucet accounts.
