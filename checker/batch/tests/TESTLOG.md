# BatchChecker test log

Date: **3 Nov 2026 (AEDT)**. Public addresses / hashes only. No seeds. Nothing stored.

| Test | Net | Result | Notes | Clip |
|------|-----|--------|-------|------|
| Seed paste rejected | Testnet | PASS | Fake seed-format string cleared; never sent | `clips/a-seed-reject.mp4` |
| Invalid lines flagged | Testnet | PASS | Bad lines flagged; valid address/tx still run | `clips/b-invalid-mixed.mp4` |
| Testnet address lookup | Testnet | PASS | Public faucet address balance/reserve/spendable | `clips/c-testnet-ok.mp4` |
| Mainnet mixed list | Mainnet | PASS | Public GateHub issuer ok; invalid lines flagged | `clips/d-mainnet-mixed.mp4` |
| CSV download | Testnet | PASS | CSV built in-browser after success | `clips/e-csv-download.mp4` |
| Node unavailable / timeout | Testnet | PASS | Clear error when nodes fail; code has per-request timeout + retry next node | `clips/f-node-timeout.mp4` |
| New to this? tour | Testnet | PASS | Guided demo + labelled sample list | `clips/g-new-to-this.mp4` |

See also the HTML page: [index.html](./index.html).
